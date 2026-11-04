import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminGuard } from "./AdminGuard";
import { AdminLayout } from "./AdminLayout";
import { LoginPage } from "./LoginPage";
import { OrderDetailPage } from "./OrderDetailPage";
import { OrdersPage } from "./OrdersPage";
import "./admin.css";

export function AdminApp() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]') ?? document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex, nofollow");
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <div className="admin-app">
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<Navigate to="/admin/orders" replace />} />
        <Route path="/admin/orders/:id" element={<AdminGuard><AdminLayout><OrderDetailPage /></AdminLayout></AdminGuard>} />
        <Route path="/admin/orders" element={<AdminGuard><AdminLayout><OrdersPage /></AdminLayout></AdminGuard>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </div>
  );
}
