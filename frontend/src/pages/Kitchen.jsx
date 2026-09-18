import { useEffect, useState } from "react";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  Printer,
  RefreshCw,
} from "lucide-react";
import { io } from "socket.io-client";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { Button, Loading, PageHeader } from "../components/UI";
export default function Kitchen() {
  const { activeBranchId } = useAuth();
  const toast = useToast();
  const { settings } = useAppSettings();
  const b = activeBranchId;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [printTicket, setPrintTicket] = useState(null);
  async function load() {
    try {
      const r = await api.get(`/kitchen/queue?branch_id=${b}`);
      setRows(r.data.data || []);
      setUpdatedAt(new Date());
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const socket = io(import.meta.env.VITE_SOCKET_URL || location.origin, {
      auth: { token: localStorage.getItem("accessToken") },
    });
    socket.emit("branch:join", b);
    socket.on("kitchen:new", load);
    socket.on("kitchen:updated", load);
    socket.on("order:updated", load);
    const timer = setInterval(load, 10000);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [b]);
  async function status(id, value) {
    try {
      await api.patch(`/kitchen/tickets/${id}/status`, {
        branch_id: b,
        status: value,
      });
      load();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  function printOrder(ticket) {
    setPrintTicket(ticket);
    window.setTimeout(() => {
      window.print();
      setPrintTicket(null);
    }, 100);
  }
  return (
    <>
      <PageHeader
        title="Kitchen Display"
        subtitle={`កុម្ម៉ង់ថ្មី និងស្ថានភាពចម្អិនអាហារ${updatedAt ? ` • ធ្វើបច្ចុប្បន្នភាព ${updatedAt.toLocaleTimeString("km-KH")}` : ""}`}
      />
      <div className="kitchen-refresh">
        <Button variant="ghost" onClick={load}>
          <RefreshCw /> Refresh / ធ្វើបច្ចុប្បន្នភាព
        </Button>
      </div>
      <div className="kitchen-tabs">
        <span>
          <i className="dot new" /> ថ្មី{" "}
          {rows.filter((x) => x.status === "new").length}
        </span>
        <span>
          <i className="dot preparing" /> កំពុងធ្វើ{" "}
          {
            rows.filter((x) => ["accepted", "preparing"].includes(x.status))
              .length
          }
        </span>
        <span>
          <i className="dot ready" /> រួចរាល់{" "}
          {rows.filter((x) => x.status === "ready").length}
        </span>
      </div>
      {loading ? (
        <Loading />
      ) : (
        <div className="ticket-grid">
          {rows.map((t) => (
            <article className={`ticket ${t.status}`} key={t.id}>
              <header>
                <div>
                  <b>{t.table_name || "Takeaway"}</b>
                  <small>{t.ticket_no}</small>
                </div>
                <span>
                  <Clock />{" "}
                  {new Date(t.sent_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </header>
              <div className="ticket-items">
                {(t.items || []).map((x) => (
                  <div key={x.id}>
                    <strong>{x.quantity}×</strong>
                    <div>
                      <b>{x.item_name_kh || x.item_name}</b>
                      {x.notes && <small>{x.notes}</small>}
                    </div>
                  </div>
                ))}
              </div>
              <footer>
                <Button variant="ghost" onClick={() => printOrder(t)}>
                  <Printer /> ព្រីន Order
                </Button>
                {t.status === "new" && (
                  <Button onClick={() => status(t.id, "preparing")}>
                    <Flame /> ចាប់ផ្ដើម
                  </Button>
                )}
                {["accepted", "preparing"].includes(t.status) && (
                  <Button onClick={() => status(t.id, "ready")}>
                    <CheckCircle2 /> រួចរាល់
                  </Button>
                )}
                {t.status === "ready" && (
                  <Button onClick={() => status(t.id, "completed")}>
                    <ChefHat /> បានប្រគល់
                  </Button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
      {printTicket && (
        <section className="kitchen-print-ticket">
          {settings.logo_url && <img src={settings.logo_url} alt="Logo" />}
          <h2>{settings.business_name_kh || settings.business_name}</h2>
          <h3>ប័ណ្ណផ្ទះបាយ / KITCHEN ORDER</h3>
          <div className="kitchen-print-meta">
            <b>{printTicket.table_name || "Takeaway"}</b>
            <span>{printTicket.ticket_no}</span>
            <span>Order: {printTicket.order_no}</span>
            <span>{new Date(printTicket.sent_at).toLocaleString("km-KH")}</span>
          </div>
          <hr />
          {(printTicket.items || []).map((item) => (
            <div className="kitchen-print-line" key={item.id}>
              <strong>{Number(item.quantity)}×</strong>
              <div>
                <b>{item.item_name_kh || item.item_name}</b>
                {item.notes && <small>{item.notes}</small>}
              </div>
            </div>
          ))}
          <hr />
          <p>អ្នកព្រីន: {new Date().toLocaleTimeString("km-KH")}</p>
        </section>
      )}
    </>
  );
}
