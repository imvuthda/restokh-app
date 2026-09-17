import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { AppSettingsProvider } from "./contexts/AppSettingsContext.jsx";
import { AppErrorBoundary } from "./components/UI.jsx";
import "./styles/global.css";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <AppSettingsProvider>
              <App />
            </AppSettingsProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
