import { useState } from "react";
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
export default function Purchases() {
  const { activeBranchId: b } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/purchases?branch_id=${b}`);
  const { suppliers, ingredients } = useMasters();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    { ingredient_id: "", ordered_quantity: 1, unit_cost: 0 },
  ]);
  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api.post("/purchases", {
        branch_id: b,
        supplier_id: f.get("supplier_id"),
        notes: f.get("notes"),
        items,
      });
      toast("បានបង្កើតការទិញ");
      setOpen(false);
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function receive(x) {
    try {
      await api.post(`/purchases/${x.id}/receive`, { branch_id: b });
      toast("ទទួលទំនិញ និងបន្ថែមស្តុករួច");
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  const cols = [
    { key: "purchase_no", label: "លេខទិញ" },
    { key: "supplier_name", label: "អ្នកផ្គត់ផ្គង់" },
    {
      key: "purchase_date",
      label: "កាលបរិច្ឆេទ",
      render: (v) => new Date(v).toLocaleDateString(),
    },
    {
      key: "total_amount",
      label: "សរុប",
      render: (v) => `$${Number(v).toFixed(2)}`,
    },
    {
      key: "status",
      label: "ស្ថានភាព",
      render: (v) => <StatusBadge value={v} />,
    },
    {
      key: "receive",
      label: "",
      render: (_, r) =>
        !["received", "cancelled"].includes(r.status) && (
          <Button onClick={() => receive(r)}>ទទួលទំនិញ</Button>
        ),
    },
  ];
  return (
    <>
      <PageHeader
        title="ការទិញទំនិញ"
        subtitle="បង្កើត Purchase និង Receive ចូលស្តុក"
        action="បង្កើតការទិញ"
        onAction={() => setOpen(true)}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DataTable columns={cols} rows={data || []} printTitle="បញ្ជីការទិញ" />
      )}{" "}
      {open && (
        <Modal title="ការទិញថ្មី" wide onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <label>
              អ្នកផ្គត់ផ្គង់
              <select name="supplier_id" required>
                <option value="">ជ្រើសរើស</option>
                {suppliers.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="line-editor">
              {items.map((x, i) => (
                <div key={i}>
                  <select
                    value={x.ingredient_id}
                    onChange={(e) =>
                      setItems((a) =>
                        a.map((v, j) =>
                          j === i ? { ...v, ingredient_id: e.target.value } : v,
                        ),
                      )
                    }
                  >
                    <option value="">គ្រឿងផ្សំ</option>
                    {ingredients.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={x.ordered_quantity}
                    onChange={(e) =>
                      setItems((a) =>
                        a.map((v, j) =>
                          j === i
                            ? { ...v, ordered_quantity: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={x.unit_cost}
                    onChange={(e) =>
                      setItems((a) =>
                        a.map((v, j) =>
                          j === i
                            ? { ...v, unit_cost: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setItems((a) => [
                  ...a,
                  { ingredient_id: "", ordered_quantity: 1, unit_cost: 0 },
                ])
              }
            >
              + បន្ថែមជួរ
            </Button>
            <label>
              កំណត់ចំណាំ
              <textarea name="notes" />
            </label>
            <div className="form-actions">
              <Button>រក្សាទុក</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function useMasters() {
  const { s: data } = { s: useApi("/suppliers?limit=100").data };
  const { i: data2 } = { i: useApi("/ingredients?limit=100").data };
  return { suppliers: data?.items || [], ingredients: data2?.items || [] };
}
