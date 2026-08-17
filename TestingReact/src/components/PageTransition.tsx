"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { animate, motion } from "framer-motion";

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
 * So the exit runs BEFORE the route changes instead. `useAnimatedNavigate`
 * plays it on the live stage, waits for it to finish, and only then pushes.
 * That reproduces the reference app's `mode="wait"` sequencing exactly — old
 * content leaves completely, then new content arrives — without depending on a
 * component surviving a change that destroys it.
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
 * The content stage's spring, lifted from the reference app's `AnimatePresence`
 * block so the two apps move identically.
 *
 * `restDelta` / `restSpeed` are the one addition. A spring approaches its
 * target asymptotically, and framer's defaults keep it "running" long after it
 * is visually finished — measured in the reference, the exit reached opacity 0
 * at ~170ms but the spring did not report itself settled until ~600ms. That
 * tail is invisible, and here it would be dead time the user waits through
 * before the next route even starts loading. Widening the rest thresholds ends
 * the animation when it stops being perceptible, which is the same picture and
 * roughly a third of the wait.
 */
export const PAGE_TRANSITION_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 30,
  restDelta: 0.01,
  restSpeed: 0.5,
} as const;

/** The frame the stage leaves on, matching the reference's `exit`. */
const EXIT_KEYFRAME = { opacity: 0, y: -10, scale: 0.99 };

/**
 * Whether motion is switched off, by either of the two routes the stylesheet
 * already honours: the OS preference, or this app's own setting.
 *
 * Checked here as well as in `MotionPreference` because this animation is
 * imperative — it is not a `<motion.*>` component, so framer's context-level
 * `reducedMotion` never reaches it.
 */
function motionIsOff(): boolean {
  return (
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Returns a navigate function that plays the stage's exit, then routes.
 *
 * Falls straight through to a plain push whenever there is nothing to animate:
 * no stage on screen, motion switched off, or the destination is already the
 * current page.
 */
export function useAnimatedNavigate(): (href: string) => void {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (href: string) => {
      const stage = document.querySelector<HTMLElement>(`[${STAGE_ATTR}]`);

      if (href === pathname || !stage || motionIsOff()) {
        router.push(href);
        return;
      }

      // `void`, not `await`: the push is chained off the animation's own
      // promise below, and nothing else needs to block on it.
      void animate(stage, EXIT_KEYFRAME, PAGE_TRANSITION_SPRING).then(() => {
        router.push(href);
      });
    },
    [router, pathname]
  );
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
    <motion.div
      // Still keyed on the pathname. The stage is re-created by the router on
      // every navigation anyway, but the key also covers the case the original
      // fix was written for: two routes that DO reconcile would otherwise reuse
      // this node and skip the enter entirely.
      key={pathname}
      {...{ [STAGE_ATTR]: true }}
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={PAGE_TRANSITION_SPRING}
      className={className}
    >
      {children}
    </motion.div>
  );
}
