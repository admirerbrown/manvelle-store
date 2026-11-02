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
          Manvelle <span>Admin</span>
        </Link>
        <button type="button" className="admin-button admin-button--quiet" onClick={logout}>
          Log out
        </button>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
