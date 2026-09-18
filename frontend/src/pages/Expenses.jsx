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
export default function Expenses() {
  const { activeBranchId: b } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/expenses?branch_id=${b}`);
  const { data: cats } = useApi("/expenseCategories?limit=100");
  const { data: methodData } = useApi(
    `/paymentMethods?branch_id=${b}&limit=100&is_active=1`,
  );
  const [open, setOpen] = useState(false);
  async function save(e) {
    e.preventDefault();
    const x = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api.post("/expenses", {
        ...x,
        branch_id: b,
        amount: Number(x.amount),
        exchange_rate: x.currency_code === "KHR" ? 4100 : 1,
        status: "paid",
      });
      toast("បានកត់ត្រាចំណាយ");
      setOpen(false);
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  const cols = [
    { key: "expense_no", label: "លេខចំណាយ" },
    { key: "title", label: "បរិយាយ" },
    { key: "category_name", label: "ប្រភេទ" },
    {
      key: "expense_date",
      label: "កាលបរិច្ឆេទ",
      render: (v) => new Date(v).toLocaleDateString(),
    },
    {
      key: "base_amount",
      label: "USD",
      render: (v) => `$${Number(v).toFixed(2)}`,
    },
    {
      key: "status",
      label: "ស្ថានភាព",
      render: (v) => <StatusBadge value={v} />,
    },
  ];
  return (
    <>
      <PageHeader
        title="ចំណាយ"
        subtitle="គ្រប់គ្រងចំណាយប្រចាំថ្ងៃ"
        action="បន្ថែមចំណាយ"
        onAction={() => setOpen(true)}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DataTable rows={data || []} columns={cols} printTitle="បញ្ជីចំណាយ" />
      )}{" "}
      {open && (
        <Modal title="ចំណាយថ្មី" onClose={() => setOpen(false)}>
          <form className="form-grid" onSubmit={save}>
            <label>
              ប្រភេទ
              <select name="category_id" required>
                {(cats?.items || []).map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.name_kh || x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ចំណងជើង
              <input name="title" required />
            </label>
            <label>
              ចំនួនប្រាក់
              <input name="amount" type="number" step="0.01" required />
            </label>
            <label>
              រូបិយប័ណ្ណ
              <select name="currency_code">
                <option>USD</option>
                <option>KHR</option>
              </select>
            </label>
            <label>
              វិធីបង់
              <select name="payment_method">
                {(methodData?.items || [])
                  .filter((method) => method.method_type !== "credit")
                  .map((method) => (
                    <option value={method.code} key={method.id}>
                      {method.name_kh || method.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              លេខយោង
              <input name="reference_no" />
            </label>
            <label className="full">
              ពិពណ៌នា
              <textarea name="description" />
            </label>
            <div className="form-actions full">
              <Button>រក្សាទុក</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
