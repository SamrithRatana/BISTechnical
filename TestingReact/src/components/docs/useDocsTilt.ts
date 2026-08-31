"use client";

/**
 * @file components/docs/useDocsTilt.ts
 * @description Pointer-driven perspective tilt for the Docs hub — the atlas
 * rig (±13°) and the chapter cards (±3.5°).
 *
 * A page-local rig, matching how `/login` (`useLoginTilt`) and `/download`
 * (`useTiltRig`) each own theirs: the three pages want different ranges, a
 * different frozen policy and, here, both sprung pointer axes exposed so the
 * atlas can steer its parallax layers as well as its rotation.
 *
 * Gates: touch devices (no `pointer: fine`) and static motion mode get inert
 * handlers and a rig frozen at identity, so nothing tilts under a finger and
 * nothing moves when the reader has asked for stillness.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { TILT_SPRING } from "./motion";

const subscribeNever = () => () => {};

/**
 * One `MediaQueryList` for the whole page, created lazily on first use.
 *
 * `getSnapshot` runs at least twice per render per hook, and this page mounts
 * one rig per topic card — constructing a fresh `MediaQueryList` in there meant
 * a hundred-plus throwaway objects on every keystroke in the search box.
 */
let finePointerQuery: MediaQueryList | null = null;
const readFinePointer = () => {
  finePointerQuery ??= window.matchMedia("(pointer: fine)");
  return finePointerQuery.matches;
};

export interface DocsTiltRig {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  /** Sprung pointer position (-0.5..0.5), for parallax and sheen. */
  springPx: MotionValue<number>;
  springPy: MotionValue<number>;
}

export function useDocsTilt(rangeY: number, rangeX: number, frozen: boolean): DocsTiltRig {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // A device does not grow a mouse mid-session; the server snapshot is `false`
  // so nothing tilt-related reaches the server HTML.
  const finePointer = useSyncExternalStore(subscribeNever, readFinePointer, () => false);

  const springPx = useSpring(px, TILT_SPRING);
  const springPy = useSpring(py, TILT_SPRING);
  const rotateY = useTransform(springPx, [-0.5, 0.5], [-rangeY, rangeY]);
  const rotateX = useTransform(springPy, [-0.5, 0.5], [rangeX, -rangeX]);

  const active = finePointer && !frozen;

  useEffect(() => {
    if (!active) {
      px.set(0);
      py.set(0);
    }
  }, [active, px, py]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!active) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      px.set((e.clientX - rect.left) / rect.width - 0.5);
      py.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [active, px, py]
  );

  const onPointerLeave = useCallback(() => {
    px.set(0);
    py.set(0);
  }, [px, py]);

  return { onPointerMove, onPointerLeave, rotateX, rotateY, springPx, springPy };
}
