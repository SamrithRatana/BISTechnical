"use client";

import { useSyncExternalStore } from "react";
import { isPasskeySupported } from "@/lib/webauthn";

/**
 * Whether this browser can do WebAuthn at all — safe to call during render on a
 * server-rendered page.
 *
 * The obvious version of this is `useState(false)` plus an effect, and that is
 * what it was first written as. It costs an extra render, and it trips
 * `react-hooks/set-state-in-effect` — a rule this project already carries four
 * unresolved instances of, each of which turned out to need a real refactor.
 * Adding a fifth to answer a question that never changes was not worth it.
 *
 * `useSyncExternalStore` is the shape the rest of this codebase already uses for
 * "a value the server cannot see" — the auth token, the language, the sidebar
 * collapse state (`services/sidebarPreference.ts`). The server snapshot is
 * `false`, so nothing passkey-shaped is ever in the server HTML and there is no
 * hydration mismatch to reconcile.
 *
 * `subscribe` returns a no-op unsubscribe on purpose: a browser does not grow
 * WebAuthn support part-way through a page's life, so there is no change to
 * listen for.
 */
const subscribe = () => () => {};
const getSnapshot = () => isPasskeySupported();
const getServerSnapshot = () => false;

export function usePasskeySupport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
