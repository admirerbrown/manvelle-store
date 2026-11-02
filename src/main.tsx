import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { App } from "./app/App";
import { AdminApp } from "./admin/AdminApp";
import "./app/app.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The application root element is missing.");
}

function RootApp() {
  const location = useLocation();
  return location.pathname.startsWith("/admin") ? <AdminApp /> : <App />;
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <RootApp />
    </BrowserRouter>
  </StrictMode>,
);
