import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "./AuthContext";

const defaults = {
  business_name: "Restaurant",
  business_name_kh: "ភោជនីយដ្ឋាន",
  khr_exchange_rate: "4100",
  base_currency: "USD",
  secondary_currency: "KHR",
  currency_rounding: "100",
  primary_color: "#b91c1c",
  theme_mode: "light",
  default_language: "km",
  receipt_width: "80",
  receipt_footer: "សូមអរគុណ • Thank you",
  receipt_show_tax_number: "true",
  receipt_auto_print: "false",
  require_cash_shift: "true",
  allow_split_payment: "true",
  enable_payment_cash: "true",
  enable_payment_aba_khqr: "true",
  enable_payment_card: "true",
  enable_payment_bank_transfer: "true",
  enable_payment_credit: "true",
  enable_payment_other: "true",
  low_stock_alert: "true",
  allow_negative_stock: "false",
  session_timeout_minutes: "480",
};

const AppSettingsContext = createContext({
  settings: defaults,
  refreshSettings: async () => {},
});

export function AppSettingsProvider({ children }) {
  const { activeBranchId, user, logout } = useAuth();
  const [settings, setSettings] = useState(defaults);

  async function refreshSettings() {
    if (!activeBranchId) return;
    const response = await api.get(
      `/public/settings?branch_id=${activeBranchId}`,
    );
    setSettings({ ...defaults, ...response.data.data });
  }

  useEffect(() => {
    refreshSettings().catch(() => setSettings(defaults));
  }, [activeBranchId]);

  useEffect(() => {
    const color = /^#[0-9a-f]{6}$/i.test(settings.primary_color || "")
      ? settings.primary_color
      : defaults.primary_color;
    document.documentElement.style.setProperty("--primary", color);
    document.documentElement.dataset.theme = settings.theme_mode || "light";
    document.documentElement.lang = settings.default_language || "km";
    document.title =
      settings.business_name_kh || settings.business_name || "Restaurant";

    if (settings.logo_url) {
      let icon = document.querySelector("link[rel='icon']");
      if (!icon) {
        icon = document.createElement("link");
        icon.rel = "icon";
        document.head.appendChild(icon);
      }
      icon.href = settings.logo_url;
    }
  }, [settings]);

  useEffect(() => {
    if (!user) return undefined;
    const minutes = Number(settings.session_timeout_minutes || 480);
    if (!Number.isFinite(minutes) || minutes <= 0) return undefined;
    let lastActivity = Date.now();
    const active = () => {
      lastActivity = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, active));
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity >= minutes * 60000) logout(false);
    }, 30000);
    return () => {
      window.clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, active));
    };
  }, [settings.session_timeout_minutes, user?.id]);

  return (
    <AppSettingsContext.Provider value={{ settings, refreshSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export const useAppSettings = () => useContext(AppSettingsContext);
