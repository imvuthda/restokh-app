import { createContext, useContext, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
const C = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
  };
  return (
    <C.Provider value={toast}>
      {children}
      <div className="toasts">
        {items.map((i) => (
          <div key={i.id} className={`toast ${i.type}`}>
            {i.type === "success" ? <CheckCircle2 /> : <XCircle />}
            <span>{i.message}</span>
            <button
              onClick={() => setItems((x) => x.filter((v) => v.id !== i.id))}
            >
              <X />
            </button>
          </div>
        ))}
      </div>
    </C.Provider>
  );
}
export const useToast = () => useContext(C);
