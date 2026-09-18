import { useEffect, useMemo, useState } from "react";
import { Printer, Search, ReceiptText } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { useToast } from "../contexts/ToastContext";
import {
  Button,
  DataTable,
  ErrorState,
  Loading,
  PageHeader,
  StatusBadge,
} from "../components/UI";
import { Receipt } from "./POS";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const money4 = (value) => `$${Number(value || 0).toFixed(4)}`;
const salesReportTypes = [
  "sales",
  "daily_sales",
  "hourly_sales",
  "cashier_sales",
  "special_customer_sales",
  "table_sales",
  "menu_sales",
  "profit_by_item",
  "cancelled_orders",
];
const tabs = [
  ["sales", "របាយការណ៍លក់"],
  ["daily_sales", "លក់ប្រចាំថ្ងៃ"],
  ["hourly_sales", "លក់តាមម៉ោង"],
  ["cashier_sales", "លក់តាមអ្នកគិតលុយ"],
  ["special_customer_sales", "លក់ជូនភ្ញៀវពិសេស"],
  ["table_sales", "លក់តាមតុ"],
  ["menu_sales", "លក់តាមមុខម្ហូប"],
  ["profit_by_item", "ចំណេញតាមមុខម្ហូប"],
  ["cancelled_orders", "Order បានបោះបង់"],
  ["purchases", "របាយការណ៍ទិញ"],
  ["purchase_by_supplier", "ទិញតាមអ្នកផ្គត់ផ្គង់"],
  ["expenses", "របាយការណ៍ចំណាយ"],
  ["expense_by_category", "ចំណាយតាមប្រភេទ"],
  ["payment_transactions", "ប្រតិបត្តិការទូទាត់"],
  ["cash_shifts", "របាយការណ៍វេនលក់"],
  ["low_stock", "របាយការណ៍ស្តុកទាប"],
  ["stock_movements", "ចលនាស្តុក"],
];
export default function Reports() {
  const { activeBranchId, branches, user } = useAuth();
  const { settings: globalSettings } = useAppSettings();
  const toast = useToast();
  const [type, setType] = useState("sales");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [tableId, setTableId] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [printMode, setPrintMode] = useState(null);
  const [receiptSettings, setReceiptSettings] = useState({
    khr_exchange_rate: "4100",
    receipt_width: "80",
    receipt_auto_print: "false",
  });
  useEffect(() => {
    setReceiptSettings((old) => ({ ...old, ...globalSettings }));
  }, [globalSettings]);
  async function load() {
    setLoading(true);
    setLoadError("");
    if (!activeBranchId) {
      setLoadError("សូមជ្រើសសាខាជាមុន");
      setLoading(false);
      return;
    }
    if (from > to) {
      setLoadError("កាលបរិច្ឆេទចាប់ផ្ដើមត្រូវតែមុនកាលបរិច្ឆេទបញ្ចប់");
      setLoading(false);
      return;
    }
    try {
      const r = await api.get(
        `/reports?branch_id=${activeBranchId}&from=${from}&to=${to}${tableId ? `&table_id=${tableId}` : ""}${invoiceSearch ? `&search=${encodeURIComponent(invoiceSearch)}` : ""}`,
      );
      setData(r.data.data);
    } catch (e) {
      const message = errorMessage(e);
      setLoadError(message);
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [activeBranchId]);
  useEffect(() => {
    api
      .get(`/table-operations?branch_id=${activeBranchId}`)
      .then((r) => setTables(r.data.data || []))
      .catch(() => setTables([]));
  }, [activeBranchId]);
  const current = data?.[type] || { rows: [], total: 0 };
  const rowKey = (row) => String(row.id ?? row.menu_item_id ?? row.document_no);
  const toggleRow = (row) => {
    const key = rowKey(row);
    setSelected((old) => {
      const next = new Set(old);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const toggleAll = () => {
    const keys = current.rows.map(rowKey);
    setSelected((old) =>
      keys.length && keys.every((key) => old.has(key))
        ? new Set()
        : new Set(keys),
    );
  };
  function printReport(mode) {
    if (mode === "selected" && !selected.size) {
      toast("សូមជ្រើសប្រតិបត្តិការដែលត្រូវព្រីន", "error");
      return;
    }
    setPrintMode(mode);
    window.setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 80);
  }
  function printSingle(row) {
    setSelected(new Set([rowKey(row)]));
    setPrintMode("selected");
    window.setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 80);
  }
  useEffect(() => setSelected(new Set()), [type, activeBranchId]);
  const shownRows =
    printMode === "selected"
      ? current.rows.filter((row) => selected.has(rowKey(row)))
      : current.rows;
  const shownTotal = shownRows.reduce(
    (sum, row) =>
      sum +
      Number(type === "cash_shifts" ? row.cash_sales : row.total_amount || 0),
    0,
  );
  async function reprint(row) {
    try {
      const [order, payments, settings] = await Promise.all([
        api.get(`/orders/${row.id}?branch_id=${activeBranchId}`),
        api.get(`/orders/${row.id}/payments?branch_id=${activeBranchId}`),
        api.get(`/public/settings?branch_id=${activeBranchId}`),
      ]);
      const detail = order.data.data;
      setReceiptSettings((old) => ({ ...old, ...settings.data.data }));
      setReceipt({
        order: detail,
        payments: payments.data.data || [],
        paid_amount: detail.paid_amount,
        balance_amount: detail.balance_amount,
      });
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  const columns = useMemo(() => {
    const selectColumn = {
      key: "select_row",
      className: "report-select no-print",
      label: (
        <input
          type="checkbox"
          aria-label="ជ្រើសទាំងអស់"
          checked={
            current.rows.length > 0 &&
            current.rows.every((row) => selected.has(rowKey(row)))
          }
          onChange={toggleAll}
        />
      ),
      render: (_, row) => (
        <input
          type="checkbox"
          aria-label={`ជ្រើស ${row.document_no || row.item_name || row.id}`}
          checked={selected.has(rowKey(row))}
          onChange={() => toggleRow(row)}
        />
      ),
    };
    const printRowColumn = {
      key: "print_row",
      className: "no-print",
      label: "ព្រីន",
      render: (_, row) => (
        <button className="report-reprint" onClick={() => printSingle(row)}>
          <Printer /> ព្រីន
        </button>
      ),
    };
    if (type === "daily_sales")
      return [
        selectColumn,
        {
          key: "document_date",
          label: "កាលបរិច្ឆេទ",
          render: (v) =>
            new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString(
              "km-KH",
            ),
        },
        { key: "order_count", label: "ចំនួន Order" },
        { key: "subtotal", label: "Subtotal", render: money },
        { key: "discount_amount", label: "បញ្ចុះតម្លៃ", render: money },
        { key: "tax_amount", label: "ពន្ធ", render: money },
        { key: "service_charge_amount", label: "សេវាកម្ម", render: money },
        { key: "total_amount", label: "សរុប", render: money },
        printRowColumn,
      ];
    if (type === "hourly_sales")
      return [
        selectColumn,
        { key: "hour_label", label: "ម៉ោងលក់" },
        { key: "order_count", label: "ចំនួន Order" },
        { key: "total_amount", label: "ទឹកប្រាក់លក់", render: money },
        printRowColumn,
      ];
    if (type === "cashier_sales")
      return [
        selectColumn,
        { key: "created_by_name", label: "អ្នកគិតលុយ" },
        { key: "order_count", label: "ចំនួន Order" },
        { key: "total_amount", label: "ទឹកប្រាក់លក់", render: money },
        printRowColumn,
      ];
    if (type === "special_customer_sales")
      return [
        selectColumn,
        { key: "customer_name", label: "អតិថិជន" },
        { key: "customer_type", label: "ប្រភេទភ្ញៀវ" },
        {
          key: "default_discount_percent",
          label: "បញ្ចុះលំនាំដើម",
          render: (v) => `${Number(v || 0)}%`,
        },
        { key: "order_count", label: "ចំនួន Order" },
        { key: "subtotal", label: "មុនបញ្ចុះ", render: money },
        { key: "discount_amount", label: "បានបញ្ចុះ", render: money },
        { key: "total_amount", label: "លក់សរុប", render: money },
        printRowColumn,
      ];
    if (type === "table_sales")
      return [
        selectColumn,
        { key: "table_name", label: "តុ / ប្រភេទ" },
        { key: "order_count", label: "ចំនួន Order" },
        { key: "total_amount", label: "ទឹកប្រាក់លក់", render: money },
        printRowColumn,
      ];
    if (type === "profit_by_item")
      return [
        selectColumn,
        { key: "item_name", label: "មុខម្ហូប" },
        { key: "quantity", label: "ចំនួនលក់" },
        { key: "sales_amount", label: "ការលក់", render: money },
        { key: "cost_amount", label: "ថ្លៃដើម", render: money },
        { key: "total_amount", label: "ចំណេញដុល", render: money },
        printRowColumn,
      ];
    if (type === "low_stock")
      return [
        selectColumn,
        { key: "sku", label: "SKU" },
        { key: "item_name", label: "គ្រឿងផ្សំ" },
        {
          key: "quantity_on_hand",
          label: "នៅសល់",
          render: (v, row) => `${Number(v).toFixed(2)} ${row.unit_code}`,
        },
        {
          key: "minimum_stock",
          label: "អប្បបរមា",
          render: (v, row) => `${Number(v).toFixed(2)} ${row.unit_code}`,
        },
        { key: "average_cost", label: "ថ្លៃមធ្យម", render: money4 },
        { key: "total_amount", label: "តម្លៃស្តុក", render: money },
        printRowColumn,
      ];
    if (type === "menu_sales")
      return [
        selectColumn,
        { key: "item_name", label: "មុខម្ហូប" },
        { key: "order_count", label: "ចំនួន Order" },
        {
          key: "quantity",
          label: "ចំនួនលក់",
          render: (v) => Number(v).toLocaleString(),
        },
        {
          key: "total_amount",
          label: "ទឹកប្រាក់លក់",
          render: (v) => `$${Number(v).toFixed(2)}`,
        },
        printRowColumn,
      ];
    if (type === "purchase_by_supplier")
      return [
        selectColumn,
        { key: "supplier_name", label: "អ្នកផ្គត់ផ្គង់" },
        { key: "purchase_count", label: "ចំនួនការទិញ" },
        { key: "total_amount", label: "សរុបទិញ", render: money },
        { key: "paid_amount", label: "បានបង់", render: money },
        { key: "due_amount", label: "នៅជំពាក់", render: money },
        printRowColumn,
      ];
    if (type === "expense_by_category")
      return [
        selectColumn,
        { key: "category_name", label: "ប្រភេទចំណាយ" },
        { key: "expense_count", label: "ចំនួនប្រតិបត្តិការ" },
        { key: "total_amount", label: "ចំណាយសរុប", render: money },
        printRowColumn,
      ];
    if (type === "stock_movements")
      return [
        selectColumn,
        {
          key: "document_date",
          label: "កាលបរិច្ឆេទ",
          render: (v) => new Date(v).toLocaleString("km-KH"),
        },
        { key: "sku", label: "SKU" },
        { key: "item_name", label: "គ្រឿងផ្សំ" },
        { key: "movement_type", label: "ប្រភេទចលនា" },
        {
          key: "quantity",
          label: "បរិមាណ",
          render: (v, row) => `${Number(v).toFixed(2)} ${row.unit_code}`,
        },
        {
          key: "balance_after",
          label: "សមតុល្យក្រោយ",
          render: (v, row) => `${Number(v).toFixed(2)} ${row.unit_code}`,
        },
        { key: "created_by_name", label: "អ្នកប្រតិបត្តិ" },
        printRowColumn,
      ];
    if (type === "cash_shifts")
      return [
        selectColumn,
        { key: "id", label: "លេខវេន", render: (v) => `#${v}` },
        { key: "cashier_name", label: "អ្នកគិតលុយ" },
        { key: "register_name", label: "ម៉ាស៊ីនគិតលុយ" },
        {
          key: "document_date",
          label: "ពេលបើក",
          render: (v) => new Date(v).toLocaleString("km-KH"),
        },
        {
          key: "status",
          label: "ស្ថានភាព",
          render: (v) => <StatusBadge value={v} />,
        },
        {
          key: "opening_amount",
          label: "ប្រាក់ដើមវេន",
          render: (v) => `$${Number(v).toFixed(2)}`,
        },
        {
          key: "cash_sales",
          label: "លក់សាច់ប្រាក់",
          render: (v) => `$${Number(v).toFixed(2)}`,
        },
        {
          key: "non_cash_sales",
          label: "មិនមែនសាច់ប្រាក់",
          render: (v) => `$${Number(v).toFixed(2)}`,
        },
        { key: "aba_sales", label: "QR (ABA/ACLEDA/Wing)", render: money },
        { key: "card_sales", label: "Card", render: money },
        { key: "bank_sales", label: "Bank", render: money },
        { key: "credit_sales", label: "Credit", render: money },
        {
          key: "expected_amount",
          label: "ប្រាក់រំពឹងទុក",
          render: (v, row) =>
            `$${Number(v ?? Number(row.opening_amount) + Number(row.cash_sales)).toFixed(2)}`,
        },
        {
          key: "closing_amount",
          label: "ប្រាក់រាប់បាន",
          render: (v) => (v == null ? "កំពុងបើក" : `$${Number(v).toFixed(2)}`),
        },
        {
          key: "difference_amount",
          label: "ខុសគ្នា",
          render: (v) => (v == null ? "-" : `$${Number(v).toFixed(2)}`),
        },
        printRowColumn,
      ];
    return [
      selectColumn,
      { key: "document_no", label: "លេខឯកសារ" },
      {
        key: "document_date",
        label: "កាលបរិច្ឆេទ",
        render: (v) => new Date(v).toLocaleString("km-KH"),
      },
      ...(type === "purchases"
        ? [{ key: "party_name", label: "អ្នកផ្គត់ផ្គង់" }]
        : []),
      ...(type === "expenses"
        ? [
            { key: "title", label: "បរិយាយ" },
            { key: "category_name", label: "ប្រភេទ" },
          ]
        : []),
      ...(type === "payment_transactions"
        ? [
            { key: "order_no", label: "លេខ Order" },
            {
              key: "table_name",
              label: "តុ",
              render: (v) => v || "Takeaway",
            },
            {
              key: "payment_method",
              label: "វិធីទូទាត់",
              render: (v, row) => row.payment_method_name || v,
            },
            { key: "currency_code", label: "រូបិយប័ណ្ណ" },
            { key: "reference_no", label: "លេខយោង" },
          ]
        : []),
      ...(["sales", "cancelled_orders"].includes(type)
        ? [
            {
              key: "table_name",
              label: "លេខតុ",
              render: (v) => v || "Takeaway",
            },
            { key: "order_type", label: "ប្រភេទលក់" },
            ...(type === "cancelled_orders"
              ? [
                  { key: "created_by_name", label: "អ្នកលក់" },
                  { key: "notes", label: "មូលហេតុបោះបង់" },
                ]
              : []),
          ]
        : []),
      {
        key: "status",
        label: "ស្ថានភាព",
        render: (v) => <StatusBadge value={v} />,
      },
      {
        key: "total_amount",
        label: "ចំនួនសរុប",
        render: (v) => `$${Number(v).toFixed(2)}`,
      },
      ...(type === "sales"
        ? [
            { key: "subtotal", label: "មុនបញ្ចុះ", render: money },
            { key: "discount_amount", label: "បញ្ចុះ", render: money },
            {
              key: "discount_reason",
              label: "មូលហេតុបញ្ចុះ",
              render: (value) => value || "-",
            },
            {
              key: "discount_applied_by_name",
              label: "អ្នកបញ្ចុះ",
              render: (value) => value || "-",
            },
            {
              key: "reprint",
              label: "វិក្កយបត្រ",
              render: (_, row) => (
                <button className="report-reprint" onClick={() => reprint(row)}>
                  <ReceiptText /> ព្រីនឡើងវិញ
                </button>
              ),
            },
          ]
        : []),
      ...(type !== "sales" ? [printRowColumn] : []),
    ];
  }, [type, current.rows, selected]);
  const branch = branches.find((x) => Number(x.id) === Number(activeBranchId));
  return (
    <div
      className={`report-page ${receipt ? "receipt-open" : ""} ${printMode === "selected" ? "print-selection" : ""}`}
    >
      <PageHeader title="របាយការណ៍" subtitle="លក់ • ទិញ • ចំណាយ និងបោះពុម្ព" />
      <div className="report-toolbar no-print">
        <div className="report-tabs">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              className={type === key ? "active" : ""}
              onClick={() => setType(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          ចាប់ពី
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        {salesReportTypes.includes(type) && (
          <label>
            តុ
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
            >
              <option value="">គ្រប់តុ និង Takeaway</option>
              <option value="takeaway">Takeaway / គ្មានតុ</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.name_kh || table.name} ({table.code})
                </option>
              ))}
            </select>
          </label>
        )}
        {salesReportTypes.includes(type) && (
          <label>
            លេខវិក្កយបត្រ / Order
            <input
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              placeholder="ឧ. ORD-000001"
            />
          </label>
        )}
        <label>
          ដល់
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <Button onClick={load}>
          <Search /> មើលរបាយការណ៍
        </Button>
        <Button variant="ghost" onClick={() => printReport("selected")}>
          <Printer /> ព្រីនបានជ្រើស ({selected.size})
        </Button>
        <Button variant="ghost" onClick={() => printReport("all")}>
          <Printer /> ព្រីនទាំងអស់
        </Button>
      </div>
      <section className="report-sheet">
        <div className="report-print-head">
          {globalSettings.logo_url && (
            <img
              className="report-logo"
              src={globalSettings.logo_url}
              alt="Logo"
            />
          )}
          <h2>
            {globalSettings.business_name_kh ||
              globalSettings.business_name ||
              "Restaurant"}
          </h2>
          <h3>{tabs.find((x) => x[0] === type)?.[1]}</h3>
          <p>
            {branch?.name_kh || branch?.name || user?.branch_name} • {from} ដល់{" "}
            {to}
          </p>
        </div>
        {loading ? (
          <Loading />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : (
          <>
            {type === "sales" && (
              <div className="report-mini-summary">
                <div>
                  <span>ចំនួនវិក្កយបត្រ</span>
                  <strong>{current.count || 0}</strong>
                </div>
                {(current.payment_summary || []).map((payment) => (
                  <div key={payment.payment_method}>
                    <span>
                      {payment.payment_method_name || payment.payment_method}
                    </span>
                    <strong>
                      ${Number(payment.total_amount || 0).toFixed(2)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
            <DataTable columns={columns} rows={shownRows} printable={false} />
          </>
        )}
        <div className="report-total">
          <span>
            {type === "cash_shifts" ? "សរុបការលក់សាច់ប្រាក់" : "សរុប"}
          </span>
          <strong>
            $
            {Number(
              printMode === "selected" ? shownTotal : current.total,
            ).toFixed(2)}
          </strong>
        </div>
        {type === "sales" && (
          <div className="report-net">
            <span>លទ្ធផលប្រតិបត្តិការ (លក់ − ចំណាយ)</span>
            <strong>
              ${Number(data?.net_operating_result || 0).toFixed(2)}
            </strong>
          </div>
        )}
        <div className="report-signatures">
          <span>អ្នករៀបចំ</span>
          <span>អ្នកត្រួតពិនិត្យ</span>
          <span>អ្នកអនុម័ត</span>
        </div>
      </section>
      {receipt && (
        <Receipt
          data={receipt}
          settings={{
            ...receiptSettings,
            receipt_width: "80",
            receipt_auto_print: "false",
          }}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
