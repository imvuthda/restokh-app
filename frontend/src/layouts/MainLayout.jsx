import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShoppingBasket,
  Store,
  UserCircle,
  Users,
  UtensilsCrossed,
  Warehouse,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { Button, Modal } from "../components/UI";

const groups = [
  {
    items: [
      ["/dashboard", "ផ្ទាំងគ្រប់គ្រង", BarChart3, "dashboard.view"],
      ["/pos", "POS លក់", ShoppingBasket, "orders.create"],
      ["/kitchen", "ផ្ទះបាយ", ChefHat, "kitchen.view"],
    ],
  },
  {
    label: "តុ និងតំបន់",
    icon: LayoutGrid,
    items: [
      ["/tables", "គ្រប់គ្រងតុ និងរាង", LayoutGrid, "tables.view"],
      ["/areas", "គ្រប់គ្រងតំបន់", MapPin, "tables.view"],
      ["/shapes", "គ្រប់គ្រងរាងតុ", LayoutGrid, "tables.view"],
    ],
  },
  {
    label: "មុខម្ហូប និងស្តុក",
    icon: UtensilsCrossed,
    items: [
      ["/menu", "មុខម្ហូប", UtensilsCrossed, "menu.view"],
      ["/categories", "ប្រភេទម្ហូប", ClipboardList, "menu.view"],
      ["/inventory", "ស្តុកគ្រឿងផ្សំ", Warehouse, "inventory.view"],
      ["/ingredients", "គ្រឿងផ្សំ", Package, "inventory.view"],
    ],
  },
  {
    label: "ប្រតិបត្តិការ",
    icon: ReceiptText,
    items: [
      ["/purchases", "ការទិញ", ReceiptText, "purchases.manage"],
      ["/suppliers", "អ្នកផ្គត់ផ្គង់", Store, "purchases.manage"],
      ["/customers", "អតិថិជន", Users, "customers.manage"],
      ["/reservations", "ការកក់តុ", CalendarDays, "reservations.manage"],
      ["/expenses", "ចំណាយ", CircleDollarSign, "expenses.manage"],
    ],
  },
  {
    label: "របាយការណ៍",
    icon: FileBarChart,
    items: [["/reports", "លក់ • ទិញ • ចំណាយ", FileBarChart, "reports.view"]],
  },
  {
    label: "ការគ្រប់គ្រង",
    icon: Settings,
    items: [
      ["/branches", "គ្រប់គ្រងសាខា", Building2, "branches.manage"],
      ["/users", "បញ្ជីអ្នកប្រើប្រាស់", Users, "users.manage"],
      ["/roles", "តួនាទី និងសិទ្ធិ", UserCircle, "roles.manage"],
      ["/audit-logs", "ប្រវត្តិសកម្មភាព", ShieldCheck, "users.manage"],
      ["/settings", "ការកំណត់", Settings, "settings.manage"],
      ["/paymentMethods", "វិធីទូទាត់", CircleDollarSign, "settings.manage"],
    ],
  },
];
const allLinks = groups.flatMap((group) => group.items);

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "1",
  );
  const [mobile, setMobile] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const { user, branches, activeBranchId, setActiveBranchId, can, logout } =
    useAuth();
  const { settings } = useAppSettings();
  const loc = useLocation();
  const nav = useNavigate();
  const toggleCollapse = () =>
    setCollapsed((value) => {
      localStorage.setItem("sidebarCollapsed", value ? "0" : "1");
      return !value;
    });
  const toggleGroup = (label) =>
    setOpenGroups((old) => {
      const next = new Set(old);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  const openGroupFromCollapsed = (label) => {
    if (collapsed) {
      localStorage.setItem("sidebarCollapsed", "0");
      setCollapsed(false);
      setOpenGroups((old) => new Set([...old, label]));
      return;
    }
    toggleGroup(label);
  };
  async function confirmLogout(all = false) {
    await logout(all);
    nav("/login", { replace: true });
  }
  const renderLink = ([to, label, Icon]) => (
    <NavLink
      key={to}
      to={to}
      title={collapsed ? label : ""}
      onClick={() => setMobile(false)}
      className={({ isActive }) => (isActive ? "active" : "")}
    >
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" />
            ) : (
              <UtensilsCrossed />
            )}
          </div>
          <div>
            <b>{settings.business_name_kh || settings.business_name}</b>
            <small>{settings.business_name || "Management"}</small>
          </div>
        </div>
        <nav>
          {groups.map((group, index) => {
            const items = group.items.filter((x) => can(x[3]));
            if (!items.length) return null;
            if (!group.label)
              return (
                <div className="nav-direct" key={index}>
                  {items.map(renderLink)}
                </div>
              );
            const active = items.some((x) => loc.pathname.startsWith(x[0]));
            const open = !collapsed && openGroups.has(group.label);
            const GroupIcon = group.icon;
            return (
              <div
                className={`nav-group ${open ? "open" : ""} ${active ? "active-group" : ""}`}
                key={group.label}
              >
                <button
                  className="nav-group-title"
                  onClick={() => openGroupFromCollapsed(group.label)}
                  title={collapsed ? group.label : ""}
                  aria-expanded={open}
                >
                  <GroupIcon />
                  <span>{group.label}</span>
                  <ChevronDown className="group-arrow" />
                </button>
                {open && (
                  <div className="nav-children">{items.map(renderLink)}</div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="topbar-collapse-btn"
              onClick={toggleCollapse}
              title={collapsed ? "បើក Sidebar" : "បិទ Sidebar"}
              aria-label={collapsed ? "បើក Sidebar" : "បិទ Sidebar"}
            >
              <ChevronLeft />
            </button>
            <button
              className="mobile-menu"
              onClick={() => setMobile((x) => !x)}
            >
              <Menu />
            </button>
            <div className="top-title">
              <h1>
                {allLinks.find((x) => loc.pathname.startsWith(x[0]))?.[1] ||
                  "Restaurant"}
              </h1>
            </div>
          </div>
          <div className="topbar-actions">
            {user?.isSuperAdmin ? (
              <label className="branch-switch">
                <MapPin />
                <span>សាខា</span>
                <select
                  value={activeBranchId || ""}
                  onChange={(e) => setActiveBranchId(e.target.value)}
                >
                  {branches.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name_kh || b.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="assigned-branch">
                <MapPin />
                {user?.branch_name || `សាខា #${activeBranchId}`}
              </span>
            )}
            <div className="top-date">
              {new Intl.DateTimeFormat("km-KH", { dateStyle: "medium" }).format(
                new Date(),
              )}
            </div>
            <div className="top-user-wrap">
              <button
                className="top-user"
                onClick={() => setUserMenu((x) => !x)}
              >
                <span className="avatar">{user?.full_name?.[0] || "U"}</span>
                <span>
                  <b>{user?.full_name}</b>
                  <small>
                    {user?.isSuperAdmin ? "Super Admin" : user?.role_name}
                  </small>
                </span>
                <ChevronDown />
              </button>
              {userMenu && (
                <div className="user-dropdown">
                  <div>
                    <b>{user?.full_name}</b>
                    <small>@{user?.username}</small>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenu(false);
                      setLogoutOpen(true);
                    }}
                  >
                    <LogOut /> ចាកចេញ
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content" key={activeBranchId}>
          <Outlet />
        </main>
      </div>
      {mobile && <div className="overlay" onClick={() => setMobile(false)} />}
      {logoutOpen && (
        <Modal title="ចាកចេញពីប្រព័ន្ធ" onClose={() => setLogoutOpen(false)}>
          <p>តើអ្នកចង់ចាកចេញពីគណនីនេះមែនទេ?</p>
          <div className="logout-actions">
            <Button variant="ghost" onClick={() => setLogoutOpen(false)}>
              បោះបង់
            </Button>
            <Button variant="ghost" onClick={() => confirmLogout(true)}>
              ចាកចេញគ្រប់ឧបករណ៍
            </Button>
            <Button onClick={() => confirmLogout(false)}>
              <LogOut /> ចាកចេញ
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
