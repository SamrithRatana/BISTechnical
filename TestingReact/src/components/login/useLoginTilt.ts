"use client";

/**
 * @file components/login/useLoginTilt.ts
 * @description Pointer-driven perspective tilt + parallax source for the whole
 * login stage. Sibling of `download/useTiltRig` rather than an import of it:
 * this rig additionally exposes BOTH sprung pointer axes, because the backdrop
 * layers (aurora, grid, particles) parallax against the same pointer the card
 * tilts with — one pointer, many depths, or the scene falls apart.
 *
 * The element with the handlers need not be the element that rotates — the
 * page tracks the stage and rotates only the card rig. Springs give the
 * physicality; on pointer-leave both axes return to identity.
 *
 * Gates: touch devices (no `pointer: fine`) and static motion mode get inert
 * handlers and a rig frozen at identity. `frozen` also zeroes the rig while
 * the phone QR or the face-capture camera is on screen — a QR rasterized
 * under a 3D transform can stop scanning (same rule as the download page).
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { STAGE_TILT_RANGE, TILT_SPRING } from "./motion";

const subscribeNever = () => () => {};
const readFinePointer = () => window.matchMedia("(pointer: fine)").matches;

export interface LoginTiltRig {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  /** Sprung pointer position (-0.5..0.5), for parallax layers. */
  springPx: MotionValue<number>;
  springPy: MotionValue<number>;
}

export function useLoginTilt(frozen: boolean): LoginTiltRig {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // A device does not grow a mouse mid-session; server snapshot is `false` so
  // nothing tilt-related reaches the server HTML (usePasskeySupport pattern).
  const finePointer = useSyncExternalStore(subscribeNever, readFinePointer, () => false);

  const springPx = useSpring(px, TILT_SPRING);
  const springPy = useSpring(py, TILT_SPRING);
  const rotateY = useTransform(springPx, [-0.5, 0.5], [-STAGE_TILT_RANGE, STAGE_TILT_RANGE]);
  const rotateX = useTransform(springPy, [-0.5, 0.5], [STAGE_TILT_RANGE, -STAGE_TILT_RANGE]);

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
