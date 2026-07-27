"use client";

// Global auth context. Wraps the app in the root layout, subscribes to Firebase
// ID-token changes, and exposes the current user + a way to open the auth
// dialog. React context only works in Client Components, so this (and every
// consumer) is a client boundary.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isFirebaseConfigured } from "@/lib/env";
import { initAppCheck } from "@/lib/firebase/client";
import { watchAuth, logout as fbLogout, type SignedInUser } from "@/lib/firebase/auth";
import { initPresence } from "@/lib/services/presence-service";
import { registerWebPush, saveDeviceToken } from "@/lib/services/notification-service";
import { isNative, platformName, registerNativePush } from "@/lib/platform";
import { AuthDialog, type AuthMode } from "./auth-dialog";

type AuthContextValue = {
  user: SignedInUser | null;
  /** True until the first auth state resolves (avoids a flash of signed-out UI). */
  loading: boolean;
  /** False when Firebase env vars are missing — UI can show a setup hint. */
  configured: boolean;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseConfigured;
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [loading, setLoading] = useState(configured);
  const [dialog, setDialog] = useState<{ open: boolean; mode: AuthMode }>({
    open: false,
    mode: "login",
  });

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    initAppCheck(); // no-op unless a reCAPTCHA site key is configured
    const unsub = watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, [configured]);

  // Publish online presence while signed in; mark offline on sign-out/unmount.
  useEffect(() => {
    if (!user?.uid) return;
    const stop = initPresence(user.uid);
    // Push registration: native inside a Capacitor shell, web otherwise
    // (both no-op without permission / VAPID key).
    if (isNative()) {
      const deviceId = `${platformName()}_${user.uid}`;
      void registerNativePush((token) =>
        saveDeviceToken(user.uid, deviceId, token, platformName()),
      );
    } else {
      void registerWebPush(user.uid);
    }
    return stop;
  }, [user?.uid]);

  const openAuth = useCallback(
    (mode: AuthMode = "login") => setDialog({ open: true, mode }),
    [],
  );
  const closeAuth = useCallback(
    () => setDialog((d) => ({ ...d, open: false })),
    [],
  );
  const signOut = useCallback(async () => {
    await fbLogout();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, configured, openAuth, closeAuth, signOut }),
    [user, loading, configured, openAuth, closeAuth, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthDialog
        open={dialog.open}
        mode={dialog.mode}
        onClose={closeAuth}
        onSwitchMode={(mode) => setDialog({ open: true, mode })}
      />
    </AuthContext.Provider>
  );
}
