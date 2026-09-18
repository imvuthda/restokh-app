import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchState] = useState(null);
  const [loading, setLoading] = useState(true);
  async function hydrate() {
    const me = (await api.get("/auth/me")).data.data;
    setUser(me);
    if (me.isSuperAdmin) {
      const list = (await api.get("/branches?limit=100")).data.data.items || [];
      setBranches(list.filter((x) => x.is_active));
      const saved = Number(localStorage.getItem("activeBranchId"));
      setActiveBranchState(
        list.some((x) => x.id === saved) ? saved : list[0]?.id || null,
      );
    } else {
      setBranches(
        me.branch_id
          ? [
              {
                id: me.branch_id,
                name: me.branch_name || `Branch ${me.branch_id}`,
              },
            ]
          : [],
      );
      setActiveBranchState(me.branch_id);
    }
  }
  useEffect(() => {
    if (!localStorage.getItem("accessToken")) {
      setLoading(false);
      return;
    }
    hydrate()
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false));
  }, []);
  async function login(username, password) {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("accessToken", data.data.accessToken);
    localStorage.setItem("refreshToken", data.data.refreshToken);
    await hydrate();
  }
  async function logout(allDevices = false) {
    try {
      await api.post("/auth/logout", {
        refreshToken: localStorage.getItem("refreshToken"),
        allDevices,
      });
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("activeBranchId");
      setUser(null);
      setBranches([]);
      setActiveBranchState(null);
    }
  }
  function setActiveBranchId(id) {
    if (!user?.isSuperAdmin) return;
    const value = Number(id);
    if (!branches.some((x) => x.id === value)) return;
    localStorage.setItem("activeBranchId", String(value));
    setActiveBranchState(value);
  }
  const can = (code) =>
    Boolean(user?.isSuperAdmin || user?.permissions?.includes(code));
  return (
    <AuthContext.Provider
      value={{
        user,
        branches,
        activeBranchId,
        loading,
        login,
        logout,
        can,
        setActiveBranchId,
        refreshAuth: hydrate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
