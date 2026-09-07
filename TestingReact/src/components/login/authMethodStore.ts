"use client";

/**
 * @file components/login/authMethodStore.ts
 * @description sessionStorage-backed store for the remembered auth-method tab,
 * read through `useSyncExternalStore` rather than a `useState` initializer.
 *
 * The initializer version hydration-mismatched: the server branch returned
 * "password" (tag "Standard") while a client with a saved "phone" rendered
 * "Mobile 2FA" in the same text node, so React threw the whole login tree away
 * and regenerated it client-side. That full re-render is also what tripped the
 * "Encountered a script tag" console error on `LanguageScript` — a sanctioned
 * pre-hydration script that only gets re-walked when hydration fails.
 *
 * `useSyncExternalStore` renders the server snapshot ("password") during
 * hydration so both sides agree, then re-reads storage immediately after mount
 * and re-renders just the subscribers if a different tab was saved.
 */

import { useCallback, useSyncExternalStore } from "react";

export type AuthMethod = "password" | "phone" | "passkey";

const AUTH_METHOD_STORAGE_KEY = "camid_last_auth_method";
const listeners = new Set<() => void>();

/**
 * Memory is the authority; sessionStorage is write-through persistence.
 * With storage as the only source, a blocked `setItem` (private mode, quota)
 * made switching sign-in method a silent no-op: listeners fired, the re-read
 * returned the old value, and the tabs never moved.
 */
let currentAuthMethod: AuthMethod | null = null;

function readStoredAuthMethod(): AuthMethod {
  if (currentAuthMethod !== null) return currentAuthMethod;
  try {
    const saved = sessionStorage.getItem(AUTH_METHOD_STORAGE_KEY);
    if (saved === "phone" || saved === "passkey" || saved === "password") {
      currentAuthMethod = saved;
      return saved;
    }
  } catch {
    // Storage unavailable (private mode) — fall through to the default.
  }
  currentAuthMethod = "password";
  return currentAuthMethod;
}

function subscribeAuthMethod(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function writeStoredAuthMethod(method: AuthMethod): void {
  currentAuthMethod = method;
  try {
    sessionStorage.setItem(AUTH_METHOD_STORAGE_KEY, method);
  } catch {
    // Persisting the tab is a nicety; losing it must not break switching.
  }
  listeners.forEach((listener) => listener());
}

/** Hydration-safe [value, setter] for the active sign-in method. */
export function useAuthMethod(): [AuthMethod, (method: AuthMethod) => void] {
  const authMethod = useSyncExternalStore(
    subscribeAuthMethod,
    readStoredAuthMethod,
    () => "password" as AuthMethod
  );
  const setAuthMethod = useCallback((method: AuthMethod) => {
    writeStoredAuthMethod(method);
  }, []);
  return [authMethod, setAuthMethod];
}
