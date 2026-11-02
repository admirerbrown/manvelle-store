import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { checkAdminAccess } from "./admin.service";

export function AdminGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "denied">(
    "loading",
  );
  useEffect(() => {
    checkAdminAccess()
      .then((allowed) => setState(allowed ? "allowed" : "denied"))
      .catch(() => setState("denied"));
  }, []);
  if (state === "loading") return <p className="admin-status">Checking access…</p>;
  return state === "allowed" ? children : <Navigate to="/admin/login" replace />;
}
