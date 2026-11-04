import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { signOutAdmin } from "./admin.service";

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  async function logout() {
    await signOutAdmin();
    navigate("/admin/login", { replace: true });
  }
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link to="/admin/orders" className="admin-brand">
          Manvelle
        </Link>
        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-button admin-button--quiet admin-refresh"
            onClick={() => window.location.reload()}
          >
            ↻ Refresh
          </button>
          <span className="admin-role">Admin</span>
          <button type="button" className="admin-button admin-button--quiet" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
