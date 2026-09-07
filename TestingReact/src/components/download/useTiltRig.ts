"use client";

/**
 * @file components/download/useTiltRig.ts
 * @description Pointer-driven perspective tilt, shared by the hero phone rig
 * (±11°) and the platform cards (±3°).
 *
 * The element with the handlers need not be the element that rotates — the
 * hero tracks the whole stage and rotates only the rig. Springs give the
 * physicality; on pointer-leave both axes return to identity (the hero's
 * three-quarter resting pose is a STATIC parent transform, so "identity" here
 * still reads as a composed 3D pose).
 *
 * Gates: touch devices (no `pointer: fine`) and static motion mode get inert
 * handlers and a rig frozen at identity. `frozen` also zeroes the rig while a
 * QR panel is open — a QR rasterized under a 3D transform can stop scanning.
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
const readFinePointer = () => window.matchMedia("(pointer: fine)").matches;

export interface TiltRig {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  /** Sprung horizontal pointer position (-0.5..0.5), for sheen effects. */
  springPx: MotionValue<number>;
}

export function useTiltRig(rangeY: number, rangeX: number, frozen: boolean): TiltRig {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // A device does not grow a mouse mid-session; server snapshot is `false` so
  // nothing tilt-related reaches the server HTML (usePasskeySupport pattern).
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

  return { onPointerMove, onPointerLeave, rotateX, rotateY, springPx };
}
