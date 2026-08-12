"use client";

/**
 * @file useFloatingPanel.ts
 * @description Shared positioning logic for portaled dropdown/popover panels
 * anchored to a trigger element (StatusUpdateDropdown, the spare-part search
 * dropdown in InspectItemDialog, ...).
 *
 * Anything rendered `absolute` inside a scrolling container — ServiceTable's
 * row wrapper, a modal body with overflow-y-auto — gets clipped at that
 * container's own edge no matter its z-index. The fix used everywhere here is
 * to portal the panel to document.body and position it with `fixed`
 * coordinates measured from the trigger's real getBoundingClientRect(),
 * which this hook computes, clamps to the viewport, and flips above the
 * trigger when there isn't room below.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface FloatingCoords {
  top: number;
  left: number;
  width: number;
  placement: "top" | "bottom";
}

interface UseFloatingPanelOptions {
  open: boolean;
  onClose: () => void;
  /** Fixed panel width in px, or "match" to match the trigger's own width */
  width: number | "match";
  /** Rough panel height, used only to decide whether to flip above the trigger */
  estimatedHeight: number;
  /** "center" for a small pill trigger, "start" for a full-width search input */
  align?: "center" | "start";
}

const GAP = 6;
const VIEWPORT_MARGIN = 8;

export function useFloatingPanel<
  TAnchor extends HTMLElement = HTMLElement,
  TPanel extends HTMLElement = HTMLElement
>({ open, onClose, width, estimatedHeight, align = "center" }: UseFloatingPanelOptions) {
  const anchorRef = useRef<TAnchor>(null);
  const panelRef = useRef<TPanel>(null);
  const [coords, setCoords] = useState<FloatingCoords | null>(null);

  const computeCoords = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const panelWidth = width === "match" ? rect.width : width;

    let left = align === "start" ? rect.left : rect.left + rect.width / 2 - panelWidth / 2;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), viewportW - panelWidth - VIEWPORT_MARGIN);

    const spaceBelow = viewportH - rect.bottom;
    const placement: "top" | "bottom" =
      spaceBelow < estimatedHeight + GAP && rect.top > estimatedHeight + GAP ? "top" : "bottom";
    const top = placement === "bottom" ? rect.bottom + GAP : rect.top - GAP;

    setCoords({ top, left, width: panelWidth, placement });
  };

  // Position must be measured before paint so the panel never flashes at 0,0.
  useLayoutEffect(() => {
    if (open) computeCoords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        anchorRef.current && !anchorRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // A scrolling ancestor (the table body, a modal's body) doesn't bubble
    // scroll to window, but a capture-phase listener still fires for it.
    // Closing rather than repositioning is deliberate: the trigger moves out
    // from under the pointer the instant its container scrolls, so tracking
    // it would just relocate the panel to a spot the user didn't ask for.
    // Scrolling inside the panel's own list is excluded: that's not the
    // trigger moving, it's the user reading the list, and "scroll" also
    // fires during capture for that element since it's inside window's
    // capture path — without this check the panel closes the instant a
    // scroll gesture starts on it.
    function handleScrollOrResize(e: Event) {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) {
        return;
      }
      onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, onClose]);

  return { anchorRef, panelRef, coords };
}
