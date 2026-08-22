/**
 * @file services/sidebarPreference.ts
 * @description Whether the sidebar is expanded, held outside React.
 *
 * ── Why this is not `useState` ─────────────────────────────────────────────
 *
 * It was, in `PageWrapper` — and `PageWrapper` is rendered by each of the 25
 * page components, not by a shared layout. Every route is a distinct component
 * (`ReceiveItemPage` vs `InspectItemPage`), so React unmounts the whole subtree
 * at that position on navigation and the `useState(true)` went with it.
 *
 * Measured before this file existed: collapse the rail on `/spareparts` (256px
 * → 80px), navigate to `/customers`, and it is 256px again. The user's
 * deliberate choice survived exactly as long as the page they made it on.
 *
 * Module scope outlives the remount, which is the whole point. This is the
 * same shape `services/authSession.ts` uses for the token and
 * `i18n/LanguageProvider` uses for the language: external client state read
 * through `useSyncExternalStore`, not derived state.
 *
 * ── Why there is no flash, and why that is not luck ────────────────────────
 *
 * `useSyncExternalStore` normally has to render `getServerSnapshot()` first
 * and reconcile to the real value after hydration, which is where a stored
 * "collapsed" would show up as a 300ms slide from expanded on every reload —
 * the aside carries `transition-[width,transform] duration-300`.
 *
 * That does not happen here because the sidebar is never in the server HTML at
 * all: `AuthGuard` reads the token through the same mechanism, the server has
 * no `localStorage`, so on the server it renders the "verifying" screen and
 * `PageWrapper` is not part of that tree. The sidebar's first render is
 * client-side, where `getSnapshot()` already returns the stored value.
 *
 * `readSidebarOpenOnServer` is still correct rather than decorative — if the
 * shell is ever moved into a real layout above `AuthGuard`, it is what keeps
 * the server render valid, and the flash question becomes live again.
 *
 * ── Why a phone cannot collapse a desk ─────────────────────────────────────
 *
 * The same boolean means two different things: below `lg` it is an off-canvas
 * drawer that is *transiently* open, above `lg` it is a rail whose width is a
 * *preference*. Three places close the drawer on their own — the mount-time
 * default, the scrim, and navigating on mobile — and persisting any of those
 * would silently collapse the rail on the user's desktop next time they opened
 * the app.
 *
 * So the write is gated on the viewport being a desktop rail. Callers need no
 * flag and cannot get it wrong; a transient close below `lg` updates the live
 * value and writes nothing.
 */

/** Persisted under this key. Cleared by hand only — no expiry. */
const STORAGE_KEY = "sidebar_open";

/**
 * Broadcast within this tab, since `storage` only fires in *other* tabs.
 * Mirrors `SESSION_CHANGED_EVENT` in `services/authSession.ts`.
 */
export const SIDEBAR_CHANGED_EVENT = "sidebar-preference-changed";

/** Expanded, matching the `useState(true)` this replaced. */
const DEFAULT_OPEN = true;

/** The width at which the drawer becomes a rail. Tailwind's `lg`. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Cached rather than read from `localStorage` per call.
 *
 * `useSyncExternalStore` calls `getSnapshot` on every render and throws if the
 * result keeps changing, so this must be cheap and stable. `null` means "not
 * read yet" — distinct from a stored `false`.
 */
let cached: boolean | null = null;

function isDesktop(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches;
}

/** The live value. Safe during SSR, where it is the default. */
export function readSidebarOpen(): boolean {
  if (typeof window === "undefined") return DEFAULT_OPEN;
  if (cached === null) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      cached = raw === null ? DEFAULT_OPEN : raw === "true";
    } catch {
      cached = DEFAULT_OPEN; // storage disabled (private mode, blocked cookies)
    }
  }
  return cached;
}

/** The server has no `localStorage`; it renders the default. */
export function readSidebarOpenOnServer(): boolean {
  return DEFAULT_OPEN;
}

/**
 * Sets the live value, persisting it only when it is a desktop preference
 * rather than a transient drawer state. See the header.
 */
export function setSidebarOpen(open: boolean): void {
  // Seeds `cached` before comparing, so the first call after a reload does not
  // mistake "not read yet" for a change.
  if (readSidebarOpen() === open) return;
  cached = open;

  if (isDesktop()) {
    try {
      localStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      // Storage disabled. The in-memory value still stands for this session,
      // which is strictly better than throwing inside a click handler.
    }
  }

  window.dispatchEvent(new Event(SIDEBAR_CHANGED_EVENT));
}

/** Subscribes to changes in this tab and any other. */
export function subscribeToSidebar(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    // `key` is null when the whole store is cleared, which does concern us.
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    // Another tab wrote it, so the cache is stale — drop it and re-read.
    cached = null;
    onChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(SIDEBAR_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SIDEBAR_CHANGED_EVENT, onChange);
  };
}
