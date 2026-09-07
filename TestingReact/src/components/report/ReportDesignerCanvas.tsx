"use client";

/**
 * @file report/ReportDesignerCanvas.tsx
 * @description The Templates Settings canvas.
 *
 * ── WHY THIS IS AN OVERLAY AND NOT A SECOND RENDERER ──────────────────────
 * The canvas shows the *same* document the print path and the CamID phone app
 * produce — `src/report-layout/` — and draws its selection rings and badges on
 * a transparent layer above it, positioned from the real elements' bounding
 * boxes.
 *
 * It used to be a 1,926-line React re-implementation of the report, which meant
 * the layout existed twice on the web and a third time on mobile. Three copies
 * of one design drift, and they had: the phone ignored eleven of the fields
 * this canvas edits. Designing against a document that is not the one that
 * prints is the specific problem this file exists to avoid, so resist adding
 * layout here — it belongs in `src/report-layout/`.
 *
 * Every selectable element is found through the `data-rpt-target` attribute the
 * generator stamps on it, so this file knows how to *select* things without
 * knowing how they are laid out.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReportSheet from "@/components/report/ReportSheet";
import { updateReportTemplate } from "@/services/reportTemplate";
import {
  describeTarget,
  isTargetEqual,
  parseDesignTarget,
  type DesignTarget,
  type ReportLabels,
  type ReportTemplateSettings,
  type ReportTicketLike,
  type ResolvedSparePartRow,
} from "@/report-layout";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** An inline edit in progress, and how to end it from anywhere. */
interface ActiveEdit {
  el: HTMLElement;
  finish: (commit: boolean) => void;
}

export interface ReportDesignerCanvasProps {
  item: ReportTicketLike;
  sparePartRows: ResolvedSparePartRow[];
  settings: ReportTemplateSettings;
  showGrid?: boolean;
  zoom?: number;
  selectedTarget?: DesignTarget | null;
  onElementClick?: (target: DesignTarget, at: { x: number; y: number }) => void;
  brandLogoSrc?: string;
}

/** Writes an inline-edited caption back to whichever setting owns it. */
function commitLabelEdit(settings: ReportTemplateSettings, key: string, value: string): void {
  const text = value.replace(/\s+/g, " ").trim();

  if (key === "titleText") {
    updateReportTemplate({ titleText: text });
    return;
  }

  if (key.startsWith("infoRow:")) {
    const [, section, id] = key.split(":");
    const listKey = section === "customer" ? "infoRowsCustomer" : "infoRowsInstrument";
    const list = settings[listKey].map((r) => (r.id === id ? { ...r, label: text } : r));
    updateReportTemplate({ [listKey]: list });
    return;
  }

  updateReportTemplate({ labels: { ...settings.labels, [key as keyof ReportLabels]: text } });
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

export default function ReportDesignerCanvas({
  item,
  sparePartRows,
  settings,
  showGrid = false,
  zoom = 1,
  selectedTarget,
  onElementClick,
  brandLogoSrc,
}: ReportDesignerCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [hoverBox, setHoverBox] = useState<Box | null>(null);

  const editRef = useRef<ActiveEdit | null>(null);

  // `commitLabelEdit` runs on blur, which can be long after the double-click
  // that opened the editor. Reading `settings` from a closure captured then
  // would spread a stale copy over the store and silently revert whatever else
  // was edited in between.
  //
  // Written in an effect, not during render: a render can be discarded and
  // replayed, so a render-time ref write can persist a value from a render that
  // never committed. `react-hooks/refs` flags it, and `FaceLinkQr` documents
  // the same fix.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  /** Bounding box of an element, in the host's own coordinates. */
  const boxOf = useCallback((el: Element): Box | null => {
    const host = hostRef.current;
    if (!host) return null;
    const a = el.getBoundingClientRect();
    const b = host.getBoundingClientRect();
    if (a.width === 0 && a.height === 0) return null;
    return { top: a.top - b.top, left: a.left - b.left, width: a.width, height: a.height };
  }, []);

  const findSelected = useCallback((): Element | null => {
    const host = hostRef.current;
    if (!host || !selectedTarget) return null;
    for (const el of Array.from(host.querySelectorAll<HTMLElement>("[data-rpt-target]"))) {
      if (isTargetEqual(parseDesignTarget(el.dataset.rptTarget), selectedTarget)) return el;
    }
    return null;
  }, [selectedTarget]);

  /**
   * The sheet is regenerated as one HTML string whenever a setting changes, so
   * the selected node is a different DOM element each time and its box has to
   * be measured again.
   *
   * Scroll is listened for in the capture phase, which means *any* scrollable
   * element in the document fires it. Measuring walks every `[data-rpt-target]`
   * node and JSON-parses its attribute, so it is coalesced into one
   * animation frame rather than run per event, and the state is only written
   * when the box actually moved.
   */
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = findSelected();
      const next = el ? boxOf(el) : null;
      setSelectedBox((prev) => (sameBox(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();

    const host = hostRef.current;
    if (!host) return;

    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [findSelected, boxOf, settings, sparePartRows, item, zoom]);

  /**
   * An edit is abandoned when its element leaves the document.
   *
   * That is reachable, and used to wedge the canvas: undo (Ctrl+Z) rewrites the
   * template, which regenerates the sheet's markup and destroys the node being
   * edited. Its blur/keydown listeners went with it, so `finish` never ran, the
   * editing flag stayed set forever, and click and hover — both of which
   * early-return while editing — stopped working until the page was remounted.
   */
  useEffect(() => {
    const active = editRef.current;
    if (active && !active.el.isConnected) active.finish(false);
  });

  // Unmounting mid-edit must still detach the listeners (CLAUDE.md §14).
  useEffect(() => () => editRef.current?.finish(false), []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editRef.current) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-rpt-target]");
    if (!el) return;
    const target = parseDesignTarget(el.dataset.rptTarget);
    if (!target) return;
    e.stopPropagation();
    onElementClick?.(target, { x: e.clientX, y: e.clientY });
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const labelEl = (e.target as HTMLElement).closest<HTMLElement>("[data-rpt-label]");
    const key = labelEl?.dataset.rptLabel;
    if (!labelEl || !key) return;

    e.preventDefault();
    e.stopPropagation();
    editRef.current?.finish(true);

    labelEl.contentEditable = "true";
    labelEl.spellcheck = false;
    labelEl.dataset.rptEditing = "true";
    labelEl.focus();

    const range = document.createRange();
    range.selectNodeContents(labelEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const finish = (commit: boolean) => {
      if (editRef.current?.el !== labelEl) return;
      labelEl.removeEventListener("blur", onBlur);
      labelEl.removeEventListener("keydown", onKeyDown);
      labelEl.contentEditable = "false";
      delete labelEl.dataset.rptEditing;
      editRef.current = null;
      // Force the overlay to re-measure now that the editor chrome is gone.
      setHoverBox(null);
      if (commit) commitLabelEdit(settingsRef.current, key, labelEl.textContent ?? "");
    };

    const onBlur = () => finish(true);
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        finish(true);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        finish(false);
      }
    };

    labelEl.addEventListener("blur", onBlur);
    labelEl.addEventListener("keydown", onKeyDown);
    editRef.current = { el: labelEl, finish };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editRef.current) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-rpt-target]");
    const next = el ? boxOf(el) : null;
    setHoverBox((prev) => (sameBox(prev, next) ? prev : next));
  };

  const ringStyle = (box: Box): React.CSSProperties => ({
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
  });

  return (
    <div
      ref={hostRef}
      className={`relative rpt-designer-host ${showGrid ? "rpt-designer-grid" : ""}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverBox(null)}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
.rpt-designer-grid .rpt-sheet {
  background-color: #ffffff;
  background-image:
    linear-gradient(to right, rgba(0,0,0,0.07) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,0,0,0.07) 1px, transparent 1px),
    linear-gradient(to right, rgba(0,0,0,0.16) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,0,0,0.16) 1px, transparent 1px);
  background-size: 8px 8px, 8px 8px, 32px 32px, 32px 32px;
}
.rpt-designer-host [data-rpt-target] { cursor: pointer; }
.rpt-designer-host [data-rpt-label] { cursor: text; }
.rpt-designer-host [data-rpt-editing] {
  outline: 2px solid var(--av-accent, #2563eb);
  background: rgba(37, 99, 235, 0.08);
}
`,
        }}
      />

      <ReportSheet
        item={item}
        sparePartRows={sparePartRows}
        settings={settings}
        zoom={zoom}
        design
        brandLogoSrc={brandLogoSrc}
      />

      {/* Selection chrome. Pointer-events off so it never intercepts a click
          meant for the element underneath it. */}
      {hoverBox && !sameBox(hoverBox, selectedBox) && (
        <div
          className="pointer-events-none absolute z-30 rounded-xs border border-dashed border-accent/60 bg-accent/5"
          style={ringStyle(hoverBox)}
        />
      )}

      {selectedBox && selectedTarget && (
        <div className="pointer-events-none absolute z-40 rounded-xs ring-2 ring-accent bg-accent/10" style={ringStyle(selectedBox)}>
          <span className="absolute -top-1 -left-1 w-2 h-2 bg-accent border border-white rounded-xs shadow-xs" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent border border-white rounded-xs shadow-xs" />
          <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-accent border border-white rounded-xs shadow-xs" />
          <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-accent border border-white rounded-xs shadow-xs" />
          <span className="absolute -top-4 right-0 px-1.5 rounded bg-accent text-white text-[8px] font-bold font-mono uppercase whitespace-nowrap shadow-xs">
            ● {describeTarget(selectedTarget)}
          </span>
        </div>
      )}
    </div>
  );
}
