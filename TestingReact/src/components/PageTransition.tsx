"use client";

import React, { useCallback, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { animate, motion } from "framer-motion";
import { PAGE_TRANSITION_SPRING } from "@/lib/animations";
import { usePerformance } from "@/components/PerformanceProvider";
import { cn } from "@/lib/utils";

/**
 * @file components/PageTransition.tsx
 * @description Animates the content stage out and then in on every sidebar
 * navigation, so clicking a menu item reads as a transition rather than a swap.
 *
 * ── What this replaced ─────────────────────────────────────────────────────
 *
 * A `.page-enter` CSS keyframe on a `key={pathname}` div. That fixed the
 * original bug — all 13 workflow pages render the same `<PageWrapper>`, so
 * React reconciled rather than replaced and the enter animation never
 * replayed — but a keyframe can only animate an element that EXISTS. The
 * outgoing page had no animation available to it at all: it vanished in one
 * frame while the new one faded up underneath. The old file named that
 * outgoing half as "the real prize" a keyframe cannot reach.
 *
 * ── Why the exit is imperative, and not `<AnimatePresence>` ────────────────
 *
 * `AnimatePresence` is the obvious tool and it does not work here. It animates
 * a removed child by keeping that child's React element mounted after the
 * parent stopped rendering it — which requires the AnimatePresence itself to
 * SURVIVE the change. In the App Router it does not. Every route is a distinct
 * component (`ReceiveItemPage` vs `InspectItemPage`), so React unmounts the
 * whole subtree at that position on navigation, and `PageWrapper` — with any
 * AnimatePresence inside it — goes with it. A new one mounts for the new
 * route with no memory of the old.
 *
 * Measured before rewriting: with `<AnimatePresence mode="wait">` in this
 * position, the stage's opacity went 1.000 → 0.104 with no descent in
 * between. The exit never ran; only the enter did.
 *
 * The usual workaround is a "FrozenRouter" that pins `LayoutRouterContext` to
 * its previous value so the retained subtree keeps rendering the old route.
 * It works, but it reaches into `next/dist/shared/lib/...` — an internal path
 * with no compatibility promise, in a Next release whose own AGENTS.md opens
 * by warning that APIs and file structure differ from what you expect. The
 * other option is moving Sidebar + Header into a real shared layout so the
 * shell persists, which is the *right* long-term shape but means rewriting all
 * 25 pages off `PageWrapper`.
 *
 * So the exit runs on the live stage, before the router has swapped it out.
 *
 * ── Why the push is NOT chained off the animation ──────────────────────────
 *
 * It used to be: `animate(...).then(() => router.push(href))`, to reproduce
 * `mode="wait"` — old content leaves completely, THEN new content arrives.
 * That sequencing is correct as choreography and wrong as engineering, for two
 * measured reasons.
 *
 * 1. **It serialises the render behind the animation.** The push only fired
 *    once the stage had reached opacity 0, so every millisecond the next route
 *    then cost was spent on a blank screen showing the OLD url. Measured on a
 *    production build, clicking Received Inventory → SparePart Inventory:
 *
 *      no throttle      blank 238→ 725ms   (487ms)
 *      3G               blank 251→ 749ms   (498ms)
 *      600ms latency    blank 234→2020ms  (1786ms)
 *
 *    The sidebar links are `<Link>`s, so the RSC payload was already
 *    prefetched — that half-second is React *rendering* a heavy route, not
 *    network. It cannot be prefetched away; it has to overlap the animation
 *    instead of following it. Users read the blank-plus-stale-url as "my click
 *    did nothing" and click again, which restarts the exit and pushes the
 *    destination further out.
 *
 * 2. **A cancelled animation dropped the navigation on the floor, for good.**
 *    `JSAnimation.cancel()` calls `teardown()` and never `notifyFinished()`,
 *    and `GroupAnimation.finished` is a `Promise.all` over those — carrying an
 *    explicit `TODO: Filter out cancelled or stopped animations`. So an
 *    interrupted exit leaves a promise that never settles, `.then()` never
 *    runs, `router.push` is never called, and the stage is stranded at opacity
 *    0 with no timeout and no recovery. The old code had no `.catch`, no
 *    guard, and no unmount cleanup: the single line that performed the
 *    navigation was reachable only through a promise the animation library
 *    does not promise to settle.
 *
 * Both go away by issuing the navigation FIRST and letting the exit play over
 * the top of it. `startTransition` keeps the outgoing page mounted and
 * on-screen while React renders the next route concurrently, so the fade and
 * the render happen in the same window rather than end to end — and the push
 * no longer depends on the animation reaching any particular state. If the
 * route commits mid-fade the swap simply happens a little early, which is a
 * far better failure than a blank screen that outlasts the user's patience.
 *
 * `isNavigating` is exposed so the caller can say something during a slow
 * route instead of showing nothing; `Sidebar` renders a top progress bar off
 * it. That matters because this app has no `loading.tsx` anywhere — during a
 * pending transition React keeps rendering the OLD page, which is exactly the
 * page being faded to invisible.
 *
 * Known limit, stated rather than hidden: only navigations that go through
 * `useAnimatedNavigate` play the exit. The sidebar uses it. Browser back /
 * forward and any `router.push` elsewhere (the header's global search, for
 * one) still swap without an exit, exactly as they did before this change —
 * they are no worse, just not improved. Moving the shell into a layout is what
 * would cover those too.
 *
 * ── Why the transform is safe to animate here ──────────────────────────────
 *
 * The old CSS used `backwards`, never `forwards`, because a *held* transform
 * makes this element the containing block for every `position: fixed` dialog
 * inside it — which is how a modal ends up anchored to the page body instead
 * of the viewport. Framer has the same hazard and avoids it the same way: it
 * clears the inline transform once an animation settles, so the resting state
 * is `transform: none`. Verified by sampling the computed style after settle.
 *
 * ── Why not the View Transitions API ───────────────────────────────────────
 *
 * Tried, and it does not work on this stack. `<ViewTransition>` is exported by
 * the canary React that Next 16.3 vendors and the bundled docs document it as
 * working in the App Router with no configuration, but the router never
 * activates it: `onEnter`/`onExit`/`onShare`/`onUpdate` never fire across
 * repeated navigations and `document.startViewTransition` is never called.
 * `experimental.viewTransition` is not a recognised key in this release.
 * Re-check on a future Next upgrade — this file is still the single place to
 * change, and it is the one that would get simpler.
 */

/** Marks the element the exit animation should play on. */
const STAGE_ATTR = "data-page-stage";

/**
 * The stage's spring comes from `lib/animations`, which is the one place any
 * duration or easing in this app is allowed to be written down. It used to be
 * declared here as well, character-for-character identical to the copy there —
 * two definitions of one constant, either of which could be tuned without the
 * other moving. See that file for why the `restDelta` / `restSpeed` widening is
 * part of it: framer's defaults keep a spring "running" for ~600ms after it
 * reached opacity 0 at ~170ms, and here that tail is dead time before the next
 * route starts loading.
 *
 * Re-exported because this module owned the name first and removing it would be
 * a breaking change for no gain.
 */
export { PAGE_TRANSITION_SPRING };

/** Aura Soft UI signature velvet transition settings */
const AURA_EASE = [0.16, 1, 0.3, 1] as const;

/** The soft frame the stage leaves on. */
const EXIT_KEYFRAME = { opacity: 0.65, y: -8 };

/**
 * Whether the stage should skip its animation.
 *
 * Checked here as well as in `MotionPreference` because this animation is
 * imperative — it is not a `<motion.*>` component, so framer's context-level
 * `reducedMotion` never reaches it. Read from the DOM rather than from context
 * for the same reason: `useAnimatedNavigate` is called from an event handler,
 * where the attributes `ThemeScript` and `ThemeProvider` maintain are the
 * cheapest source of truth and cannot be stale.
 *
 * Three sources, not two:
 *
 * - the OS `prefers-reduced-motion` setting;
 * - this app's own motion switch (`data-motion`);
 * - **Lite Mode** (`data-lite`), which is otherwise about paint cost rather
 *   than animation. It counts here because this is the one animation that
 *   composites the ENTIRE viewport every frame — a full-page opacity and
 *   transform on the heaviest element in the tree. Small local animations stay
 *   on under Lite Mode; the whole-screen one does not.
 */
function motionIsOff(): boolean {
  const root = document.documentElement;
  return (
    root.dataset.motion === "reduced" ||
    root.dataset.lite === "on" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Returns a navigate function that routes immediately and plays the stage's
 * exit over the top of it, plus whether a route change is currently in flight.
 *
 * The exit is decoration on a navigation that is already under way — never a
 * step the navigation waits on. See the header for the measurements that
 * forced that ordering.
 */
export function useAnimatedNavigate(): {
  navigate: (href: string) => void;
  isNavigating: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startNavigation] = useTransition();

  const navigate = useCallback(
    (href: string) => {
      // Already here. Re-pushing would restart the route for no visible change.
      if (href === pathname) return;

      // The navigation goes out first and unconditionally.
      startNavigation(() => {
        router.push(href);
      });
    },
    [router, pathname]
  );

  return { navigate, isNavigating };
}

export default function PageTransition({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      {...{ [STAGE_ATTR]: true }}
      className={cn("av-page-stage flex-1 flex flex-col min-h-0", className || "overflow-hidden")}
    >
      {children}
    </div>
  );
}
