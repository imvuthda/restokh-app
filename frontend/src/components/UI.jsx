import { Component, useState } from "react";
import {
  AlertTriangle,
  Search,
  Plus,
  X,
  Trash2,
  Pencil,
  Printer,
  RefreshCw,
} from "lucide-react";
export const Button = ({ children, variant = "", ...p }) => (
  <button className={`btn ${variant}`} {...p}>
    {children}
  </button>
);
export const StatusBadge = ({ value }) => (
  <span className={`badge status-${value}`}>
    {String(value || "-").replaceAll("_", " ")}
  </span>
);
export function PageHeader({ title, subtitle, action, onAction }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <Button onClick={onAction}>
          <Plus /> {action}
        </Button>
      )}
    </div>
  );
}
export function SearchBar({ value, onChange, placeholder = "ស្វែងរក..." }) {
  return (
    <label className="search">
      <Search />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>កំពុងទាញទិន្នន័យ...</span>
    </div>
  );
}
export function Empty({ text = "មិនមានទិន្នន័យ" }) {
  return <div className="empty">{text}</div>;
}
export function ErrorState({ message = "មិនអាចទាញទិន្នន័យបាន", onRetry }) {
  return (
    <div className="error-state" role="alert">
      <span>
        <AlertTriangle />
      </span>
      <div>
        <strong>មានបញ្ហាក្នុងការទាញទិន្នន័យ</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          <RefreshCw /> ព្យាយាមម្ដងទៀត
        </Button>
      )}
    </div>
  );
}
export class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Application render error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal-error" role="alert">
        <div>
          <AlertTriangle />
          <h1>ទំព័រនេះមានបញ្ហា</h1>
          <p>
            សូមផ្ទុកទំព័រឡើងវិញ។ ទិន្នន័យប្រតិបត្តិការរបស់អ្នកមិនត្រូវបានលុបទេ។
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw /> ផ្ទុកឡើងវិញ
          </Button>
        </div>
      </div>
    );
  }
}
export function Modal({ title, children, onClose, wide = false }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`modal ${wide ? "wide" : ""}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function DataTable({
  columns,
  rows = [],
  onEdit,
  onDelete,
  printable = true,
  printTitle = "ទិន្នន័យប្រតិបត្តិការ",
}) {
  const [selected, setSelected] = useState(new Set());
  const [printMode, setPrintMode] = useState(null);
  const keyOf = (row, index) => String(row.id ?? row.code ?? index);
  const allSelected =
    rows.length > 0 &&
    rows.every((row, index) => selected.has(keyOf(row, index)));
  const toggleAll = () =>
    setSelected(
      allSelected
        ? new Set()
        : new Set(rows.map((row, index) => keyOf(row, index))),
    );
  const toggle = (row, index) => {
    const key = keyOf(row, index);
    setSelected((old) => {
      const next = new Set(old);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const print = (mode, row = null, index = 0) => {
    if (mode === "selected" && !selected.size) return;
    if (mode === "row") setSelected(new Set([keyOf(row, index)]));
    setPrintMode(mode === "row" ? "selected" : mode);
    window.setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 80);
  };
  const visibleRows =
    printMode === "selected"
      ? rows.filter((row, index) => selected.has(keyOf(row, index)))
      : rows;
  return (
    <div className={`data-print-sheet ${printMode ? "data-print-active" : ""}`}>
      {printable && (
        <div className="data-print-toolbar no-print">
          <Button
            variant="ghost"
            disabled={!selected.size}
            onClick={() => print("selected")}
          >
            <Printer /> ព្រីនបានជ្រើស ({selected.size})
          </Button>
          <Button
            variant="ghost"
            disabled={!rows.length}
            onClick={() => print("all")}
          >
            <Printer /> ព្រីនទាំងអស់
          </Button>
        </div>
      )}
      <div className="data-print-heading">
        <h2>{printTitle}</h2>
        <p>{new Date().toLocaleString("km-KH")}</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {printable && (
                <th className="data-select no-print">
                  <input
                    type="checkbox"
                    aria-label="ជ្រើសទាំងអស់"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={c.className || ""}>
                  {c.label}
                </th>
              ))}
              {(onEdit || onDelete) && <th className="no-print">សកម្មភាព</th>}
              {printable && <th className="no-print">ព្រីន</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <tr key={keyOf(r, i)}>
                {printable && (
                  <td className="data-select no-print">
                    <input
                      type="checkbox"
                      aria-label="ជ្រើសជួរ"
                      checked={selected.has(keyOf(r, i))}
                      onChange={() => toggle(r, i)}
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={c.className || ""}>
                    {c.render ? c.render(r[c.key], r) : (r[c.key] ?? "-")}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="actions no-print">
                    {onEdit && (
                      <button onClick={() => onEdit(r)}>
                        <Pencil />
                      </button>
                    )}
                    {onDelete && (
                      <button className="danger" onClick={() => onDelete(r)}>
                        <Trash2 />
                      </button>
                    )}
                  </td>
                )}
                {printable && (
                  <td className="no-print">
                    <button
                      className="data-row-print"
                      onClick={() => print("row", r, i)}
                    >
                      <Printer /> ព្រីន
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
    </div>
  );
}
export function Confirm({ message, onYes, onNo }) {
  return (
    <Modal title="បញ្ជាក់" onClose={onNo}>
      <p>{message}</p>
      <div className="form-actions">
        <Button variant="ghost" onClick={onNo}>
          បោះបង់
        </Button>
        <Button variant="danger" onClick={onYes}>
          បញ្ជាក់
        </Button>
      </div>
    </Modal>
  );
}
