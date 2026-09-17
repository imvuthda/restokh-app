import { useEffect, useMemo, useState } from "react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useApi } from "../hooks/useApi";
import {
  Confirm,
  DataTable,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  SearchBar,
  Button,
  StatusBadge,
} from "../components/UI";

const khmerUnitNames = {
  KG: "គីឡូក្រាម",
  G: "ក្រាម",
  L: "លីត្រ",
  ML: "មីលីលីត្រ",
  PCS: "ដុំ",
  BOTTLE: "ដប",
};
export default function CrudPage({ title, resource, fields, permission }) {
  const { activeBranchId, can } = useAuth();
  const toast = useToast();
  const { data: categoryData } = useApi(
    resource === "menuItems" ? "/categories?limit=200" : null,
  );
  const { data: stationData } = useApi(
    resource === "menuItems"
      ? `/stations?limit=200&branch_id=${activeBranchId}`
      : null,
  );
  const { data: unitData } = useApi(
    resource === "ingredients" ? "/units?limit=200" : null,
  );
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null);
  const [skuPreview, setSkuPreview] = useState("");
  const [remove, setRemove] = useState(null);
  const branch = [
    "branches",
    "categories",
    "menuItems",
    "ingredients",
    "suppliers",
    "customers",
  ].includes(resource)
    ? ""
    : `&branch_id=${activeBranchId}`;
  const { data, loading, error, reload } = useApi(
    `/${resource}?limit=100&search=${encodeURIComponent(search)}${branch}`,
    [search],
  );
  const rows = Array.isArray(data) ? data : data?.items || [];
  useEffect(() => {
    if (!edit || edit.id || !["menuItems", "ingredients"].includes(resource)) {
      setSkuPreview("");
      return;
    }
    const type = resource === "menuItems" ? "menu_item" : "ingredient";
    api
      .get(`/sku-preview/${type}`)
      .then((response) => setSkuPreview(response.data.data.sku))
      .catch(() =>
        setSkuPreview(resource === "menuItems" ? "MI-AUTO" : "ING-AUTO"),
      );
  }, [edit, resource]);
  const lookups = useMemo(
    () => ({
      category: (categoryData?.items || []).map((x) => [
        x.id,
        x.name_kh || x.name,
      ]),
      station: (stationData?.items || []).map((x) => [
        x.id,
        x.name_kh || x.name,
      ]),
      unit: (unitData?.items || []).map((x) => [
        x.id,
        `${khmerUnitNames[String(x.code).toUpperCase()] || x.name_kh || x.name} (${x.code})`,
      ]),
    }),
    [categoryData, stationData, unitData],
  );
  const columns = useMemo(
    () => [
      ...fields.slice(0, 6).map(([key, label, type, options]) => ({
        key,
        label,
        render:
          key === "is_active"
            ? (v) => <StatusBadge value={v ? "active" : "inactive"} />
            : ["category", "station", "unit"].includes(type)
              ? (v) =>
                  lookups[type]?.find(
                    ([id]) => Number(id) === Number(v),
                  )?.[1] || `#${v}`
              : type === "select"
                ? (v) => options?.find(([value]) => value === v)?.[1] || v
                : undefined,
      })),
      {
        key: "is_active",
        label: "ស្ថានភាព",
        render: (v) => <StatusBadge value={v === 0 ? "inactive" : "active"} />,
      },
    ],
    [fields, lookups],
  );
  async function save(e) {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const body = Object.fromEntries(formData);
      if (["areas", "shapes"].includes(resource))
        body.branch_id = Number(activeBranchId);
      const imageFile = formData.get("image");
      if (imageFile instanceof File && imageFile.size) {
        const upload = new FormData();
        upload.append("image", imageFile);
        const uploaded = await api.post("/menu-images", upload);
        body.image = uploaded.data.data.url;
      } else if (edit?.image) body.image = edit.image;
      else delete body.image;
      fields.forEach(([k, , type]) => {
        if (
          (["number", "category", "station", "unit"].includes(type) ||
            ["is_active", "is_head_office"].includes(k)) &&
          body[k] !== ""
        )
          body[k] = Number(body[k]);
      });
      edit?.id
        ? await api.put(`/${resource}/${edit.id}`, body)
        : await api.post(`/${resource}`, { ...body, is_active: 1 });
      toast("រក្សាទុកបានជោគជ័យ");
      setEdit(null);
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function del() {
    try {
      const response = await api.delete(`/${resource}/${remove.id}`);
      toast(
        response.data.message === "Record deleted"
          ? "បានលុបជោគជ័យ"
          : "ទិន្នន័យកំពុងប្រើ—បានបិទដោយសុវត្ថិភាព",
      );
      setRemove(null);
      reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  return (
    <>
      <PageHeader
        title={title}
        subtitle={`គ្រប់គ្រង${title} និងស្វែងរកទិន្នន័យ`}
        action={can(permission) ? `បន្ថែម${title}` : null}
        onAction={() => setEdit({})}
      />
      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          printTitle={title}
          onEdit={can(permission) ? setEdit : null}
          onDelete={can(permission) ? setRemove : null}
        />
      )}{" "}
      {edit && (
        <Modal
          title={`${edit.id ? "កែប្រែ" : "បន្ថែម"}${title}`}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save} className="form-grid">
            {fields.map(([key, label, type = "text", options]) => (
              <label key={key}>
                {label}
                {type === "image" ? (
                  <div className="image-upload-field">
                    {edit?.image && <img src={edit.image} alt="រូបមុខម្ហូប" />}
                    <input
                      name={key}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                    />
                    <small>JPG, PNG ឬ WebP • អតិបរមា 5MB</small>
                  </div>
                ) : key === "sku" &&
                  ["menuItems", "ingredients"].includes(resource) ? (
                  <div className="sku-auto-field">
                    {edit.id ? (
                      <input
                        name={key}
                        defaultValue={edit[key] ?? ""}
                        maxLength={60}
                      />
                    ) : (
                      <>
                        <input name={key} type="hidden" value="" />
                        <input
                          value={skuPreview || "កំពុងបង្កើតលេខ..."}
                          readOnly
                          aria-label="SKU បង្កើតស្វ័យប្រវត្តិ"
                        />
                      </>
                    )}
                    {!edit.id && <span className="sku-auto-badge">AUTO</span>}
                    <small>
                      លេខនេះជា Preview • ប្រព័ន្ធបញ្ជាក់លេខមិនស្ទួនពេលរក្សាទុក
                    </small>
                  </div>
                ) : ["category", "station", "unit"].includes(type) ? (
                  <select name={key} defaultValue={edit[key] ?? ""} required>
                    <option value="">ជ្រើសរើស{label}</option>
                    {(lookups[type] || []).map(([value, text]) => (
                      <option value={value} key={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                ) : type === "select" ? (
                  <select
                    name={key}
                    defaultValue={edit[key] ?? options?.[0]?.[0] ?? ""}
                  >
                    {(options || []).map(([value, text]) => (
                      <option value={value} key={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={key}
                    type={type}
                    defaultValue={edit[key] ?? ""}
                    required={["code", "name"].includes(key)}
                  />
                )}
              </label>
            ))}
            <div className="form-actions full">
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
      {remove && (
        <Confirm
          message={`តើចង់បិទ ${remove.name || remove.code} មែនទេ?`}
          onNo={() => setRemove(null)}
          onYes={del}
        />
      )}
    </>
  );
}
