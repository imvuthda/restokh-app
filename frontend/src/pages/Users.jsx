import { useState } from "react";
import { KeyRound, Power, UserPlus } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import {
  Button,
  DataTable,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  StatusBadge,
} from "../components/UI";
export default function Users() {
  const { user, branches, activeBranchId, refreshAuth } = useAuth();
  const toast = useToast();
  const path = user.isSuperAdmin
    ? `/users?branch_id=${activeBranchId}`
    : "/users";
  const { data, loading, error, reload } = useApi(path);
  const { data: roles } = useApi("/roles");
  const [edit, setEdit] = useState(null);
  const [reset, setReset] = useState(null);
  async function save(e) {
    e.preventDefault();
    const x = Object.fromEntries(new FormData(e.currentTarget));
    const body = {
      ...x,
      role_id: Number(x.role_id),
      branch_id: x.branch_id ? Number(x.branch_id) : null,
      is_active: Number(x.is_active),
    };
    try {
      if (edit.id) await api.put(`/users/${edit.id}`, body);
      else await api.post("/users", { ...body, password: x.password });
      if (Number(edit.id) === Number(user.id)) await refreshAuth();
      toast("រក្សាទុកអ្នកប្រើប្រាស់រួច");
      setEdit(null);
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function status(row) {
    try {
      await api.patch(`/users/${row.id}/status`, {
        is_active: row.is_active ? 0 : 1,
      });
      toast(row.is_active ? "បានបិទគណនី" : "បានបើកគណនី");
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function doReset(e) {
    e.preventDefault();
    const p = new FormData(e.currentTarget).get("password");
    try {
      await api.post(`/users/${reset.id}/reset-password`, { new_password: p });
      toast("បានកំណត់ពាក្យសម្ងាត់ថ្មី និងចាកចេញគ្រប់ session");
      setReset(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  const cols = [
    { key: "username", label: "Username" },
    { key: "full_name", label: "ឈ្មោះ" },
    { key: "role_name", label: "តួនាទី" },
    {
      key: "branch_id",
      label: "សាខា",
      render: (v) =>
        branches.find((b) => b.id === v)?.name_kh ||
        branches.find((b) => b.id === v)?.name ||
        (v ? `#${v}` : "គ្រប់សាខា"),
    },
    {
      key: "last_login_at",
      label: "Login ចុងក្រោយ",
      render: (v) => (v ? new Date(v).toLocaleString() : "-"),
    },
    {
      key: "is_active",
      label: "ស្ថានភាព",
      render: (v) => <StatusBadge value={v ? "active" : "inactive"} />,
    },
    {
      key: "tools",
      label: "សកម្មភាព",
      render: (_, r) => (
        <div className="inline-tools">
          <button title="Reset password" onClick={() => setReset(r)}>
            <KeyRound />
          </button>
          <button
            title="បើក/បិទគណនី"
            className={r.is_active ? "danger" : ""}
            onClick={() => status(r)}
          >
            <Power />
          </button>
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="អ្នកប្រើប្រាស់"
        subtitle={`គណនីតាមសាខា • ${data?.length || 0} នាក់`}
        action="បន្ថែមអ្នកប្រើ"
        onAction={() => setEdit({ branch_id: activeBranchId, is_active: 1 })}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DataTable
          rows={data || []}
          columns={cols}
          onEdit={setEdit}
          printTitle="បញ្ជីអ្នកប្រើប្រាស់"
        />
      )}{" "}
      {edit && (
        <Modal
          title={edit.id ? "កែអ្នកប្រើប្រាស់" : "អ្នកប្រើថ្មី"}
          onClose={() => setEdit(null)}
        >
          <form className="form-grid" onSubmit={save}>
            <label>
              Username
              <input
                name="username"
                defaultValue={edit.username || ""}
                required
              />
            </label>
            <label>
              ឈ្មោះពេញ
              <input
                name="full_name"
                defaultValue={edit.full_name || ""}
                required
              />
            </label>
            <label>
              ឈ្មោះពេញជាភាសាខ្មែរ
              <input
                name="full_name_kh"
                defaultValue={edit.full_name_kh || ""}
              />
            </label>
            {!edit.id && (
              <label>
                Password
                <input name="password" type="password" minLength="8" required />
              </label>
            )}
            <label>
              តួនាទី
              <select name="role_id" defaultValue={edit.role_id || ""} required>
                <option value="">ជ្រើសតួនាទី</option>
                {(roles || [])
                  .filter((x) => x.is_active)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              សាខា
              <select
                name="branch_id"
                defaultValue={edit.branch_id ?? activeBranchId ?? ""}
                disabled={!user.isSuperAdmin}
              >
                {branches.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name_kh || x.name}
                  </option>
                ))}
                {user.isSuperAdmin && (
                  <option value="">គ្រប់សាខា (Super Admin)</option>
                )}
              </select>
            </label>
            <label>
              លេខបុគ្គលិក
              <input
                name="employee_code"
                defaultValue={edit.employee_code || ""}
              />
            </label>
            <label>
              ទូរស័ព្ទ
              <input name="phone" defaultValue={edit.phone || ""} />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                defaultValue={edit.email || ""}
              />
            </label>
            <label>
              ភាសា
              <select
                name="preferred_language"
                defaultValue={edit.preferred_language || "km"}
              >
                <option value="km">ខ្មែរ</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              ស្ថានភាព
              <select name="is_active" defaultValue={edit.is_active ?? 1}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </label>
            <div className="form-actions full">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEdit(null)}
              >
                បោះបង់
              </Button>
              <Button>
                <UserPlus /> រក្សាទុក
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {reset && (
        <Modal
          title={`ប្ដូរ Password — ${reset.username}`}
          onClose={() => setReset(null)}
        >
          <form onSubmit={doReset}>
            <label>
              Password ថ្មី
              <input
                name="password"
                type="password"
                minLength="8"
                required
                autoFocus
              />
            </label>
            <p className="form-note">
              ក្រោយប្ដូរ Password គណនីនេះនឹងចាកចេញពីឧបករណ៍ទាំងអស់។
            </p>
            <div className="form-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReset(null)}
              >
                បោះបង់
              </Button>
              <Button>ប្ដូរ Password</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
