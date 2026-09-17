import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CrudPage from "./pages/CrudPage";
import Tables from "./pages/Tables";
import POS from "./pages/POS";
import Kitchen from "./pages/Kitchen";
import Inventory from "./pages/Inventory";
import Purchases from "./pages/Purchases";
import Expenses from "./pages/Expenses";
import Reservations from "./pages/Reservations";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import Reports from "./pages/Reports";
import AuditLogs from "./pages/AuditLogs";
const crud = {
  branches: {
    title: "សាខា",
    resource: "branches",
    permission: "branches.manage",
    fields: [
      ["code", "លេខកូដ"],
      ["name", "ឈ្មោះ"],
      ["name_kh", "ឈ្មោះខ្មែរ"],
      ["phone", "ទូរស័ព្ទ"],
      ["email", "អ៊ីមែល", "email"],
      ["address", "អាសយដ្ឋាន"],
      ["address_kh", "អាសយដ្ឋានខ្មែរ"],
      ["tax_number", "លេខអាករ"],
      [
        "currency_code",
        "រូបិយប័ណ្ណ",
        "select",
        [
          ["USD", "USD"],
          ["KHR", "KHR"],
        ],
      ],
      [
        "timezone",
        "តំបន់ម៉ោង",
        "select",
        [["Asia/Phnom_Penh", "Asia/Phnom_Penh"]],
      ],
      [
        "is_head_office",
        "ការិយាល័យកណ្ដាល",
        "select",
        [
          [0, "ទេ"],
          [1, "បាទ/ចាស"],
        ],
      ],
      [
        "is_active",
        "ស្ថានភាព",
        "select",
        [
          [1, "កំពុងប្រើ"],
          [0, "ផ្អាក"],
        ],
      ],
    ],
  },
  categories: {
    title: "ប្រភេទម្ហូប",
    resource: "categories",
    permission: "menu.manage",
    fields: [
      ["code", "លេខកូដ"],
      ["name", "ឈ្មោះ"],
      ["name_kh", "ឈ្មោះខ្មែរ"],
      ["color", "ពណ៌"],
    ],
  },
  areas: {
    title: "តំបន់តុ",
    resource: "areas",
    permission: "tables.manage",
    fields: [
      ["code", "លេខកូដតំបន់"],
      ["name", "ឈ្មោះតំបន់"],
      ["name_kh", "ឈ្មោះជាភាសាខ្មែរ"],
      ["sort_order", "លំដាប់បង្ហាញ", "number"],
      [
        "is_active",
        "ស្ថានភាព",
        "select",
        [
          [1, "កំពុងប្រើ"],
          [0, "ផ្អាក"],
        ],
      ],
    ],
  },
  shapes: {
    title: "រាងតុ",
    resource: "shapes",
    permission: "tables.manage",
    fields: [
      ["code", "លេខកូដរាង"],
      ["name", "ឈ្មោះ English"],
      ["name_kh", "ឈ្មោះខ្មែរ"],
      [
        "shape_type",
        "ទម្រង់បង្ហាញ",
        "select",
        [
          ["square", "ការ៉េ / Square"],
          ["rectangle", "ចតុកោណ / Rectangle"],
          ["round", "មូល / Round"],
          ["oval", "ពងក្រពើ / Oval"],
        ],
      ],
      ["sort_order", "លំដាប់បង្ហាញ", "number"],
      [
        "is_active",
        "ស្ថានភាព",
        "select",
        [
          [1, "កំពុងប្រើ"],
          [0, "ផ្អាក"],
        ],
      ],
    ],
  },
  menu: {
    title: "មុខម្ហូប",
    resource: "menuItems",
    permission: "menu.manage",
    fields: [
      ["category_id", "ប្រភេទមុខម្ហូប", "category"],
      ["kitchen_station_id", "កន្លែងរៀបចំ", "station"],
      ["sku", "SKU"],
      ["name", "ឈ្មោះ"],
      ["name_kh", "ឈ្មោះខ្មែរ"],
      ["image", "រូបមុខម្ហូប", "image"],
      ["base_price", "តម្លៃ", "number"],
      [
        "item_type",
        "ប្រភេទ",
        "select",
        [
          ["food", "ម្ហូប"],
          ["beverage", "ភេសជ្ជៈ"],
          ["service", "សេវាកម្ម"],
        ],
      ],
    ],
  },
  ingredients: {
    title: "គ្រឿងផ្សំ",
    resource: "ingredients",
    permission: "inventory.adjust",
    fields: [
      ["unit_id", "ឯកតា", "unit"],
      ["sku", "SKU"],
      ["name", "ឈ្មោះ"],
      ["name_kh", "ឈ្មោះខ្មែរ"],
      ["average_cost", "ថ្លៃដើម", "number"],
      ["minimum_stock", "ស្តុកអប្បបរមា", "number"],
    ],
  },
  suppliers: {
    title: "អ្នកផ្គត់ផ្គង់",
    resource: "suppliers",
    permission: "purchases.manage",
    fields: [
      ["code", "លេខកូដ"],
      ["name", "ឈ្មោះ"],
      ["contact_name", "អ្នកទំនាក់ទំនង"],
      ["phone", "ទូរស័ព្ទ"],
      ["address", "អាសយដ្ឋាន"],
    ],
  },
  customers: {
    title: "អតិថិជន",
    resource: "customers",
    permission: "customers.manage",
    fields: [
      ["code", "លេខកូដ"],
      ["name", "ឈ្មោះ"],
      ["name_kh", "ឈ្មោះខ្មែរ"],
      ["phone", "ទូរស័ព្ទ"],
      [
        "customer_type",
        "ប្រភេទភ្ញៀវ",
        "select",
        [
          ["regular", "ភ្ញៀវទូទៅ"],
          ["vip", "ភ្ញៀវពិសេស / VIP"],
          ["staff", "បុគ្គលិក"],
          ["partner", "ដៃគូ"],
        ],
      ],
      ["default_discount_percent", "បញ្ចុះតម្លៃលំនាំដើម (%)", "number"],
      ["address", "អាសយដ្ឋាន"],
    ],
  },
  paymentMethods: {
    title: "វិធីទូទាត់",
    resource: "paymentMethods",
    permission: "settings.manage",
    fields: [
      ["code", "លេខកូដ"],
      ["name", "ឈ្មោះ English"],
      ["name_kh", "ឈ្មោះខ្មែរ"],
      [
        "method_type",
        "ប្រភេទវិធីទូទាត់",
        "select",
        [
          ["cash", "សាច់ប្រាក់"],
          ["qr", "QR Payment"],
          ["card", "Card"],
          ["bank", "Bank Transfer"],
          ["credit", "Credit / ជំពាក់"],
          ["other", "ផ្សេងៗ"],
        ],
      ],
      [
        "requires_reference",
        "តម្រូវលេខយោង",
        "select",
        [
          [1, "តម្រូវ"],
          [0, "មិនតម្រូវ"],
        ],
      ],
      [
        "is_default",
        "វិធីលំនាំដើម",
        "select",
        [
          [0, "ទេ"],
          [1, "បាទ/ចាស"],
        ],
      ],
      ["sort_order", "លំដាប់បង្ហាញ", "number"],
      [
        "is_active",
        "ស្ថានភាព",
        "select",
        [
          [1, "កំពុងប្រើ"],
          [0, "ផ្អាក"],
        ],
      ],
    ],
  },
};
const protectedPages = [
  ["/dashboard", "dashboard.view", <Dashboard />],
  ["/tables", "tables.view", <Tables />],
  ["/kitchen", "kitchen.view", <Kitchen />],
  ["/inventory", "inventory.view", <Inventory />],
  ["/purchases", "purchases.manage", <Purchases />],
  ["/expenses", "expenses.manage", <Expenses />],
  ["/reservations", "reservations.manage", <Reservations />],
  ["/users", "users.manage", <Users />],
  ["/roles", "roles.manage", <Roles />],
  ["/audit-logs", "users.manage", <AuditLogs />],
  ["/reports", "reports.view", <Reports />],
  ["/settings", "settings.manage", <Settings />],
];
const readPermissions = {
  branches: "branches.manage",
  areas: "tables.view",
  shapes: "tables.view",
  categories: "menu.view",
  menuItems: "menu.view",
  ingredients: "inventory.view",
  suppliers: "purchases.manage",
  customers: "customers.manage",
  paymentMethods: "settings.manage",
};
function Guard({ children, permission }) {
  const { user, loading, can } = useAuth();
  if (loading)
    return (
      <div className="center-page">
        <div className="spinner" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(permission))
    return <div className="empty">អ្នកមិនមានសិទ្ធិចូលផ្នែកនេះទេ</div>;
  return children;
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/pos"
        element={
          <Guard permission="orders.create">
            <POS />
          </Guard>
        }
      />
      <Route
        element={
          <Guard>
            <MainLayout />
          </Guard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        {protectedPages.map(([path, permission, page]) => (
          <Route
            key={path}
            path={path}
            element={<Guard permission={permission}>{page}</Guard>}
          />
        ))}
        {Object.entries(crud).map(([path, c]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <Guard permission={readPermissions[c.resource]}>
                <CrudPage {...c} />
              </Guard>
            }
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
