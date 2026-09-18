import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChefHat,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Users,
  Wallet,
  X,
  Printer,
  LockKeyhole,
  Ban,
  LogOut,
  UserCircle,
  BadgePercent,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { useToast } from "../contexts/ToastContext";
import { Button, ErrorState, Modal, Loading } from "../components/UI";
import { createClientId } from "../utils/clientId";
export default function POS() {
  const { user, activeBranchId: branchId, can, logout } = useAuth();
  const { settings: globalSettings } = useAppSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [table, setTable] = useState(null);
  const [customer, setCustomer] = useState("");
  const [cart, setCart] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [payment, setPayment] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [cashSession, setCashSession] = useState(null);
  const [shift, setShift] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [appSettings, setAppSettings] = useState({
    khr_exchange_rate: "4100",
    business_name: "Restaurant",
    business_name_kh: "ភោជនីយដ្ឋាន",
    receipt_footer: "សូមអរគុណ • Thank you",
    receipt_width: "80",
    require_cash_shift: "true",
    allow_split_payment: "true",
  });
  useEffect(() => {
    setAppSettings((old) => ({ ...old, ...globalSettings }));
  }, [globalSettings]);
  async function loadShift() {
    if (!can("payments.create")) return;
    const r = await api.get(`/cash-sessions/current?branch_id=${branchId}`);
    setCashSession(r.data.data);
  }
  useEffect(() => {
    setLoading(true);
    setLoadError("");
    Promise.all([
      api.get("/categories?limit=100"),
      api.get("/menuItems?limit=200"),
      api.get(`/table-operations?branch_id=${branchId}`),
      api.get("/customers?limit=100"),
      can("payments.create")
        ? api.get(`/cash-sessions/current?branch_id=${branchId}`)
        : Promise.resolve({ data: { data: null } }),
      api.get(`/public/settings?branch_id=${branchId}`),
      api.get(`/paymentMethods?branch_id=${branchId}&limit=100&is_active=1`),
    ])
      .then(async ([a, m, t, c, s, settings, methods]) => {
        setCategories(a.data.data.items || []);
        setMenu(m.data.data.items || []);
        setTables(t.data.data || []);
        setCustomers(c.data.data.items || []);
        setCashSession(s.data.data);
        setPaymentMethods(methods.data.data.items || []);
        setAppSettings((old) => ({ ...old, ...settings.data.data }));
        const tableId = Number(params.get("table"));
        const selected = (t.data.data || []).find((x) => x.id === tableId);
        if (selected) setTable(selected);
        const orderId = Number(params.get("order"));
        if (orderId) {
          const detail = (
            await api.get(`/orders/${orderId}?branch_id=${branchId}`)
          ).data.data;
          setOrder(detail);
          setCustomer(detail.customer_id || "");
        }
      })
      .catch((e) => {
        const message = errorMessage(e);
        setLoadError(message);
        toast(message, "error");
      })
      .finally(() => setLoading(false));
  }, [branchId]);
  const shown = useMemo(
    () =>
      menu.filter(
        (x) =>
          x.is_active &&
          x.is_available &&
          (category === "all" || Number(x.category_id) === Number(category)) &&
          `${x.name} ${x.name_kh || ""} ${x.sku}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [menu, category, search],
  );
  const cartSubtotal = cart.reduce((s, x) => s + x.unit_price * x.quantity, 0);
  const selectedCustomer = customers.find(
    (item) => Number(item.id) === Number(customer),
  );
  const customerDiscountRate = Number(
    order?.discount_type === "percent"
      ? order.discount_value
      : selectedCustomer?.default_discount_percent || 0,
  );
  const estimatedDiscount = order
    ? Number(order.discount_amount || 0)
    : (cartSubtotal * customerDiscountRate) / 100;
  const orderTotal = Number(order?.total_amount || 0);
  const due = order
    ? Math.max(0, Number(order.balance_amount ?? orderTotal))
    : cartSubtotal;
  function add(x) {
    setCart((c) => {
      const found = c.find((i) => i.menu_item_id === x.id);
      return found
        ? c.map((i) =>
            i.menu_item_id === x.id ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [
            ...c,
            {
              menu_item_id: x.id,
              name: x.name,
              name_kh: x.name_kh,
              unit_price: Number(x.base_price),
              quantity: 1,
              notes: "",
            },
          ];
    });
  }
  function qty(id, n) {
    setCart((c) =>
      c.map((x) =>
        x.menu_item_id === id
          ? { ...x, quantity: Math.max(1, x.quantity + n) }
          : x,
      ),
    );
  }
  async function send() {
    if (!table && (!order || order.order_type === "dine_in"))
      return toast("សូមជ្រើសតុ ឬ Takeaway", "error");
    if (!cart.length) return toast("សូមជ្រើសមុខម្ហូប", "error");
    try {
      let active = order;
      if (!active) {
        const r = await api.post("/orders", {
          branch_id: branchId,
          table_id: table?.id || null,
          customer_id: customer || null,
          order_type: table ? "dine_in" : "takeaway",
          guest_count: 1,
        });
        active = r.data.data;
      }
      await api.post(`/orders/${active.id}/items`, {
        branch_id: branchId,
        submission_key: createClientId(),
        items: cart,
      });
      const r = await api.post(`/orders/${active.id}/send-kitchen`, {
        branch_id: branchId,
      });
      setOrder(r.data.data);
      setCart([]);
      toast("បានផ្ញើទៅផ្ទះបាយ");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  function finish(data, completedOrder = order) {
    setPayment(false);
    setReceipt({ ...data, order: completedOrder, table });
    setCart([]);
    setOrder(null);
    setTable(null);
    setCustomer("");
  }
  async function saveDiscount(values) {
    try {
      const response = await api.patch(`/orders/${order.id}/discount`, {
        branch_id: branchId,
        ...values,
      });
      setOrder(response.data.data);
      setDiscountOpen(false);
      toast(
        values.discount_type === "none"
          ? "បានដកការបញ្ចុះតម្លៃ"
          : "បានអនុវត្តការបញ្ចុះតម្លៃ",
      );
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }
  async function completeComplimentaryOrder() {
    try {
      const response = await api.post(`/orders/${order.id}/payments`, {
        branch_id: branchId,
        request_key: createClientId(),
        payments: [],
      });
      const detail = await api.get(`/orders/${order.id}?branch_id=${branchId}`);
      toast("បានបញ្ចប់ Order ឥតគិតថ្លៃ");
      finish(response.data.data, detail.data.data);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }
  async function cancelOrder() {
    try {
      await api.post(`/orders/${order.id}/cancel`, {
        branch_id: branchId,
        reason: cancelReason,
      });
      toast("បានបោះបង់ Order និងដោះតុរួច");
      setCancelOpen(false);
      setCancelReason("");
      setCart([]);
      setOrder(null);
      setTable(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  if (loading) return <Loading />;
  if (loadError)
    return (
      <div className="pos-load-error">
        <ErrorState
          message={loadError}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  return (
    <div className="pos-screen">
      <header className="pos-head">
        <Link to="/tables">
          <ArrowLeft />
        </Link>
        <div>
          <h2>Restaurant POS</h2>
          <small>
            {user.full_name} • សាខា #{branchId}
          </small>
        </div>
        {can("payments.create") && (
          <button
            className={`shift-pill ${cashSession ? "open" : "closed"}`}
            onClick={() => setShift(true)}
          >
            <LockKeyhole />
            <span>
              {cashSession
                ? `វេន #${cashSession.id} • បិទវេន`
                : "បើកវេនសាច់ប្រាក់"}
            </span>
          </button>
        )}
        <button
          className="table-picker"
          onClick={() => document.getElementById("tables-pop").showModal()}
        >
          <span>{table?.name || "Takeaway / ជ្រើសតុ"}</span>
          <Users />
        </button>
        <button className="pos-user" onClick={() => setLogoutOpen(true)}>
          <UserCircle />
          <span>
            <b>{user.full_name}</b>
            <small>{user.isSuperAdmin ? "Super Admin" : user.role_name}</small>
          </span>
          <LogOut />
        </button>
      </header>
      <main className="pos-body">
        <section className="menu-side">
          <div className="pos-search">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ស្វែងរកម្ហូប / SKU..."
            />
          </div>
          <div className="category-tabs">
            <button
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
            >
              ទាំងអស់
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={Number(category) === c.id ? "active" : ""}
                onClick={() => setCategory(c.id)}
              >
                {c.name_kh || c.name}
              </button>
            ))}
          </div>
          <div className="menu-grid">
            {shown.map((x) => (
              <button className="menu-card" key={x.id} onClick={() => add(x)}>
                {x.image ? (
                  <img src={x.image} alt="" />
                ) : (
                  <div className="food-placeholder">🍽️</div>
                )}
                <div>
                  <b>{x.name_kh || x.name}</b>
                  <small>{x.name}</small>
                  <strong>${Number(x.base_price).toFixed(2)}</strong>
                </div>
              </button>
            ))}
          </div>
        </section>
        <aside className="cart-side">
          <div className="cart-title">
            <div>
              <ShoppingCart />
              <b>{order ? order.order_no : "ការបញ្ជាទិញថ្មី"}</b>
            </div>
            <span>{cart.length + (order?.items?.length || 0)} មុខ</span>
          </div>
          <select
            className="customer-select"
            value={customer}
            disabled={Boolean(order)}
            onChange={(e) => setCustomer(e.target.value)}
          >
            <option value="">អតិថិជនទូទៅ</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_kh || c.name}
                {Number(c.default_discount_percent) > 0
                  ? ` • បញ្ចុះ ${Number(c.default_discount_percent)}%`
                  : ""}
                {c.phone ? ` — ${c.phone}` : ""}
              </option>
            ))}
          </select>
          {selectedCustomer && customerDiscountRate > 0 && (
            <div className="vip-discount-note">
              <UserCircle />
              <span>
                {selectedCustomer.customer_type === "vip"
                  ? "ភ្ញៀវពិសេស"
                  : "អតិថិជនមានបញ្ចុះតម្លៃ"}
              </span>
              <b>{customerDiscountRate}% OFF</b>
            </div>
          )}
          <div className="cart-list">
            {(order?.items || [])
              .filter((x) => x.kitchen_status !== "cancelled")
              .map((x) => (
                <div className="cart-row sent" key={`sent-${x.id}`}>
                  <div className="cart-info">
                    <b>{x.item_name_kh || x.item_name}</b>
                    <small>បានផ្ញើ • {x.kitchen_status}</small>
                  </div>
                  <span>{x.quantity}×</span>
                  <strong>${Number(x.line_total).toFixed(2)}</strong>
                </div>
              ))}
            {!cart.length && !order?.items?.length && (
              <div className="cart-empty">
                <ShoppingCart />
                <p>មិនទាន់មានម្ហូប</p>
              </div>
            )}
            {cart.map((x) => (
              <div className="cart-row" key={x.menu_item_id}>
                <div className="cart-info">
                  <b>{x.name_kh || x.name}</b>
                  <small>${x.unit_price.toFixed(2)}</small>
                </div>
                <div className="qty">
                  <button onClick={() => qty(x.menu_item_id, -1)}>
                    <Minus />
                  </button>
                  <span>{x.quantity}</span>
                  <button onClick={() => qty(x.menu_item_id, 1)}>
                    <Plus />
                  </button>
                </div>
                <strong>${(x.unit_price * x.quantity).toFixed(2)}</strong>
                <button
                  className="remove"
                  onClick={() => setCart((c) => c.filter((i) => i !== x))}
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          <div className="cart-total">
            {estimatedDiscount > 0 && (
              <div className="discount-line">
                <span>
                  បញ្ចុះតម្លៃ
                  {order?.discount_type === "fixed"
                    ? ` ($${Number(order.discount_value).toFixed(2)})`
                    : ` (${customerDiscountRate}%)`}
                  {order?.discount_reason ? ` • ${order.discount_reason}` : ""}
                </span>
                <b>−${estimatedDiscount.toFixed(2)}</b>
              </div>
            )}
            <div>
              <span>Order សរុប</span>
              <b>${(orderTotal + cartSubtotal).toFixed(2)}</b>
            </div>
            {order && (
              <div>
                <span>បានបង់</span>
                <b>${Number(order.paid_amount || 0).toFixed(2)}</b>
              </div>
            )}
            <div className="grand">
              <span>នៅសល់</span>
              <strong>${due.toFixed(2)}</strong>
            </div>
            <small>
              ៛{" "}
              {(
                due * Number(appSettings.khr_exchange_rate || 4100)
              ).toLocaleString("en-US")}
            </small>
          </div>
          <div className="cart-actions">
            <Button variant="kitchen" onClick={send}>
              <ChefHat /> ផ្ញើទៅផ្ទះបាយ
            </Button>
            {can("payments.create") && (
              <Button
                onClick={() =>
                  due <= 0 ? completeComplimentaryOrder() : setPayment(true)
                }
                disabled={!order}
              >
                <Wallet /> {due <= 0 && order ? "បញ្ចប់ $0" : "ទូទាត់"}
              </Button>
            )}
            {order && can("orders.update") && (
              <Button
                variant="ghost guest-discount-btn"
                onClick={() => setDiscountOpen(true)}
              >
                <BadgePercent /> បញ្ចុះតម្លៃភ្ញៀវ
              </Button>
            )}
            {order && can("orders.cancel") && (
              <Button
                variant="danger cancel-order-btn"
                onClick={() => setCancelOpen(true)}
              >
                <Ban /> បោះបង់ Order
              </Button>
            )}
          </div>
        </aside>
      </main>
      <dialog id="tables-pop" className="native-dialog">
        <div className="modal-head">
          <h3>ជ្រើសតុ / Resume Order</h3>
          <button onClick={() => document.getElementById("tables-pop").close()}>
            <X />
          </button>
        </div>
        <div className="pick-tables">
          <button
            onClick={() => {
              setTable(null);
              setOrder(null);
              document.getElementById("tables-pop").close();
            }}
          >
            Takeaway
          </button>
          {tables
            .filter((t) => t.status !== "inactive")
            .map((t) => (
              <button
                key={t.id}
                className={t.status}
                onClick={async () => {
                  setTable(t);
                  if (t.open_order_id) {
                    const r = await api.get(
                      `/orders/${t.open_order_id}?branch_id=${branchId}`,
                    );
                    setOrder(r.data.data);
                    setCustomer(r.data.data.customer_id || "");
                  } else setOrder(null);
                  document.getElementById("tables-pop").close();
                }}
              >
                {t.name}
                <small>
                  {t.status}
                  {t.order_no ? ` • ${t.order_no}` : ""}
                </small>
              </button>
            ))}
        </div>
      </dialog>
      {payment && (
        <Payment
          order={order}
          due={due}
          branchId={branchId}
          cashSession={cashSession}
          customerId={customer}
          exchangeRate={Number(appSettings.khr_exchange_rate || 4100)}
          currencyRounding={Number(appSettings.currency_rounding || 100)}
          baseCurrency={appSettings.base_currency || "USD"}
          secondaryCurrency={appSettings.secondary_currency || "KHR"}
          requireCashShift={appSettings.require_cash_shift !== "false"}
          allowSplitPayment={appSettings.allow_split_payment !== "false"}
          paymentMethods={paymentMethods}
          onClose={() => setPayment(false)}
          onDone={finish}
        />
      )}{" "}
      {discountOpen && order && (
        <DiscountEditor
          order={order}
          onClose={() => setDiscountOpen(false)}
          onSave={saveDiscount}
        />
      )}
      {shift && (
        <CashShift
          branchId={branchId}
          session={cashSession}
          onClose={() => setShift(false)}
          onChanged={() => {
            loadShift();
            setShift(false);
          }}
        />
      )}
      {receipt && (
        <Receipt
          data={receipt}
          settings={appSettings}
          onClose={() => setReceipt(null)}
        />
      )}
      {cancelOpen && (
        <Modal
          title={`បោះបង់ Order — ${order?.order_no}`}
          onClose={() => setCancelOpen(false)}
        >
          <div className="shift-form">
            <div className="alert error">
              Order នឹងត្រូវដកចេញពីផ្ទះបាយ ហើយតុនឹងក្លាយជា Available។
            </div>
            <label>
              មូលហេតុបោះបង់
              <textarea
                rows="3"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="ឧ. អតិថិជនស្នើបោះបង់"
                autoFocus
              />
            </label>
            <Button
              variant="danger"
              onClick={cancelOrder}
              disabled={cancelReason.trim().length < 3}
            >
              <Ban /> បញ្ជាក់បោះបង់ Order
            </Button>
          </div>
        </Modal>
      )}
      {logoutOpen && (
        <Modal title="ចាកចេញពីប្រព័ន្ធ" onClose={() => setLogoutOpen(false)}>
          <p>តើអ្នកចង់ចាកចេញពីគណនី {user.full_name} មែនទេ?</p>
          <div className="logout-actions">
            <Button variant="ghost" onClick={() => setLogoutOpen(false)}>
              បោះបង់
            </Button>
            <Button
              onClick={async () => {
                await logout(false);
                navigate("/login", { replace: true });
              }}
            >
              <LogOut /> ចាកចេញ
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DiscountEditor({ order, onClose, onSave }) {
  const [type, setType] = useState(
    order.discount_type === "fixed" ? "fixed" : "percent",
  );
  const [value, setValue] = useState(
    order.discount_type === "none" ? "" : String(order.discount_value || ""),
  );
  const [reason, setReason] = useState(order.discount_reason || "");
  const [busy, setBusy] = useState(false);
  const preview =
    type === "percent"
      ? (Number(order.subtotal || 0) * Number(value || 0)) / 100
      : Number(value || 0);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({
        discount_type: type,
        discount_value: Number(value),
        discount_reason: reason.trim(),
      });
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await onSave({
        discount_type: "none",
        discount_value: 0,
        discount_reason: "",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`បញ្ចុះតម្លៃ — ${order.order_no}`} onClose={onClose}>
      <form className="discount-form" onSubmit={submit}>
        <div className="discount-type-picker">
          <button
            type="button"
            className={type === "percent" ? "active" : ""}
            onClick={() => setType("percent")}
          >
            <BadgePercent /> ភាគរយ (%)
          </button>
          <button
            type="button"
            className={type === "fixed" ? "active" : ""}
            onClick={() => setType("fixed")}
          >
            $ ទឹកប្រាក់ថេរ
          </button>
        </div>
        <label>
          {type === "percent" ? "ភាគរយបញ្ចុះ" : "ទឹកប្រាក់បញ្ចុះ ($)"}
          <input
            type="number"
            min="0.01"
            max={type === "percent" ? "100" : order.subtotal}
            step="0.01"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          មូលហេតុបញ្ចុះតម្លៃ
          <textarea
            rows="3"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="ឧ. ភ្ញៀវប្រចាំ, កម្មវិធីពិសេស, សំណងសេវាកម្ម"
            minLength="3"
            required
          />
        </label>
        <div className="discount-preview">
          <span>តម្លៃបញ្ចុះប្រហែល</span>
          <strong>
            −${Math.min(Number(order.subtotal || 0), preview).toFixed(2)}
          </strong>
        </div>
        <div className="discount-form-actions">
          {Number(order.discount_amount || 0) > 0 && (
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={remove}
            >
              ដកការបញ្ចុះតម្លៃ
            </Button>
          )}
          <Button disabled={busy || !value || reason.trim().length < 3}>
            {busy ? "កំពុងរក្សាទុក..." : "អនុវត្តការបញ្ចុះតម្លៃ"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Payment({
  order,
  due,
  branchId,
  cashSession,
  customerId,
  exchangeRate,
  currencyRounding,
  baseCurrency,
  secondaryCurrency,
  requireCashShift,
  allowSplitPayment,
  paymentMethods,
  onClose,
  onDone,
}) {
  const toast = useToast();
  const methods = paymentMethods || [];
  const firstMethod =
    methods.find((method) => method.is_default)?.code ||
    methods[0]?.code ||
    "cash";
  const [rows, setRows] = useState([
    { method: firstMethod, currency: "USD", amount: due, reference: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const rate = exchangeRate;
  const currencies = [...new Set([baseCurrency, secondaryCurrency])].filter(
    (currency) => ["USD", "KHR"].includes(currency),
  );
  const roundKHR = (amount) =>
    Math.ceil(amount / Math.max(1, currencyRounding)) *
    Math.max(1, currencyRounding);
  const applied = rows.reduce(
    (s, x) =>
      s +
      (x.currency === "KHR"
        ? Number(x.amount || 0) / rate
        : Number(x.amount || 0)),
    0,
  );
  function update(i, key, value) {
    setRows((a) => a.map((x, j) => (j === i ? { ...x, [key]: value } : x)));
  }
  async function pay() {
    setBusy(true);
    try {
      const payments = rows.map((x) => ({
        payment_method: x.method,
        currency_code: x.currency,
        exchange_rate: x.currency === "KHR" ? rate : 1,
        tendered_amount: Number(x.amount),
        reference_no: x.reference || null,
        cash_session_id: cashSession?.id || null,
      }));
      const r = await api.post(`/orders/${order.id}/payments`, {
        branch_id: branchId,
        request_key: createClientId(),
        payments,
      });
      toast("ទូទាត់បានជោគជ័យ");
      onDone(r.data.data);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="ទូទាត់ប្រាក់ / Split Payment" onClose={onClose} wide>
      <div className="payment-total">
        <small>ប្រាក់នៅសល់</small>
        <strong>${due.toFixed(2)}</strong>
        <span>៛ {roundKHR(due * rate).toLocaleString()}</span>
      </div>
      {rows.map((x, i) => (
        <div className="payment-row" key={i}>
          <select
            value={x.method}
            onChange={(e) => update(i, "method", e.target.value)}
          >
            {methods.map((method) => (
              <option
                key={method.code}
                value={method.code}
                disabled={method.method_type === "credit" && !customerId}
              >
                {method.name_kh || method.name}
              </option>
            ))}
          </select>
          <select
            value={x.currency}
            onChange={(e) => update(i, "currency", e.target.value)}
          >
            {currencies.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step={x.currency === "KHR" ? currencyRounding : 0.01}
            value={x.amount}
            onChange={(e) => update(i, "amount", e.target.value)}
          />
          <input
            placeholder="លេខយោង ABA/Card"
            value={x.reference}
            onChange={(e) => update(i, "reference", e.target.value)}
          />
          {rows.length > 1 && (
            <button onClick={() => setRows((a) => a.filter((_, j) => j !== i))}>
              <X />
            </button>
          )}
        </div>
      ))}
      <div className="split-summary">
        {allowSplitPayment && (
          <Button
            variant="ghost"
            onClick={() =>
              setRows((a) => [
                ...a,
                {
                  method:
                    methods.find((method) => method.method_type !== "cash")
                      ?.code || firstMethod,
                  currency: "USD",
                  amount: Math.max(0, due - applied).toFixed(2),
                  reference: "",
                },
              ])
            }
          >
            + Split Payment
          </Button>
        )}
        <span>
          បានបញ្ចូល: <b>${applied.toFixed(2)}</b>
        </span>
      </div>
      {requireCashShift &&
        rows.some(
          (x) =>
            methods.find((method) => method.code === x.method)?.method_type ===
            "cash",
        ) &&
        !cashSession && (
          <div className="alert error">
            សូមបើក Cash Shift មុនទទួលសាច់ប្រាក់។
          </div>
        )}
      <Button
        onClick={pay}
        disabled={
          busy ||
          applied + 0.0001 < due ||
          (requireCashShift &&
            rows.some(
              (x) =>
                methods.find((method) => method.code === x.method)
                  ?.method_type === "cash" && !cashSession,
            ))
        }
      >
        {busy ? "កំពុងទូទាត់..." : "បញ្ជាក់ទូទាត់"}
      </Button>
    </Modal>
  );
}

function CashShift({ branchId, session, onClose, onChanged }) {
  const toast = useToast();
  const { data: registers } = useSimple(
    `/cash-registers?branch_id=${branchId}`,
  );
  const [closing, setClosing] = useState("");
  async function open(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api.post("/cash-sessions/open", {
        branch_id: branchId,
        cash_register_id: Number(f.cash_register_id),
        opening_amount: Number(f.opening_amount),
      });
      toast("បានបើក Cash Shift");
      onChanged();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function close() {
    try {
      const r = await api.post(`/cash-sessions/${session.id}/close`, {
        branch_id: branchId,
        closing_amount: Number(closing),
      });
      toast(
        `បិទ Shift រួច • ខុសគ្នា $${Number(r.data.data.difference_amount).toFixed(2)}`,
      );
      onChanged();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  return (
    <Modal
      title={session ? "បិទ Cash Shift" : "បើក Cash Shift"}
      onClose={onClose}
    >
      {session ? (
        <div className="shift-form">
          <p>
            Register: <b>{session.register_name}</b>
          </p>
          <p>
            Opening: <b>${Number(session.opening_amount).toFixed(2)}</b>
          </p>
          <p>
            លក់សាច់ប្រាក់: <b>${Number(session.cash_sales || 0).toFixed(2)}</b>
          </p>
          <p>
            ប្រាក់រំពឹងទុក:{" "}
            <b>
              $
              {Number(
                session.live_expected_amount || session.opening_amount,
              ).toFixed(2)}
            </b>
          </p>
          <label>
            សាច់ប្រាក់រាប់បាន
            <input
              type="number"
              step="0.01"
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              autoFocus
            />
          </label>
          <Button onClick={close} disabled={closing === ""}>
            បិទ Shift និងគណនាខុសគ្នា
          </Button>
        </div>
      ) : (
        <form onSubmit={open} className="shift-form">
          <label>
            Cash Register
            <select name="cash_register_id" required>
              <option value="">ជ្រើសរើស</option>
              {(registers || []).map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            ប្រាក់ដើមវេន
            <input
              name="opening_amount"
              type="number"
              step="0.01"
              defaultValue="0"
              required
            />
          </label>
          <Button>បើក Shift</Button>
        </form>
      )}
    </Modal>
  );
}
function useSimple(path) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(path).then((r) => setData(r.data.data));
  }, [path]);
  return { data };
}
export function Receipt({ data, settings, onClose }) {
  const order = data.order || {};
  const rate = Number(settings.khr_exchange_rate || 4100);
  const tableName = order.table_name || data.table?.name;
  const tableCode = order.table_code || data.table?.code;
  const paymentLabels = {
    cash: "សាច់ប្រាក់ / Cash",
    aba_khqr: "ABA KHQR",
    card: "កាត / Card",
    bank_transfer: "ផ្ទេរធនាគារ / Bank",
    credit: "ជំពាក់ / Credit",
    other: "ផ្សេងៗ / Other",
  };
  useEffect(() => {
    if (settings.receipt_auto_print === "true") {
      const timer = setTimeout(() => window.print(), 250);
      return () => clearTimeout(timer);
    }
  }, [settings.receipt_auto_print]);
  return (
    <Modal title="វិក្កយបត្រ" onClose={onClose}>
      <div
        className="receipt"
        style={{ width: `${Number(settings.receipt_width || 80)}mm` }}
      >
        {settings.logo_url && (
          <img className="receipt-logo" src={settings.logo_url} alt="Logo" />
        )}
        <h2>{settings.business_name || "Restaurant"}</h2>
        <p>{settings.business_name_kh || "ភោជនីយដ្ឋាន"}</p>
        {settings.receipt_header && <p>{settings.receipt_header}</p>}
        {(settings.business_address_kh || settings.business_address) && (
          <p>{settings.business_address_kh || settings.business_address}</p>
        )}
        {settings.business_phone && <p>{settings.business_phone}</p>}
        {settings.receipt_show_tax_number !== "false" &&
          settings.tax_number && <p>Tax ID: {settings.tax_number}</p>}
        <hr />
        <div className="receipt-table-number">
          {tableName
            ? `លេខតុ / TABLE: ${tableName}${tableCode && tableCode !== tableName ? ` (${tableCode})` : ""}`
            : "ខ្ចប់ទៅផ្ទះ / TAKEAWAY"}
        </div>
        <div className="receipt-meta">
          <span>វិក្កយបត្រ / Receipt</span>
          <b>{data.payments?.[0]?.payment_no || order.order_no || "-"}</b>
          <span>លេខបញ្ជាទិញ / Order</span>
          <b>{order.order_no || "-"}</b>
          <span>សាខា / Branch</span>
          <b>
            {order.branch_name_kh ||
              order.branch_name ||
              `#${order.branch_id || "-"}`}
          </b>
          <span>អ្នកគិតលុយ / Cashier</span>
          <b>{order.cashier_name || "-"}</b>
          {order.customer_name && (
            <>
              <span>អតិថិជន / Customer</span>
              <b>{order.customer_name_kh || order.customer_name}</b>
            </>
          )}
          <span>កាលបរិច្ឆេទ / Date</span>
          <b>
            {new Date(
              order.closed_at || order.opened_at || Date.now(),
            ).toLocaleString("km-KH")}
          </b>
        </div>
        <hr />
        {(order.items || [])
          .filter((x) => x.kitchen_status !== "cancelled")
          .map((x) => (
            <div className="receipt-line" key={x.id}>
              <span>
                {x.item_name_kh || x.item_name} × {Number(x.quantity)}
              </span>
              <b>${Number(x.line_total).toFixed(2)}</b>
            </div>
          ))}
        <hr />
        <div className="receipt-line">
          <span>សរុបរង / Subtotal</span>
          <b>${Number(order.subtotal || 0).toFixed(2)}</b>
        </div>
        {Number(order.discount_amount) > 0 && (
          <>
            <div className="receipt-line">
              <span>
                បញ្ចុះតម្លៃ / Discount
                {order.discount_type === "percent"
                  ? ` (${Number(order.discount_value)}%)`
                  : ""}
              </span>
              <b>-${Number(order.discount_amount).toFixed(2)}</b>
            </div>
            {order.discount_reason && (
              <div className="receipt-discount-reason">
                មូលហេតុ: {order.discount_reason}
              </div>
            )}
          </>
        )}
        {Number(order.service_charge_amount) > 0 && (
          <div className="receipt-line">
            <span>ថ្លៃសេវា / Service</span>
            <b>${Number(order.service_charge_amount).toFixed(2)}</b>
          </div>
        )}
        {Number(order.tax_amount) > 0 && (
          <div className="receipt-line">
            <span>ពន្ធ / Tax</span>
            <b>${Number(order.tax_amount).toFixed(2)}</b>
          </div>
        )}
        <div className="receipt-line total">
          <span>សរុប / TOTAL</span>
          <b>
            ${Number(order.total_amount || data.paid_amount || 0).toFixed(2)}
          </b>
        </div>
        <div className="receipt-line total-khr">
          <span>សរុបជារៀល / KHR</span>
          <b>
            ៛{" "}
            {(
              Number(order.total_amount || data.paid_amount || 0) * rate
            ).toLocaleString("km-KH", { maximumFractionDigits: 0 })}
          </b>
        </div>
        <hr />
        {(data.payments || []).map((payment) => (
          <div className="receipt-line payment-method" key={payment.id}>
            <span>
              {paymentLabels[payment.method || payment.payment_method] ||
                payment.method_name ||
                payment.method ||
                payment.payment_method}
            </span>
            <b>${Number(payment.applied_amount || 0).toFixed(2)}</b>
          </div>
        ))}
        <div className="receipt-line">
          <span>បានទទួល / Paid</span>
          <b>${Number(data.paid_amount || 0).toFixed(2)}</b>
        </div>
        {Number(data.balance_amount) > 0 && (
          <div className="receipt-line">
            <span>នៅសល់ / Balance</span>
            <b>${Number(data.balance_amount).toFixed(2)}</b>
          </div>
        )}
        {Number(
          data.payments?.reduce(
            (sum, x) => sum + Number(x.change_amount || 0),
            0,
          ),
        ) > 0 && (
          <div className="receipt-line">
            <span>ប្រាក់អាប់ / Change</span>
            <b>
              $
              {data.payments
                .reduce((sum, x) => sum + Number(x.change_amount || 0), 0)
                .toFixed(2)}
            </b>
          </div>
        )}
        <p className="thanks">
          {settings.receipt_footer || "សូមអរគុណ • Thank you"}
        </p>
      </div>
      <Button onClick={() => window.print()}>
        <Printer /> បោះពុម្ព 80mm
      </Button>
    </Modal>
  );
}
