import { useEffect, useMemo, useState } from "react";
import { Eye, Printer, Search, ShieldCheck } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  Button,
  DataTable,
  Loading,
  Modal,
  PageHeader,
} from "../components/UI";

const isoDate = (date) => date.toISOString().slice(0, 10);
const actionLabels = {
  login: "ចូលប្រើប្រាស់",
  login_failed: "ចូលមិនជោគជ័យ",
  logout: "ចាកចេញ",
  create: "បង្កើត",
  update: "កែប្រែ",
  delete: "លុប/បិទ",
  payment: "ទូទាត់",
  cancel: "បោះបង់",
  open: "បើក",
  close: "បិទ",
  change_password: "ប្ដូរពាក្យសម្ងាត់",
  reset_password: "Reset ពាក្យសម្ងាត់",
};

function jsonText(value) {
  if (!value) return "-";
  try {
    return JSON.stringify(
      typeof value === "string" ? JSON.parse(value) : value,
      null,
      2,
    );
  } catch {
    return String(value);
  }
}

export default function AuditLogs() {
  const { activeBranchId } = useAuth();
  const toast = useToast();
  const initialFrom = new Date();
  initialFrom.setDate(initialFrom.getDate() - 7);
  const [filters, setFilters] = useState({
    from: isoDate(initialFrom),
    to: isoDate(new Date()),
    user_id: "",
    action: "",
    entity_type: "",
    search: "",
  });
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [summary, setSummary] = useState({
    login_success: 0,
    login_failed: 0,
    logout_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  async function load(page = 1) {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        branch_id: activeBranchId,
        page,
        limit: 50,
        ...filters,
      });
      const response = await api.get(`/audit-logs?${query}`);
      setRows(response.data.data.items || []);
      setPagination(response.data.data.pagination);
      setSummary(response.data.data.summary || {});
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get(`/users?branch_id=${activeBranchId}`)
      .then((response) => setUsers(response.data.data || []))
      .catch(() => setUsers([]));
    load(1);
  }, [activeBranchId]);

  const columns = useMemo(
    () => [
      {
        key: "created_at",
        label: "ថ្ងៃ និងម៉ោង",
        render: (value) => new Date(value).toLocaleString("km-KH"),
      },
      {
        key: "full_name",
        label: "អ្នកប្រើប្រាស់",
        render: (value, row) => value || row.username || "Unknown/Public",
      },
      {
        key: "branch_name",
        label: "សាខា",
        render: (value, row) => row.branch_name_kh || value || "ទូទៅ",
      },
      {
        key: "action",
        label: "សកម្មភាព",
        render: (value) => (
          <span className={`audit-action action-${value}`}>
            {actionLabels[value] || value}
          </span>
        ),
      },
      { key: "entity_type", label: "Module" },
      { key: "entity_id", label: "លេខសម្គាល់" },
      { key: "ip_address", label: "IP Address" },
      {
        key: "detail",
        label: "លម្អិត",
        render: (_, row) => (
          <button className="audit-view" onClick={() => setDetail(row)}>
            <Eye /> មើល
          </button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="audit-page">
      <PageHeader
        title="ប្រវត្តិសកម្មភាពអ្នកប្រើ"
        subtitle="User Audit Log • តាមដានសកម្មភាព និងសុវត្ថិភាពប្រព័ន្ធ"
      />
      <div className="stats mini audit-login-stats">
        <div className="stat">
          <div>
            <small>Login ជោគជ័យ</small>
            <strong>{summary.login_success || 0}</strong>
          </div>
        </div>
        <div className="stat">
          <div>
            <small>Login បរាជ័យ</small>
            <strong>{summary.login_failed || 0}</strong>
          </div>
        </div>
        <div className="stat">
          <div>
            <small>Logout</small>
            <strong>{summary.logout_count || 0}</strong>
          </div>
        </div>
      </div>
      <div className="audit-filters no-print">
        <label>
          ចាប់ពី
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </label>
        <label>
          ដល់
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </label>
        <label>
          អ្នកប្រើប្រាស់
          <select
            value={filters.user_id}
            onChange={(e) =>
              setFilters({ ...filters, user_id: e.target.value })
            }
          >
            <option value="">ទាំងអស់</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name_kh || user.full_name} ({user.username})
              </option>
            ))}
          </select>
        </label>
        <label>
          សកម្មភាព
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            <option value="">ទាំងអស់</option>
            {Object.entries(actionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Module
          <select
            value={filters.entity_type}
            onChange={(e) =>
              setFilters({ ...filters, entity_type: e.target.value })
            }
          >
            <option value="">ទាំងអស់</option>
            {[
              "authentication",
              "users",
              "roles",
              "orders",
              "payments",
              "cash-sessions",
              "menuItems",
              "ingredients",
              "tables",
              "settings",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="audit-search">
          ស្វែងរក
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="ឈ្មោះ, module ឬ IP..."
          />
        </label>
        <Button onClick={() => load(1)}>
          <Search /> ស្វែងរក
        </Button>
        <Button variant="ghost" onClick={() => window.print()}>
          <Printer /> បោះពុម្ព
        </Button>
      </div>
      <section className="audit-sheet">
        <div className="audit-print-head">
          <ShieldCheck />
          <div>
            <h2>ប្រវត្តិសកម្មភាពអ្នកប្រើ / User Audit Log</h2>
            <p>
              {filters.from} ដល់ {filters.to} • សរុប {pagination.total}{" "}
              កំណត់ត្រា
            </p>
          </div>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            printTitle="ប្រវត្តិសកម្មភាពអ្នកប្រើប្រាស់"
          />
        )}
        <div className="audit-pagination no-print">
          <Button
            variant="ghost"
            disabled={pagination.page <= 1}
            onClick={() => load(pagination.page - 1)}
          >
            មុន
          </Button>
          <span>
            ទំព័រ {pagination.page} / {pagination.pages || 1}
          </span>
          <Button
            variant="ghost"
            disabled={pagination.page >= pagination.pages}
            onClick={() => load(pagination.page + 1)}
          >
            បន្ទាប់
          </Button>
        </div>
      </section>
      {detail && (
        <Modal
          title={`Audit Log #${detail.id}`}
          onClose={() => setDetail(null)}
          wide
        >
          <div className="audit-detail">
            <p>
              <b>អ្នកប្រើ៖</b>{" "}
              {detail.full_name || detail.username || "Unknown/Public"}
            </p>
            <p>
              <b>សកម្មភាព៖</b> {actionLabels[detail.action] || detail.action}
            </p>
            <p>
              <b>Module៖</b> {detail.entity_type} #{detail.entity_id || "-"}
            </p>
            <p>
              <b>IP៖</b> {detail.ip_address || "-"}
            </p>
            <p>
              <b>Browser/Device៖</b> {detail.user_agent || "-"}
            </p>
            <label>
              ទិន្នន័យមុន<pre>{jsonText(detail.old_values)}</pre>
            </label>
            <label>
              ទិន្នន័យក្រោយ / ព័ត៌មានសកម្មភាព
              <pre>{jsonText(detail.new_values)}</pre>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
