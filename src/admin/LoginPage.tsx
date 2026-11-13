import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthApiError } from "@supabase/supabase-js";
import { requestAdminCode, verifyAdminCode } from "./admin.service";

const RESEND_SECONDS = 60;

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    if (sending || !email.trim()) return;
    setError(null);
    setSending(true);
    try {
      await requestAdminCode(email.trim());
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch (cause) {
      if (isAuthApiError(cause) && cause.status === 422) {
        // Supabase answers 422 when this email has no auth user and signups are off.
        // Stay neutral so the page does not reveal which emails are admins.
        if (import.meta.env.DEV) {
          console.warn("[admin login] 422 from Supabase. Is there an auth user for this email?", cause);
        }
        setSent(true);
        setCooldown(RESEND_SECONDS);
      } else if (isAuthApiError(cause) && cause.status === 429) {
        console.error("[admin login] rate limited:", cause);
        setError("Too many code requests. Please wait a few minutes and try again.");
      } else {
        console.error("[admin login] could not request a code:", cause);
        setError("We couldn't send a code right now. Please try again shortly.");
      }
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    if (verifying || code.length !== 6) return;
    setError(null);
    setVerifying(true);
    try {
      await verifyAdminCode(email.trim(), code.trim());
      navigate("/admin/orders", { replace: true });
    } catch (cause) {
      if (cause instanceof Error && cause.message === "Not authorised.") {
        setError("Not authorised.");
      } else {
        console.error("[admin login] code verification failed:", cause);
        setError("The code is invalid or expired.");
      }
    } finally {
      setVerifying(false);
    }
  }

  function useDifferentEmail() {
    setSent(false);
    setCode("");
    setError(null);
    setCooldown(0);
  }

  return (
    <main className="admin-login">
      <p className="admin-kicker">Private workspace</p>
      <h1>Admin sign in</h1>
      <p>Use your one-time email code to manage Manvelle orders.</p>
      <label>
        Email address
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !sent) void sendCode();
          }}
          disabled={sent}
          required
        />
      </label>
      {!sent ? (
        <button className="admin-button" type="button" onClick={sendCode} disabled={!email.trim() || sending}>
          {sending ? "Sending…" : "Send code"}
        </button>
      ) : (
        <>
          <p className="admin-neutral">If this email is registered, a code has been sent.</p>
          <label>
            Six-digit code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void verifyCode();
              }}
              maxLength={6}
              required
            />
          </label>
          <button className="admin-button" type="button" onClick={verifyCode} disabled={code.length !== 6 || verifying}>
            {verifying ? "Verifying…" : "Verify code"}
          </button>
          <button className="admin-link" type="button" onClick={sendCode} disabled={cooldown > 0 || sending}>
            {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
          <button className="admin-link" type="button" onClick={useDifferentEmail}>
            Use a different email
          </button>
        </>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
