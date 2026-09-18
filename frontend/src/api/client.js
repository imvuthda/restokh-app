import axios from "axios";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 20000,
});
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("accessToken");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
api.interceptors.response.use(
  (r) => r,
  async (e) => {
    const original = e.config;
    if (
      e.response?.status === 401 &&
      !original?._retry &&
      localStorage.getItem("refreshToken")
    ) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken: localStorage.getItem("refreshToken") },
        );
        localStorage.setItem("accessToken", data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        location.href = "/login";
      }
    }
    return Promise.reject(e);
  },
);
export default api;
export const errorMessage = (e) =>
  e.response?.data?.message || e.message || "មានបញ្ហា";
