"use client";

// Login / Sign-up / Password-reset dialog.
//
// Styled with the established Activelyte design tokens (orange #F5852A, black
// glass, angled clip-path header, Saira/Rajdhani type) so it reads as part of
// the same app — not a generic form. Validation uses the shared Zod schemas;
// auth calls go through lib/firebase/auth.ts.

import React, { useEffect, useRef, useState } from "react";
import {
  loginWithEmail,
  registerWithEmail,
  requestPasswordReset,
  authErrorMessage,
} from "@/lib/firebase/auth";
import { loginSchema, signupSchema, resetSchema } from "@/lib/schemas/auth";

export type AuthMode = "login" | "signup" | "reset";

const css = `
  .auth-scrim{position:fixed;inset:0;z-index:200;display:grid;place-items:center;
    padding:20px;background:rgba(4,4,6,.62);
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
    animation:auth-fade .18s ease}
  @keyframes auth-fade{from{opacity:0}to{opacity:1}}
  .auth-card{width:100%;max-width:400px;position:relative;
    background:linear-gradient(180deg,#111 0%,#050505 100%);
    border:2px solid #F5852A;border-radius:8px;overflow:hidden;
    font-family:'Saira',sans-serif;color:#F2F2F2;
    box-shadow:0 0 0 1px rgba(0,0,0,.6),0 24px 60px rgba(0,0,0,.6);
    animation:auth-pop .22s cubic-bezier(.22,1,.36,1)}
  @keyframes auth-pop{from{transform:translateY(10px) scale(.98);opacity:0}
    to{transform:none;opacity:1}}

  .auth-head{display:flex;align-items:stretch;height:56px;
    background:linear-gradient(90deg,rgba(90,46,8,.85),rgba(24,14,5,.55)),#000;
    border-bottom:1px solid rgba(245,133,42,.35)}
  .auth-head .brand{display:flex;align-items:center;gap:11px;padding:0 18px;flex:1}
  .auth-head .brand svg{width:26px;height:26px;color:#F5852A}
  .auth-head .brand span{font-size:15px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;color:#F2F2F2}
  .auth-head .tag{display:flex;align-items:center;padding:0 20px 0 34px;background:#F5852A;
    clip-path:polygon(24px 0,100% 0,100% 100%,0 100%)}
  .auth-head .tag span{color:#2a1c07;font-size:13px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;white-space:nowrap}

  .auth-body{padding:22px 22px 24px}
  .auth-intro{font-size:13px;letter-spacing:.4px;color:#9a9a9a;margin:0 0 18px}

  .auth-field{margin-bottom:14px}
  .auth-field label{display:block;font-size:11px;font-weight:700;letter-spacing:2px;
    text-transform:uppercase;color:#8C8C8C;margin-bottom:6px}
  .auth-field input{width:100%;height:44px;padding:0 14px;box-sizing:border-box;
    background:#0c0c0c;border:1.5px solid #333;border-radius:5px;color:#F2F2F2;
    font-family:inherit;font-size:15px;letter-spacing:.3px;outline:none;
    transition:border-color .16s ease,box-shadow .16s ease}
  .auth-field input:focus{border-color:#F5852A;box-shadow:0 0 0 3px rgba(245,133,42,.15)}
  .auth-field input::placeholder{color:#5a5a5a}
  .auth-field .err{margin-top:5px;font-size:12px;color:#ff8a5c;letter-spacing:.2px}

  .auth-alert{margin:0 0 14px;padding:10px 12px;border-radius:5px;font-size:13px;
    border:1px solid;line-height:1.35}
  .auth-alert.error{background:rgba(255,90,60,.08);border-color:rgba(255,90,60,.4);color:#ff9c7a}
  .auth-alert.ok{background:rgba(31,138,104,.12);border-color:rgba(31,138,104,.5);color:#61d3a8}

  .auth-submit{width:100%;height:46px;margin-top:4px;border:none;border-radius:5px;
    background:#F5852A;color:#1a1103;font-family:'Rajdhani',sans-serif;font-size:17px;
    font-weight:700;letter-spacing:3px;text-transform:uppercase;cursor:pointer;
    transition:filter .15s ease,transform .05s ease}
  .auth-submit:hover:not(:disabled){filter:brightness(1.08)}
  .auth-submit:active:not(:disabled){transform:translateY(1px)}
  .auth-submit:disabled{opacity:.6;cursor:default}

  .auth-alt{margin-top:16px;display:flex;justify-content:space-between;gap:10px;
    font-size:13px;color:#8C8C8C}
  .auth-link{background:none;border:none;padding:0;cursor:pointer;font-family:inherit;
    font-size:13px;color:#F0842E;letter-spacing:.3px}
  .auth-link:hover{color:#ffa245;text-decoration:underline}

  .auth-x{position:absolute;top:9px;right:12px;z-index:2;background:none;border:none;
    color:#cfcfcf;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px}
  .auth-x:hover{color:#fff}
`;

const TITLES: Record<AuthMode, string> = {
  login: "Sign In",
  signup: "Sign Up",
  reset: "Reset",
};
const INTROS: Record<AuthMode, string> = {
  login: "Welcome back. Sign in to your Activelyte account.",
  signup: "Create your account to get started.",
  reset: "Enter your email and we'll send a reset link.",
};

type FieldErrors = Partial<
  Record<"displayName" | "email" | "password", string>
>;

export function AuthDialog({
  open,
  mode,
  onClose,
  onSwitchMode,
}: {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (mode: AuthMode) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset transient state whenever the dialog opens or the mode changes.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    setOk(null);
    setBusy(false);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open, mode]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setOk(null);

    if (mode === "login") {
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));
      setErrors({});
      setBusy(true);
      try {
        await loginWithEmail(parsed.data.email, parsed.data.password);
        onClose();
      } catch (err) {
        setFormError(authErrorMessage(err));
      } finally {
        setBusy(false);
      }
    } else if (mode === "signup") {
      const parsed = signupSchema.safeParse({ displayName, email, password });
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));
      setErrors({});
      setBusy(true);
      try {
        await registerWithEmail(
          parsed.data.displayName,
          parsed.data.email,
          parsed.data.password,
        );
        onClose();
      } catch (err) {
        setFormError(authErrorMessage(err));
      } finally {
        setBusy(false);
      }
    } else {
      const parsed = resetSchema.safeParse({ email });
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));
      setErrors({});
      setBusy(true);
      try {
        await requestPasswordReset(parsed.data.email);
        setOk("Check your inbox for a password reset link.");
      } catch (err) {
        setFormError(authErrorMessage(err));
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div
      className="auth-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[mode]}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{css}</style>
      <div className="auth-card">
        <button className="auth-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="auth-head">
          <div className="brand">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>Activelyte</span>
          </div>
          <div className="tag">
            <span>{TITLES[mode]}</span>
          </div>
        </div>

        <div className="auth-body">
          <p className="auth-intro">{INTROS[mode]}</p>

          {formError && <div className="auth-alert error">{formError}</div>}
          {ok && <div className="auth-alert ok">{ok}</div>}

          <form onSubmit={submit} noValidate>
            {mode === "signup" && (
              <div className="auth-field">
                <label htmlFor="auth-name">Name</label>
                <input
                  id="auth-name"
                  ref={firstFieldRef}
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                {errors.displayName && (
                  <div className="err">{errors.displayName}</div>
                )}
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                ref={mode === "signup" ? undefined : firstFieldRef}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && <div className="err">{errors.email}</div>}
            </div>

            {mode !== "reset" && (
              <div className="auth-field">
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {errors.password && (
                  <div className="err">{errors.password}</div>
                )}
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign In"
                  : mode === "signup"
                    ? "Create Account"
                    : "Send Reset Link"}
            </button>
          </form>

          <div className="auth-alt">
            {mode === "login" && (
              <>
                <button
                  className="auth-link"
                  onClick={() => onSwitchMode("reset")}
                >
                  Forgot password?
                </button>
                <span>
                  New here?{" "}
                  <button
                    className="auth-link"
                    onClick={() => onSwitchMode("signup")}
                  >
                    Create account
                  </button>
                </span>
              </>
            )}
            {mode === "signup" && (
              <span>
                Already have an account?{" "}
                <button
                  className="auth-link"
                  onClick={() => onSwitchMode("login")}
                >
                  Sign in
                </button>
              </span>
            )}
            {mode === "reset" && (
              <button className="auth-link" onClick={() => onSwitchMode("login")}>
                ← Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fieldErrors(err: import("zod").ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (key === "displayName" || key === "email" || key === "password") {
      out[key] ??= issue.message;
    }
  }
  return out;
}
