import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, User, UtensilsCrossed } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { errorMessage } from "../api/client";
export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    username: "admin",
    password: "Admin@123",
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(form.username, form.password);
      nav("/dashboard");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-art">
        <div>
          <UtensilsCrossed />
          <h1>គ្រប់គ្រងភោជនីយដ្ឋាន</h1>
          <p>POS • Kitchen • Stock • Reports</p>
        </div>
      </div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <UtensilsCrossed />
        </div>
        <h2>សូមស្វាគមន៍</h2>
        <p>ចូលគណនីដើម្បីបន្ត</p>
        {error && <div className="alert error">{error}</div>}
        <label>
          ឈ្មោះអ្នកប្រើ
          <div className="input-icon">
            <User />
            <input
              autoFocus
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
        </label>
        <label>
          ពាក្យសម្ងាត់
          <div className="input-icon">
            <Lock />
            <input
              type={show ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button type="button" onClick={() => setShow((x) => !x)}>
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </label>
        <button className="btn login-btn" disabled={loading}>
          {loading ? "កំពុងចូល..." : "ចូលប្រើប្រាស់"}
        </button>
        <small>Default: admin / Admin@123</small>
      </form>
    </div>
  );
}
