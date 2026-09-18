import { useState } from "react";
import { AlertTriangle, Package } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import { useAppSettings } from "../contexts/AppSettingsContext";
import {
  DataTable,
  ErrorState,
  Loading,
  PageHeader,
  SearchBar,
  StatusBadge,
} from "../components/UI";
export default function Inventory() {
  const { activeBranchId: b } = useAuth();
  const { settings } = useAppSettings();
  const [search, setSearch] = useState("");
  const { data, loading, error, reload } = useApi(`/inventory?branch_id=${b}`);
  const rows = (data || []).filter((x) =>
    `${x.name} ${x.name_kh || ""} ${x.sku}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const low = rows.filter(
    (x) => Number(x.quantity_on_hand) <= Number(x.minimum_stock),
  );
  const cols = [
    { key: "sku", label: "SKU" },
    { key: "name", label: "គ្រឿងផ្សំ", render: (v, r) => r.name_kh || v },
    {
      key: "quantity_on_hand",
      label: "ក្នុងស្តុក",
      render: (v, r) => (
        <b>
          {Number(v).toFixed(2)} {r.unit_code}
        </b>
      ),
    },
    {
      key: "average_cost",
      label: "ថ្លៃមធ្យម",
      render: (v) => `$${Number(v).toFixed(4)}`,
    },
    {
      key: "status",
      label: "ស្ថានភាព",
      render: (_, r) => (
        <StatusBadge
          value={
            Number(r.quantity_on_hand) <= Number(r.minimum_stock)
              ? "low"
              : "active"
          }
        />
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="ស្តុកបច្ចុប្បន្ន"
        subtitle="Stock មិនអាចកែពីមុខម្ហូបបានទេ—កែតាម Purchase/Adjustment"
      />
      <div className="stats mini">
        <div className="stat">
          <span className="blue">
            <Package />
          </span>
          <div>
            <small>គ្រឿងផ្សំ</small>
            <strong>{rows.length}</strong>
          </div>
        </div>
        {settings.low_stock_alert !== "false" && (
          <div className="stat">
            <span className="orange">
              <AlertTriangle />
            </span>
            <div>
              <small>ស្តុកទាប</small>
              <strong>{low.length}</strong>
            </div>
          </div>
        )}
      </div>
      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DataTable rows={rows} columns={cols} printTitle="របាយការណ៍ស្តុក" />
      )}
    </>
  );
}
