import { useEffect, useState } from "react";
import { Clock, Edit3, Play, Trash2, Users, WandSparkles } from "lucide-react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import {
  Button,
  Confirm,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  StatusBadge,
} from "../components/UI";
export default function Tables() {
  const { activeBranchId: b, can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(
    `/table-operations?branch_id=${b}`,
  );
  const { data: areas } = useApi(`/areas?branch_id=${b}&limit=100`);
  const { data: shapes } = useApi(
    `/shapes?branch_id=${b}&limit=100&is_active=1`,
  );
  const [edit, setEdit] = useState(null);
  const [status, setStatus] = useState(null);
  const [remove, setRemove] = useState(null);
  const rows = data || [];
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || location.origin, {
      auth: { token: localStorage.getItem("accessToken") },
    });
    socket.emit("branch:join", b);
    const refresh = () => reload();
    [
      "kitchen:new",
      "order:updated",
      "table:updated",
      "payment:completed",
    ].forEach((event) => socket.on(event, refresh));
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [b]);
  async function save(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const body = {
        ...f,
        branch_id: b,
        capacity: Number(f.capacity),
        is_active: 1,
        status: edit.id ? edit.status : "available",
      };
      edit.id
        ? await api.put(`/tables/${edit.id}`, body)
        : await api.post("/tables", body);
      toast("រក្សាទុកតុរួច");
      setEdit(null);
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function setTableState(value) {
    try {
      await api.patch(`/tables/${status.id}/status`, {
        branch_id: b,
        status: value,
      });
      toast("បានប្ដូរស្ថានភាពតុ");
      setStatus(null);
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function deleteTable() {
    try {
      const response = await api.delete(`/tables/${remove.id}`, {
        data: { branch_id: b },
      });
      toast(
        response.data.message === "Table deleted"
          ? "បានលុបតុជោគជ័យ"
          : "តុមានប្រវត្តិ—បានបិទការប្រើប្រាស់ដោយសុវត្ថិភាព",
      );
      setRemove(null);
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  function enter(t) {
    if (!t.open_order_id && t.status === "reserved") {
      toast("សូម Check-in ការកក់ មុនបើក Order");
      nav("/reservations");
      return;
    }
    nav(
      `/pos?table=${t.id}${t.open_order_id ? `&order=${t.open_order_id}` : ""}`,
    );
  }
  const shapeType = (code) =>
    (shapes?.items || []).find((shape) => shape.code === code)?.shape_type ||
    code;
  return (
    <>
      <PageHeader
        title="គ្រប់គ្រងតុ Multi-Branch"
        subtitle="Available • Occupied • Reserved • Cleaning"
        action={can("tables.manage") ? "បន្ថែមតុ" : null}
        onAction={() => setEdit({})}
      />
      <div className="table-summary">
        {["available", "occupied", "reserved", "cleaning"].map((s) => (
          <div key={s}>
            <StatusBadge value={s} />
            <b>{rows.filter((x) => x.status === s).length}</b>
          </div>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="table-grid">
          {rows.map((t) => (
            <article key={t.id} className={`dining-table ${t.status}`}>
              <div className="table-top">
                <div>
                  <strong>{t.name}</strong>
                  <small>{t.area_name_kh || t.area_name}</small>
                </div>
                <StatusBadge value={t.status} />
              </div>
              <div className="table-icon">
                {shapeType(t.shape) === "round" ? (
                  <div className="round-table" />
                ) : ["rectangle", "oval"].includes(shapeType(t.shape)) ? (
                  <div className="rectangle-table" />
                ) : (
                  <div className="square-table" />
                )}
              </div>
              <p>
                <Users /> {t.capacity} នាក់
              </p>
              {t.open_order_id && (
                <div className="table-order">
                  <b>{t.order_no}</b>
                  <span>${Number(t.total_amount).toFixed(2)}</span>
                  <small>
                    <Clock /> {new Date(t.opened_at).toLocaleTimeString()}
                  </small>
                </div>
              )}
              {!t.open_order_id && t.reservation_id && (
                <div className="table-reservation">
                  <b>{t.reservation_no}</b>
                  <span>{t.reservation_guest_name}</span>
                  <small>
                    <Clock />{" "}
                    {new Date(t.reservation_at).toLocaleString("km-KH")}
                  </small>
                </div>
              )}
              <div className="table-buttons">
                <Button onClick={() => enter(t)}>
                  <Play />{" "}
                  {t.open_order_id
                    ? "បន្ត Order"
                    : t.status === "reserved"
                      ? "ទៅ Check-in"
                      : "បើក POS"}
                </Button>
                {can("tables.manage") && (
                  <>
                    <button onClick={() => setEdit(t)}>
                      <Edit3 />
                    </button>
                    <button onClick={() => setStatus(t)}>
                      <WandSparkles />
                    </button>
                    <button
                      className="danger"
                      title="លុបតុ"
                      onClick={() => setRemove(t)}
                    >
                      <Trash2 />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && (
        <Modal
          title={edit.id ? "កែតុ" : "បន្ថែមតុ"}
          onClose={() => setEdit(null)}
        >
          <form className="form-grid" onSubmit={save}>
            <label>
              តំបន់
              <select
                name="dining_area_id"
                defaultValue={edit.dining_area_id || ""}
              >
                {(areas?.items || []).map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name_kh || a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              លេខកូដ
              <input name="code" defaultValue={edit.code || ""} required />
            </label>
            <label>
              ឈ្មោះតុ
              <input name="name" defaultValue={edit.name || ""} required />
            </label>
            <label>
              ចំនួនកៅអី
              <input
                name="capacity"
                type="number"
                min="1"
                defaultValue={edit.capacity || 4}
              />
            </label>
            <label>
              រាង
              <select name="shape" defaultValue={edit.shape || "square"}>
                {(shapes?.items || []).map((shape) => (
                  <option value={shape.code} key={shape.id}>
                    {shape.name_kh || shape.name} ({shape.code})
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions full">
              <Button>រក្សាទុក</Button>
            </div>
          </form>
        </Modal>
      )}
      {status && (
        <Modal
          title={`ស្ថានភាព — ${status.name}`}
          onClose={() => setStatus(null)}
        >
          <div className="status-actions">
            {["available", "reserved", "cleaning", "inactive"].map((x) => (
              <Button
                key={x}
                variant={x === "inactive" ? "danger" : "ghost"}
                onClick={() => setTableState(x)}
              >
                {x}
              </Button>
            ))}
          </div>
          {status.open_order_id && (
            <p className="alert error">
              តុនេះមាន Order កំពុងបើក ដូច្នេះមិនអាចប្ដូរស្ថានភាពដោយដៃបានទេ។
            </p>
          )}
        </Modal>
      )}
      {remove && (
        <Confirm
          message={`តើចង់លុប ${remove.name} មែនទេ? តុដែលមានប្រវត្តិនឹងត្រូវបិទជំនួសការលុប។`}
          onNo={() => setRemove(null)}
          onYes={deleteTable}
        />
      )}
    </>
  );
}
