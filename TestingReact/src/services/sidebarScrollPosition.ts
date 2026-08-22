/**
 * @file services/sidebarScrollPosition.ts
 * @description The sidebar nav's scroll offset, held outside React.
 *
 * Same problem `services/sidebarPreference.ts` solves for the collapsed
 * width, and the same shape on purpose: `Sidebar` is rendered by
 * `PageWrapper`, which every page mounts fresh (see that file's header for
 * why), so a `useState`/plain ref for `scrollTop` is destroyed and recreated
 * on every navigation. Scrolled down the nav list, clicked a link, and the
 * new page's sidebar started back at the top.
 *
 * Deliberately module-scope memory only — no `localStorage`. Surviving a
 * remount within the running session is the whole requirement; there is
 * nothing meaningful to restore after a hard reload (the nav's content and
 * viewport height can both differ by then), and a plain module variable is
 * cheap enough to write on every scroll event with no debounce needed — it's
 * one number assignment, not an I/O call.
 */

/** `0` before anything has been recorded this session. */
let cached = 0;

export function readSidebarScroll(): number {
  return cached;
}

export function writeSidebarScroll(scrollTop: number): void {
  cached = scrollTop;
}
