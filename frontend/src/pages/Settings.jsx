import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Coins,
  MonitorCog,
  Printer,
  Save,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { Button, Loading, PageHeader } from "../components/UI";

const sections = [
  {
    key: "business",
    label: "ព័ត៌មានហាង",
    icon: Building2,
    fields: [
      ["business_name", "ឈ្មោះភោជនីយដ្ឋាន (English)", "text"],
      ["business_name_kh", "ឈ្មោះភោជនីយដ្ឋាន (ខ្មែរ)", "text"],
      ["business_phone", "លេខទូរស័ព្ទ", "tel"],
      ["business_email", "អ៊ីមែល", "email"],
      ["business_address", "អាសយដ្ឋាន English", "textarea"],
      ["business_address_kh", "អាសយដ្ឋានខ្មែរ", "textarea"],
      ["tax_number", "លេខអត្តសញ្ញាណកម្មសារពើពន្ធ", "text"],
      ["logo_url", "Logo ភោជនីយដ្ឋាន", "image"],
    ],
  },
  {
    key: "currency",
    label: "រូបិយប័ណ្ណ",
    icon: Coins,
    fields: [
      ["base_currency", "រូបិយប័ណ្ណគោល", "select", [["USD", "USD — ដុល្លារ"]]],
      [
        "secondary_currency",
        "រូបិយប័ណ្ណទីពីរ",
        "select",
        [["KHR", "KHR — រៀល"]],
      ],
      ["khr_exchange_rate", "អត្រាប្ដូរ 1 USD = KHR", "number", null, "4100"],
      [
        "currency_rounding",
        "បង្គត់ប្រាក់ KHR",
        "select",
        [
          ["100", "100៛"],
          ["500", "500៛"],
          ["1000", "1,000៛"],
        ],
      ],
    ],
  },
  {
    key: "pos",
    label: "POS និងការទូទាត់",
    icon: MonitorCog,
    fields: [
      ["service_charge_rate", "Service Charge (%)", "number", null, "0"],
      ["tax_rate", "អត្រាពន្ធ (%)", "number", null, "0"],
      ["require_cash_shift", "តម្រូវឲ្យបើក Cash Shift", "boolean"],
      ["allow_split_payment", "អនុញ្ញាត Split Payment", "boolean"],
      ["allow_price_override", "អនុញ្ញាតកែតម្លៃក្នុង POS", "boolean"],
    ],
  },
  {
    key: "receipt",
    label: "វិក្កយបត្រ",
    icon: Printer,
    fields: [
      [
        "receipt_width",
        "ទំហំក្រដាស",
        "select",
        [
          ["80", "80 mm"],
          ["58", "58 mm"],
        ],
      ],
      ["receipt_header", "អត្ថបទក្បាលវិក្កយបត្រ", "textarea"],
      ["receipt_footer", "អត្ថបទបាតវិក្កយបត្រ", "textarea"],
      ["receipt_show_tax_number", "បង្ហាញលេខអាករ", "boolean"],
      ["receipt_auto_print", "បោះពុម្ពក្រោយទូទាត់ស្វ័យប្រវត្តិ", "boolean"],
    ],
  },
  {
    key: "inventory",
    label: "ស្តុក",
    icon: Warehouse,
    fields: [
      ["allow_negative_stock", "អនុញ្ញាតស្តុកអវិជ្ជមាន", "boolean"],
      ["low_stock_alert", "ជូនដំណឹងពេលស្តុកទាប", "boolean"],
    ],
  },
  {
    key: "display",
    label: "ភាសា និងរូបរាង",
    icon: MonitorCog,
    fields: [
      [
        "default_language",
        "ភាសាលំនាំដើម",
        "select",
        [
          ["km", "ខ្មែរ"],
          ["en", "English"],
        ],
      ],
      [
        "timezone",
        "តំបន់ម៉ោង",
        "select",
        [["Asia/Phnom_Penh", "Asia/Phnom_Penh"]],
      ],
      ["primary_color", "ពណ៌ប្រព័ន្ធ", "color"],
      [
        "theme_mode",
        "Theme",
        "select",
        [
          ["light", "Light"],
          ["system", "តាមឧបករណ៍"],
        ],
      ],
    ],
  },
  {
    key: "security",
    label: "សុវត្ថិភាព",
    icon: ShieldCheck,
    fields: [
      ["maintenance_mode", "Maintenance Mode", "boolean"],
      [
        "session_timeout_minutes",
        "Session Timeout (នាទី)",
        "number",
        null,
        "480",
      ],
    ],
  },
];
const defaults = {
  base_currency: "USD",
  secondary_currency: "KHR",
  khr_exchange_rate: "4100",
  currency_rounding: "100",
  require_cash_shift: "true",
  allow_split_payment: "true",
  allow_price_override: "false",
  receipt_width: "80",
  receipt_show_tax_number: "true",
  receipt_auto_print: "false",
  allow_negative_stock: "false",
  low_stock_alert: "true",
  default_language: "km",
  timezone: "Asia/Phnom_Penh",
  primary_color: "#b91c1c",
  theme_mode: "light",
  maintenance_mode: "false",
  session_timeout_minutes: "480",
};

export default function Settings() {
  const { user, activeBranchId, branches } = useAuth();
  const toast = useToast();
  const { refreshSettings } = useAppSettings();
  const [tab, setTab] = useState("business");
  const [scope, setScope] = useState("branch");
  const [values, setValues] = useState(null);
  const branch = branches.find((x) => Number(x.id) === Number(activeBranchId));
  async function load() {
    setValues(null);
    try {
      const rows = (await api.get(`/settings?branch_id=${activeBranchId}`)).data
        .data;
      const selected =
        scope === "global" ? rows.filter((x) => x.branch_id == null) : rows;
      setValues({
        ...defaults,
        ...Object.fromEntries(
          selected.map((x) => [x.setting_key, x.setting_value]),
        ),
      });
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  useEffect(() => {
    load();
  }, [activeBranchId, scope]);
  const current = useMemo(() => sections.find((x) => x.key === tab), [tab]);
  async function save(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = { ...values };
    try {
      for (const [key, , type] of current.fields) {
        if (type === "boolean") next[key] = String(form.has(key));
        else if (type === "image") {
          const file = form.get(key);
          if (file instanceof File && file.size) {
            const upload = new FormData();
            upload.append("logo", file);
            const response = await api.post("/setting-logo", upload);
            next[key] = response.data.data.url;
          }
        } else next[key] = String(form.get(key) ?? "");
      }
      await api.put("/settings/batch", {
        branch_id: activeBranchId,
        scope,
        settings: current.fields.map(([key]) => ({ key, value: next[key] })),
      });
      setValues(next);
      await refreshSettings();
      toast(`រក្សាទុក ${current.label} បានជោគជ័យ`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  if (!values) return <Loading />;
  return (
    <div className="system-settings">
      <PageHeader
        title="ការកំណត់ប្រព័ន្ធ"
        subtitle="គ្រប់គ្រងព័ត៌មានហាង POS រូបិយប័ណ្ណ វិក្កយបត្រ និងសុវត្ថិភាព"
      />
      <div className="settings-scope">
        <div>
          <b>ទីតាំងការកំណត់</b>
          <small>
            {scope === "global"
              ? "ប្រើជាលំនាំដើមសម្រាប់គ្រប់សាខា"
              : `ការកំណត់សម្រាប់ ${branch?.name_kh || branch?.name || "សាខាបច្ចុប្បន្ន"}`}
          </small>
        </div>
        {user.isSuperAdmin && (
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="branch">សាខាបច្ចុប្បន្ន</option>
            <option value="global">Global — គ្រប់សាខា</option>
          </select>
        )}
      </div>
      <div className="settings-layout">
        <aside className="settings-tabs">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.key}
                className={tab === section.key ? "active" : ""}
                onClick={() => setTab(section.key)}
              >
                <Icon />
                <span>{section.label}</span>
              </button>
            );
          })}
        </aside>
        <form className="settings-card" onSubmit={save} key={`${scope}-${tab}`}>
          <div className="settings-card-head">
            <div>
              <h3>{current.label}</h3>
              <p>កែប្រែហើយចុចរក្សាទុកសម្រាប់ផ្នែកនេះ</p>
            </div>
          </div>
          <div className="settings-fields">
            {current.fields.map(([key, label, type, options, placeholder]) => (
              <SettingField
                key={key}
                name={key}
                label={label}
                type={type}
                options={options}
                value={values[key] ?? ""}
                placeholder={placeholder}
              />
            ))}
          </div>
          <div className="settings-save">
            <Button>
              <Save /> រក្សាទុកការកំណត់
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SettingField({ name, label, type, options, value, placeholder }) {
  if (type === "boolean")
    return (
      <label className="setting-toggle">
        <span>
          <b>{label}</b>
          <small>{value === "true" ? "កំពុងបើក" : "កំពុងបិទ"}</small>
        </span>
        <input name={name} type="checkbox" defaultChecked={value === "true"} />
        <i />
      </label>
    );
  if (type === "image")
    return (
      <label className="setting-wide">
        <span>{label}</span>
        <div className="setting-logo-upload">
          {value ? (
            <img src={value} alt="Logo ភោជនីយដ្ឋាន" />
          ) : (
            <div className="logo-empty">មិនទាន់មាន Logo</div>
          )}
          <input
            name={name}
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <small>JPG, PNG ឬ WebP • អតិបរមា 5MB</small>
        </div>
      </label>
    );
  return (
    <label className={type === "textarea" ? "setting-wide" : ""}>
      <span>{label}</span>
      {type === "select" ? (
        <select name={name} defaultValue={value}>
          {options.map(([v, text]) => (
            <option value={v} key={v}>
              {text}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea name={name} defaultValue={value} placeholder={placeholder} />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          placeholder={placeholder}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "0.01" : undefined}
        />
      )}
    </label>
  );
}
