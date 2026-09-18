import { useEffect, useState } from "react";
import {
  CalendarCheck,
  CircleCheck,
  LogIn,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import {
  Button,
  Confirm,
  DataTable,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
} from "../components/UI";

const statusLabels = {
  pending: "រង់ចាំបញ្ជាក់",
  confirmed: "បានបញ្ជាក់",
  seated: "បាន Check-in",
  completed: "បានបញ្ចប់",
  cancelled: "បានបោះបង់",
  no_show: "ភ្ញៀវមិនមក",
};

export default function Reservations() {
  const { activeBranchId: b } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(
    `/reservations?branch_id=${b}`,
  );
  const { data: tables } = useApi(`/tables?branch_id=${b}&limit=100`);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newStatus, setNewStatus] = useState("pending");

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || location.origin, {
      auth: { token: localStorage.getItem("accessToken") },
    });
    socket.emit("branch:join", b);
    const refresh = () => reload();
    ["reservation:updated", "payment:completed", "table:updated"].forEach(
      (event) => socket.on(event, refresh),
    );
    return () => socket.disconnect();
  }, [b]);

  async function save(e) {
    e.preventDefault();
    const x = Object.fromEntries(new FormData(e.currentTarget));
    try {
      setBusy(true);
      await api.post("/reservations", {
        ...x,
        branch_id: b,
        table_id: x.table_id || null,
        guest_count: Number(x.guest_count),
        duration_minutes: Number(x.duration_minutes || 90),
        deposit_amount: Number(x.deposit_amount || 0),
        reservation_at: x.reservation_at.replace("T", " ") + ":00",
      });
      toast("បានបង្កើតការកក់តុ");
      setOpen(false);
      setNewStatus("pending");
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReservation(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      setBusy(true);
      await api.post(`/reservations/${confirming.id}/confirm`, {
        branch_id: b,
        table_id: Number(form.table_id),
      });
      toast("បានបញ្ជាក់ការកក់ និងរក្សាតុរួច");
      setConfirming(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function checkIn(row) {
    try {
      setBusy(true);
      const response = await api.post(`/reservations/${row.id}/check-in`, {
        branch_id: b,
      });
      const result = response.data.data;
      toast("Check-in រួច និងបានបើក Order");
      navigate(`/pos?table=${result.table_id}&order=${result.order_id}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function cancelReservation() {
    try {
      setBusy(true);
      await api.post(`/reservations/${cancelling.id}/cancel`, {
        branch_id: b,
        reason: "Cancelled by user",
      });
      toast("បានបោះបង់ការកក់ និងដោះតុរួច");
      setCancelling(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const cols = [
    { key: "reservation_no", label: "លេខកក់" },
    { key: "guest_name", label: "ភ្ញៀវ" },
    { key: "guest_phone", label: "ទូរស័ព្ទ" },
    {
      key: "table_name",
      label: "តុ",
      render: (value, row) =>
        value ? `${value} (${row.table_code || "-"})` : "មិនទាន់កំណត់",
    },
    { key: "guest_count", label: "ចំនួន" },
    {
      key: "reservation_at",
      label: "កាលវិភាគ",
      render: (value) => new Date(value).toLocaleString("km-KH"),
    },
    {
      key: "status",
      label: "ស្ថានភាព",
      render: (value) => (
        <span className={`badge status-${value}`}>
          {statusLabels[value] || value}
        </span>
      ),
    },
    { key: "order_no", label: "Order", render: (value) => value || "-" },
    {
      key: "lifecycle_actions",
      label: "សកម្មភាព",
      className: "no-print",
      render: (_value, row) => (
        <div className="reservation-actions">
          {row.status === "pending" && (
            <button disabled={busy} onClick={() => setConfirming(row)}>
              <CircleCheck /> បញ្ជាក់
            </button>
          )}
          {["pending", "confirmed"].includes(row.status) && row.table_id && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => checkIn(row)}
            >
              <LogIn /> Check-in
            </button>
          )}
          {row.status === "seated" && row.order_id && (
            <button
              className="primary"
              onClick={() =>
                navigate(`/pos?table=${row.table_id}&order=${row.order_id}`)
              }
            >
              <ShoppingCart /> បន្ត Order
            </button>
          )}
          {["pending", "confirmed"].includes(row.status) && (
            <button
              className="danger"
              disabled={busy}
              onClick={() => setCancelling(row)}
            >
              <XCircle /> បោះបង់
            </button>
          )}
          {row.status === "completed" && (
            <span className="reservation-done">
              <CalendarCheck /> ទូទាត់រួច
            </span>
          )}
        </div>
      ),
    },
  ];

  const activeTables = (tables?.items || []).filter(
    (table) =>
      table.is_active &&
      !["inactive", "cleaning", "occupied"].includes(table.status),
  );

  return (
    <>
      <PageHeader
        title="ការកក់តុ"
        subtitle="កក់ → បញ្ជាក់ → Check-in → Order → ទូទាត់ → តុទំនេរ"
        action="កក់តុថ្មី"
        onAction={() => {
          setNewStatus("pending");
          setOpen(true);
        }}
      />
      <div className="reservation-flow no-print">
        {[
          "កក់តុ",
          "បញ្ជាក់",
          "Check-in និងបើក Order",
          "ទូទាត់",
          "បញ្ចប់ និងដោះតុ",
        ].map((label, index) => (
          <div key={label}>
            <b>{index + 1}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DataTable
          rows={data || []}
          columns={cols}
          printTitle="បញ្ជីការកក់តុ"
        />
      )}

      {open && (
        <Modal title="កក់តុថ្មី" onClose={() => setOpen(false)}>
          <form className="form-grid" onSubmit={save}>
            <label>
              ឈ្មោះភ្ញៀវ
              <input name="guest_name" required />
            </label>
            <label>
              ទូរស័ព្ទ
              <input name="guest_phone" required />
            </label>
            <label>
              ចំនួនភ្ញៀវ
              <input
                name="guest_count"
                type="number"
                min="1"
                max="100"
                defaultValue="2"
                required
              />
            </label>
            <label>
              ពេលវេលា
              <input name="reservation_at" type="datetime-local" required />
            </label>
            <label>
              រយៈពេល (នាទី)
              <input
                name="duration_minutes"
                type="number"
                min="30"
                max="720"
                defaultValue="90"
              />
            </label>
            <label>
              ប្រាក់កក់ ($)
              <input
                name="deposit_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
            </label>
            <label>
              តុ
              <select name="table_id" required={newStatus === "confirmed"}>
                <option value="">កំណត់ពេលក្រោយ</option>
                {activeTables.map((table) => (
                  <option value={table.id} key={table.id}>
                    {table.name} • {table.capacity} នាក់
                  </option>
                ))}
              </select>
            </label>
            <label>
              ស្ថានភាព
              <select
                name="status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="pending">រង់ចាំបញ្ជាក់</option>
                <option value="confirmed">បញ្ជាក់ភ្លាម</option>
              </select>
            </label>
            <label className="full">
              កំណត់ចំណាំ
              <textarea name="notes" />
            </label>
            <div className="form-actions full">
              <Button disabled={busy}>រក្សាទុក</Button>
            </div>
          </form>
        </Modal>
      )}

      {confirming && (
        <Modal
          title={`បញ្ជាក់ការកក់ ${confirming.reservation_no}`}
          onClose={() => setConfirming(null)}
        >
          <form className="form-grid" onSubmit={confirmReservation}>
            <label className="full">
              ជ្រើសតុ
              <select
                name="table_id"
                defaultValue={confirming.table_id || ""}
                required
              >
                <option value="">ជ្រើសរើសតុ</option>
                {activeTables.map((table) => (
                  <option value={table.id} key={table.id}>
                    {table.name} • {table.capacity} នាក់
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions full">
              <Button disabled={busy}>បញ្ជាក់ និងរក្សាតុ</Button>
            </div>
          </form>
        </Modal>
      )}

      {cancelling && (
        <Confirm
          message={`តើចង់បោះបង់ការកក់ ${cancelling.reservation_no} មែនទេ? តុនឹងត្រូវដោះឲ្យទំនេរវិញ។`}
          onNo={() => setCancelling(null)}
          onYes={cancelReservation}
        />
      )}
    </>
  );
}
