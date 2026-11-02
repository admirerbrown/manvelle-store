import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestAdminCode, verifyAdminCode } from "./admin.service";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function sendCode() {
    setError(null);
    try {
      await requestAdminCode(email.trim());
      setSent(true);
      setCooldown(60);
      const timer = window.setInterval(() => {
        setCooldown((value) => {
          if (value <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    } catch {
      setSent(true);
      setError("We couldn't send a code right now. If this email is registered, please try again shortly.");
    }
  }

  async function verifyCode() {
    setError(null);
    try {
      await verifyAdminCode(email.trim(), code.trim());
      navigate("/admin/orders", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The code is invalid or expired.");
    }
  }

  return (
    <main className="admin-login">
      <p className="admin-kicker">Private workspace</p>
      <h1>Admin sign in</h1>
      <p>Use your one-time email code to manage Manvelle orders.</p>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={sent} required /></label>
      {!sent ? (
        <button className="admin-button" type="button" onClick={sendCode} disabled={!email}>
          Send code
        </button>
      ) : (
        <>
          <p className="admin-neutral">If this email is registered, a code has been sent.</p>
          <label>Six-digit code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} required /></label>
          <button className="admin-button" type="button" onClick={verifyCode} disabled={code.length !== 6}>Verify code</button>
          <button className="admin-link" type="button" onClick={sendCode} disabled={cooldown > 0}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</button>
        </>
      )}
      {error && <p className="admin-error" role="alert">{error}</p>}
    </main>
  );
}
