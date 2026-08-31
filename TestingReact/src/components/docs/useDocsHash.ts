"use client";

/**
 * @file components/docs/useDocsHash.ts
 * @description The topic named by the URL fragment — `/docs#stock-health` — as
 * a reactive value.
 *
 * `useSyncExternalStore` rather than an on-mount effect, for the reason this
 * project has settled on everywhere else (`authMethodStore`,
 * `sidebarPreference`, `LanguageProvider`): the hash is external client state,
 * this is the hook built for reading one, and the alternative — `useState` plus
 * an effect that calls `setState` — is a cascading render the lint rule
 * correctly rejects.
 *
 * The server snapshot is `""`, so nothing hash-dependent reaches the server
 * HTML and hydration cannot mismatch.
 *
 * Routing every "open this topic" through the hash rather than through page
 * state is deliberate: it makes every topic a shareable link.
 *
 * Writes use `replaceState`, so opening topics does NOT stack up history —
 * Back leaves the page rather than stepping through the cards you opened. That
 * is the intended trade: a reader who taps six stops on the lifecycle rail
 * should not have to press Back seven times to leave.
 */

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  // `hashchange` covers the user editing the URL and the back/forward buttons;
  // `emit` covers our own writes, which use replaceState and so fire no event.
  window.addEventListener("hashchange", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function getSnapshot(): string {
  // A primitive, so React's identity check settles even though this re-reads
  // `location` on every render.
  return window.location.hash.slice(1);
}

function getServerSnapshot(): string {
  return "";
}

/** The topic id in the URL, or `""` when there is none. */
export function useDocsHash(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Points the URL at a topic without the jump a plain `location.hash = id`
 * causes — the page does its own scrolling, with the reader's motion
 * preference honoured, and a native jump would fight it.
 */
export function setDocsHash(topicId: string) {
  // Clearing writes the bare path rather than a lone "#", which would leave a
  // dangling fragment in the address bar and in anything the reader copies.
  const url = topicId ? `#${topicId}` : location.pathname + location.search;
  history.replaceState(null, "", url);
  emit();
}
