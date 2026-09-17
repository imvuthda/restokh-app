import { useMemo, useState } from "react";
import api, { errorMessage } from "../api/client";
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
export default function Roles() {
  const toast = useToast();
  const { data: roles, loading, error, reload } = useApi("/roles");
  const { data: permissions } = useApi("/permissions");
  const [edit, setEdit] = useState(null);
  const [selected, setSelected] = useState([]);
  const groups = useMemo(
    () =>
      Object.groupBy?.(permissions || [], (x) => x.module) ||
      group(permissions || []),
    [permissions],
  );
  async function open(role = {}) {
    if (role.id) {
      try {
        const r = await api.get(`/roles/${role.id}`);
        setEdit(r.data.data);
        setSelected(r.data.data.permission_ids || []);
      } catch (e) {
        toast(errorMessage(e), "error");
      }
    } else {
      setEdit({});
      setSelected([]);
    }
  }
  async function save(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      let id = edit.id;
      if (id)
        await api.put(`/roles/${id}`, {
          name: f.name,
          description: f.description,
          is_active: Number(f.is_active),
        });
      else {
        id = (
          await api.post("/roles", {
            code: f.code,
            name: f.name,
            description: f.description,
          })
        ).data.data.id;
      }
      await api.put(`/roles/${id}/permissions`, { permission_ids: selected });
      toast("រក្សាទុកតួនាទី និងសិទ្ធិរួច");
      setEdit(null);
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  const cols = [
    { key: "code", label: "Code" },
    { key: "name", label: "តួនាទី" },
    { key: "description", label: "ការពិពណ៌នា" },
    { key: "permission_count", label: "ចំនួនសិទ្ធិ" },
    {
      key: "is_active",
      label: "ស្ថានភាព",
      render: (v) => <StatusBadge value={v ? "active" : "inactive"} />,
    },
  ];
  return (
    <>
      <PageHeader
        title="តួនាទី និងសិទ្ធិ"
        subtitle="កំណត់មុខងារដែល Cashier, Waiter, Kitchen និង Manager អាចប្រើ"
        action="បន្ថែមតួនាទី"
        onAction={() => open()}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DataTable
          rows={roles || []}
          columns={cols}
          onEdit={open}
          printTitle="តួនាទី និងសិទ្ធិ"
        />
      )}{" "}
      {edit && (
        <Modal
          title={edit.id ? "កែតួនាទី" : "តួនាទីថ្មី"}
          onClose={() => setEdit(null)}
          wide
        >
          <form onSubmit={save} className="role-form">
            <div className="role-fields">
              <label>
                Code
                <input
                  name="code"
                  defaultValue={edit.code || ""}
                  disabled={Boolean(edit.id)}
                  required
                />
              </label>
              <label>
                ឈ្មោះតួនាទី
                <input name="name" defaultValue={edit.name || ""} required />
              </label>
              <label>
                ស្ថានភាព
                <select name="is_active" defaultValue={edit.is_active ?? 1}>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </label>
              <label className="full">
                ការពិពណ៌នា
                <input
                  name="description"
                  defaultValue={edit.description || ""}
                />
              </label>
            </div>
            <div className="permission-toolbar">
              <b>
                សិទ្ធិប្រើប្រាស់ ({selected.length}/{(permissions || []).length}
                )
              </b>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setSelected((permissions || []).map((x) => x.id))
                  }
                >
                  ជ្រើសទាំងអស់
                </button>
                <button type="button" onClick={() => setSelected([])}>
                  ដកទាំងអស់
                </button>
              </div>
            </div>
            <div className="permission-list">
              {Object.entries(groups).map(([module, items]) => (
                <section key={module}>
                  <header>
                    <label>
                      <input
                        type="checkbox"
                        checked={items.every((x) => selected.includes(x.id))}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked
                              ? [...new Set([...s, ...items.map((x) => x.id)])]
                              : s.filter(
                                  (id) => !items.some((x) => x.id === id),
                                ),
                          )
                        }
                      />
                      <b>{module}</b>
                    </label>
                  </header>
                  <div>
                    {items.map((p) => (
                      <label key={p.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          onChange={(e) =>
                            setSelected((s) =>
                              e.target.checked
                                ? [...s, p.id]
                                : s.filter((id) => id !== p.id),
                            )
                          }
                        />
                        <span>{p.name}</span>
                        <small>{p.code}</small>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="sticky-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEdit(null)}
              >
                បោះបង់
              </Button>
              <Button>រក្សាទុក</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function group(items) {
  return items.reduce((a, x) => ((a[x.module] ??= []).push(x), a), {});
}
