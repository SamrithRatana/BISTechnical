"use client";

/**
 * @file templates-settings/page.tsx
 * @description Master Report Templates Hub & Studio Designer.
 *
 * Features:
 * - Templates Catalog Gallery: Visual cards organizing all 29 enterprise reports across 5 categories
 * - A4 Document Studio: DevExpress-grade canvas for printable forms (Technical Service Report)
 * - Excel Spreadsheet Studio: Column mapping, width sizing, data formatting, and aggregations for 28 data reports
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PageWrapper from "@/components/PageWrapper";
import toast, { Toaster } from "react-hot-toast";
import {
  undoReportTemplate,
  redoReportTemplate,
  loadFactoryDefaults,
  copyComponentToClipboard,
  pasteComponentFromClipboard,
  getActiveClipboard,
} from "@/services/reportTemplate";
import { ToggleGroup } from "@/components/av/ToggleGroup";
import TemplateControls from "@/components/report/TemplateControls";
import ReportDesignerCanvas from "@/components/report/ReportDesignerCanvas";
import ReportSheet from "@/components/report/ReportSheet";
import ReportPrintPortal from "@/components/report/ReportPrintPortal";
import { useBrandLogo } from "@/services/brandLogoStore";
import { type ResolvedSparePartRow, type DesignTarget } from "@/report-layout";
import PropertyInspector from "@/components/report/PropertyInspector";
import TemplateCatalogGallery from "@/components/report/TemplateCatalogGallery";
import ExcelReportDesigner from "@/components/report/ExcelReportDesigner";
import type { ReportDefinition } from "@/services/reportCatalog";
import { useReportTemplateDraft, syncReportTemplateFromServer } from "@/services/reportTemplate";
import { fetchRepairServices, type RepairServiceItem } from "@/services/api";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  PanelLeft,
  PanelRight,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Sliders,
  Undo2,
  Redo2,
  Copy,
  Clipboard,
  ChevronLeft,
  FileText,
  Printer,
  RefreshCw,
} from "lucide-react";

/**
 * Fallback sample ticket data for honest-looking live preview.
 */
const SAMPLE_ITEM = {
  id: "sample",
  reportNo: "SAMPLE-0001",
  status: "Finished",
  serviceDate: new Date("2026-01-15T08:30:00").toISOString(),
  finishedDate: new Date("2026-01-16T15:00:00").toISOString(),
  serviceLocation: "CompanyService",
  hasContract: true,
  companyName: "Sample Customer Co., Ltd.",
  contactName: "Mr. Sample Contact",
  phoneNumber: "012 345 678",
  address: "No. 1, Sample Street, Phnom Penh",
  itemName: "CANON imageRUNNER C3520I",
  serialNumber: "SAMPLE0001",
  serviceType: "Charge",
  customerRequest: "Printer shows error code and stops printing.",
  inspection: "Inspected fuser unit; found worn film sleeve.",
  solution: "Replaced fuser film sleeve and pressure roller gear.",
} as unknown as RepairServiceItem;

/** Stable identity for "this ticket has no spare parts". */
const NO_ROWS: ResolvedSparePartRow[] = [];

const SAMPLE_ROWS: ResolvedSparePartRow[] = [
  { id: "r1", itemName: "Fuser Film Sleeve", useFor: "iRC3020/C3025/C3520i", sparePartId: "FM1-P280-Film", quantity: 1, condition: "Replace", unitPrice: 45, remarks: "" },
  { id: "r2", itemName: "Lower Pressure Roller Gear", useFor: "iRC3020/C3025/C3520i", sparePartId: "FU8-0575-000", quantity: 2, condition: "Replace", unitPrice: 12.5, remarks: "" },
];

export default function TemplatesSettingsPage() {
  const { t, lang } = useI18n();
  const settings = useReportTemplateDraft();

  // Active Selected Report: null = Gallery View; ReportDefinition = Active Studio
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);

  const [mode, setMode] = useState<"design" | "preview" | "print">("design");
  const [selectedTarget, setSelectedTarget] = useState<DesignTarget | null>(null);

  const [clipboard, setClipboard] = useState(getActiveClipboard());

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState<number>(0.78);
  const canvasContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Fullscreen toggle with native browser Fullscreen API & Escape listener
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  // Smart Fit Zoom calculation for responsive canvases
  const handleFitZoom = React.useCallback(() => {
    if (!canvasContainerRef.current) return;
    const availableWidth = canvasContainerRef.current.clientWidth - 40;
    if (availableWidth > 150) {
      const calculatedZoom = Math.max(0.35, Math.min(1.15, Number((availableWidth / 830).toFixed(2))));
      setZoom(calculatedZoom);
    }
  }, []);

  // Auto-adjust layout on window resize
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 1200) {
        setLeftOpen(false);
      } else {
        setLeftOpen(true);
      }
      // On laptops (< 1536px, e.g. 1366x768), default inspector closed until element selected
      if (w < 1536) {
        setRightOpen(false);
      } else {
        setRightOpen(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Automatically recalculate optimal canvas zoom on container resize or panel change
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const update = () => handleFitZoom();
    update();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [handleFitZoom, mode, selectedReport, leftOpen, rightOpen]);

  // Keyboard Shortcuts for Studio: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+C, Ctrl+V
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // A `contentEditable` element is neither an input nor a textarea, so
      // without the third test Ctrl+Z inside the canvas's inline label editor
      // ran the studio's own undo — which rewrote the template, regenerated the
      // sheet, and destroyed the node the user was typing in.
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      // Ctrl + Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (!isInput) {
          e.preventDefault();
          if (undoReportTemplate()) {
            toast.success("Undone (Ctrl+Z)", { duration: 1500, id: "undo" });
          }
        }
      }

      // Ctrl + Y or Ctrl + Shift + Z (Redo)
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        if (!isInput) {
          e.preventDefault();
          if (redoReportTemplate()) {
            toast.success("Redone (Ctrl+Y)", { duration: 1500, id: "redo" });
          }
        }
      }

      // Ctrl + C (Copy selected component)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !isInput) {
        if (selectedTarget) {
          e.preventDefault();
          copyComponentToClipboard(selectedTarget, settings);
          setClipboard(getActiveClipboard());
          toast.success("Component copied! (Ctrl+C)", { duration: 2000, id: "copy" });
        }
      }

      // Ctrl + V (Paste component)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && !isInput) {
        const clip = getActiveClipboard();
        if (clip) {
          e.preventDefault();
          const res = pasteComponentFromClipboard(clip, settings);
          if (res?.target) setSelectedTarget(res.target);
          toast.success("Component pasted! (Ctrl+V)", { duration: 2000, id: "paste" });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTarget, settings]);

  const [previewItem, setPreviewItem] = useState<RepairServiceItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Synchronize company template on mount
  useEffect(() => {
    void syncReportTemplateFromServer();
  }, []);

  // Fetch newest real ticket for authentic live preview
  useEffect(() => {
    let cancelled = false;
    fetchRepairServices(1, 1, "All")
      .then((res) => {
        if (!cancelled && res.items.length > 0) setPreviewItem(res.items[0]);
      })
      .catch(() => {
        // Fallback sample data renders
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [useSampleData, setUseSampleData] = useState(false);
  // Subscribed, not snapshotted: a logo changed in Settings while the designer
  // is open must update here too, or the canvas stops matching the printout.
  const brandLogoSrc = useBrandLogo() ?? undefined;

  const item = (useSampleData || !previewItem) ? SAMPLE_ITEM : previewItem;
  // A fresh `[]` here would be a new identity on every render, rebuilding the
  // report HTML and tearing down the canvas's ResizeObserver and window
  // listeners each time — the effect-cleanup-effect churn CLAUDE.md §14 warns
  // about. One frozen empty array instead.
  const rows = (useSampleData || !previewItem) ? SAMPLE_ROWS : NO_ROWS;

  const [showRuler, setShowRuler] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  return (
    <PageWrapper titleKey="tpl.title" subtitleKey="tpl.subtitle">
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {/* ── 1. GALLERY VIEW (IF NO REPORT IS SELECTED) ── */}
        {!selectedReport ? (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-20">
            <TemplateCatalogGallery
              onSelectReport={(rep) => setSelectedReport(rep)}
            />
          </div>
        ) : selectedReport.type === "excel" ? (
          /* ── 2. EXCEL SPREADSHEET REPORT DESIGNER ── */
          <ExcelReportDesigner
            // Remount on a different report: the designer derives its whole
            // sheet model in a `useState` initializer, and a key is how that
            // re-runs — the alternative was an effect re-deriving it a render
            // later, which is a cascading render.
            key={selectedReport.id}
            report={selectedReport}
            onBackToGallery={() => setSelectedReport(null)}
          />
        ) : (() => {
          const a4StudioContent = (
            <div
              className={
                isFullscreen
                  ? "fixed inset-0 z-[99999] bg-[#F1F5F9] dark:bg-slate-950 p-2 sm:p-3 h-screen w-screen overflow-hidden flex flex-col gap-2.5 shadow-2xl"
                  : "flex-1 min-h-0 flex flex-col gap-3"
              }
            >
              {/* Studio Navigation & Mode Bar */}
              <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReport(null)}
                    className="px-2.5 py-1.5 rounded-xl bg-sunken hover:bg-cushion border border-subtle text-xs font-bold text-ink flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{lang === "km" ? "ផ្ទាំង Templates ទាំងអស់" : "All Report Templates"}</span>
                  </button>
                  <div className="h-5 w-px bg-subtle hidden sm:block" />
                  <span className="text-xs font-bold text-ink hidden sm:inline flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-accent" />
                    <span>{selectedReport.name}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <ToggleGroup
                    ariaLabel="Report designer mode"
                    options={[
                      { value: "design", label: t("tpl.tabDesign") },
                      { value: "preview", label: t("tpl.tabPreview") },
                      { value: "print", label: t("tpl.tabPrint") },
                    ]}
                    value={mode}
                    onChange={setMode}
                  />
                  <p className="text-[11px] text-ink-muted hidden md:block">
                    {loading ? t("tpl.loadingPreview") : previewItem ? item.reportNo : t("tpl.sampleData")}
                  </p>
                  {/* Prominent Fullscreen Button on Navigation Bar */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs border ${
                      isFullscreen
                        ? "bg-accent text-white border-accent font-extrabold"
                        : "bg-sunken border-subtle text-ink hover:bg-cushion"
                    }`}
                    title={isFullscreen ? "Exit Fullscreen (Esc)" : "View Full Screen Design (100% Canvas)"}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    <span>{isFullscreen ? (lang === "km" ? "ចេញ" : "Exit") : (lang === "km" ? "ពេញអេក្រង់" : "Full Screen")}</span>
                  </button>
                </div>
              </div>

              {mode === "design" ? (
                <div
                  key="design"
                  className="enter-fade flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row gap-2.5 sm:gap-3 h-full relative"
                >
                {/* Left Drawer Backdrop for Mobile/Tablet */}
                {leftOpen && (
                  <div
                    onClick={() => setLeftOpen(false)}
                    className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
                  />
                )}

                {/* Left Pane: Studio Controls & Database Field Explorer */}
                <div
                  className={`fixed inset-y-0 left-0 z-50 w-[300px] sm:w-[340px] bg-surface p-3 sm:p-4 border-r border-subtle shadow-2xl transition-transform duration-200 overflow-y-auto lg:static lg:z-auto lg:translate-x-0 lg:shadow-none lg:border-none lg:p-0 lg:transition-all lg:duration-200 ${
                    leftOpen ? "translate-x-0 lg:w-72 xl:w-76 2xl:w-84 shrink-0" : "-translate-x-full lg:w-0 lg:opacity-0 lg:pointer-events-none shrink-0"
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-subtle lg:hidden">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-ink">
                      <Sliders className="w-4 h-4 text-accent" />
                      <span>Studio Controls</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setLeftOpen(false)}
                      className="p-1 rounded-lg hover:bg-cushion text-ink-muted hover:text-ink cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <TemplateControls onSelectTarget={setSelectedTarget} />
                </div>

                {/* Center Pane: Smooth Centered Canvas Workspace with DevExpress Rulers & Grid */}
                <div className="flex-1 min-w-0 flex flex-col rounded-2xl border border-subtle bg-[#F1F5F9] shadow-inner overflow-hidden relative h-full">
                  {/* Canvas Zoom & Status Toolbar */}
                  <div className="p-1.5 sm:p-2 px-2 sm:px-3 border-b border-subtle bg-surface/95 backdrop-blur flex items-center justify-between gap-1.5 shrink-0 z-20 overflow-x-auto">
                    {/* Left Drawer Toggle & Status Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        title={leftOpen ? "Hide Studio Panel" : "Show Studio Panel"}
                        onClick={() => setLeftOpen(!leftOpen)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                          leftOpen
                            ? "bg-accent/15 border-accent/40 text-accent"
                            : "bg-sunken border-subtle text-ink-secondary hover:text-ink hover:bg-cushion"
                        }`}
                      >
                        <PanelLeft className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline text-[10px]">Controls</span>
                      </button>

                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-secondary hidden sm:flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-accent" />
                        {t("tpl.tabDesign")}
                      </span>
                    </div>

                    {/* DevExpress Studio Tools (Undo/Redo, Copy/Paste, Defaults, Grid, Rulers, Zoom) */}
                    <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                      {/* Undo / Redo Group */}
                      <div className="flex items-center gap-0.5 bg-sunken p-0.5 rounded-lg border border-subtle">
                        <button
                          type="button"
                          title="Undo (Ctrl+Z)"
                          onClick={() => {
                            if (undoReportTemplate()) toast.success("Undone", { duration: 1500, id: "undo" });
                          }}
                          className="p-1 sm:px-1.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 text-ink hover:bg-cushion transition cursor-pointer"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span className="hidden 2xl:inline">Undo</span>
                        </button>
                        <button
                          type="button"
                          title="Redo (Ctrl+Y)"
                          onClick={() => {
                            if (redoReportTemplate()) toast.success("Redone", { duration: 1500, id: "redo" });
                          }}
                          className="p-1 sm:px-1.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 text-ink hover:bg-cushion transition cursor-pointer"
                        >
                          <Redo2 className="w-3.5 h-3.5" />
                          <span className="hidden 2xl:inline">Redo</span>
                        </button>
                      </div>

                      {/* Copy / Paste Group */}
                      <div className="flex items-center gap-0.5 bg-sunken p-0.5 rounded-lg border border-subtle">
                        <button
                          type="button"
                          title="Copy Selected Component (Ctrl+C)"
                          disabled={!selectedTarget}
                          onClick={() => {
                            if (selectedTarget) {
                              copyComponentToClipboard(selectedTarget, settings);
                              setClipboard(getActiveClipboard());
                              toast.success("Component copied! (Ctrl+C)", { duration: 2000, id: "copy" });
                            }
                          }}
                          className="p-1 sm:px-1.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 text-ink hover:bg-cushion disabled:opacity-30 transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span className="hidden 2xl:inline">Copy</span>
                        </button>
                        <button
                          type="button"
                          title="Paste Component (Ctrl+V)"
                          disabled={!clipboard}
                          onClick={() => {
                            const clip = getActiveClipboard() || clipboard;
                            if (clip) {
                              const res = pasteComponentFromClipboard(clip, settings);
                              if (res?.target) setSelectedTarget(res.target);
                              toast.success("Component pasted! (Ctrl+V)", { duration: 2000, id: "paste" });
                            }
                          }}
                          className="p-1 sm:px-1.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 text-ink hover:bg-cushion disabled:opacity-30 transition cursor-pointer"
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                          <span className="hidden 2xl:inline">Paste</span>
                        </button>
                      </div>

                      {/* Reset to Factory Defaults */}
                      <button
                        type="button"
                        title="Reset template to original factory layout"
                        onClick={() => {
                          if (confirm("Reset template back to original factory defaults? All custom positions and offsets will be cleared.")) {
                            loadFactoryDefaults();
                            setSelectedTarget(null);
                            toast.success("Reset to original factory template!", { duration: 2000, id: "factory" });
                          }
                        }}
                        className="px-1.5 sm:px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-subtle bg-sunken text-ink-secondary hover:text-ink hover:bg-cushion transition cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden sm:inline">Default</span>
                      </button>

                      {/* Grid Toggle */}
                      <button
                        type="button"
                        title="Toggle Designer Grid"
                        onClick={() => setShowGrid(!showGrid)}
                        className={`px-1.5 sm:px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                          showGrid
                            ? "bg-accent/15 border-accent/40 text-accent shadow-2xs"
                            : "bg-sunken border-subtle text-ink-muted hover:text-ink hover:bg-cushion"
                        }`}
                      >
                        <span>▦ Grid</span>
                      </button>

                      {/* Ruler Toggle */}
                      <button
                        type="button"
                        title="Toggle Rulers"
                        onClick={() => setShowRuler(!showRuler)}
                        className={`px-1.5 sm:px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                          showRuler
                            ? "bg-accent/15 border-accent/40 text-accent shadow-2xs"
                            : "bg-sunken border-subtle text-ink-muted hover:text-ink hover:bg-cushion"
                        }`}
                      >
                        <span>📏</span>
                      </button>

                      {/* Zoom Controls */}
                      <div className="flex items-center gap-0.5 bg-sunken p-0.5 rounded-lg border border-subtle">
                        <button
                          type="button"
                          title="Zoom Out"
                          onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.08).toFixed(2))))}
                          className="w-5 h-5 rounded flex items-center justify-center text-ink hover:bg-cushion transition cursor-pointer text-xs font-bold"
                        >
                          <ZoomOut className="w-3 h-3" />
                        </button>
                        <span className="text-[10.5px] font-mono font-bold text-ink px-1 min-w-8 text-center">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          type="button"
                          title="Zoom In"
                          onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.08).toFixed(2))))}
                          className="w-5 h-5 rounded flex items-center justify-center text-ink hover:bg-cushion transition cursor-pointer text-xs font-bold"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title="Fit to screen width"
                          onClick={handleFitZoom}
                          className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold text-accent hover:bg-accent/10 transition cursor-pointer"
                        >
                          Fit
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoom(1.0)}
                          className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold text-ink-secondary hover:text-ink hover:bg-cushion transition cursor-pointer hidden md:inline"
                        >
                          100%
                        </button>
                      </div>

                      {/* Right Inspector Drawer Toggle */}
                      <button
                        type="button"
                        title={rightOpen ? "Hide Inspector Panel" : "Show Inspector Panel"}
                        onClick={() => setRightOpen(!rightOpen)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                          rightOpen
                            ? "bg-accent/15 border-accent/40 text-accent"
                            : "bg-sunken border-subtle text-ink-secondary hover:text-ink hover:bg-cushion"
                        }`}
                      >
                        <span className="hidden xl:inline text-[10px]">Inspector</span>
                        <PanelRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Fullscreen Studio Toggle */}
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs border ${
                          isFullscreen
                            ? "bg-accent text-white border-accent font-extrabold"
                            : "bg-sunken border-subtle text-ink hover:bg-cushion"
                        }`}
                        title={isFullscreen ? "Exit Fullscreen (Esc)" : "View Full Screen Design (100% Canvas)"}
                      >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        <span>{isFullscreen ? (lang === "km" ? "ចេញ" : "Exit") : (lang === "km" ? "ពេញអេក្រង់" : "Full Screen")}</span>
                      </button>
                    </div>
                  </div>

                  {/* DevExpress Top Horizontal Tan Ruler */}
                  {showRuler && (
                    <div className="h-6 border-b border-[#D1CA9B] bg-[#FAF5D8] flex items-end text-[9px] font-mono text-[#5C5632] select-none overflow-hidden pl-8 shrink-0 shadow-2xs">
                      <div className="flex w-[794px] justify-between px-1 relative">
                        {[
                          { num: 0, label: "0\"" },
                          { num: 1, label: "1\"" },
                          { num: 2, label: "2\"" },
                          { num: 3, label: "3\"" },
                          { num: 4, label: "4\"" },
                          { num: 5, label: "5\"" },
                          { num: 6, label: "6\"" },
                          { num: 7, label: "7\"" },
                          { num: 8, label: "8\" (A4)" },
                        ].map((tick, idx) => (
                          <div key={tick.num} className="flex flex-col items-center relative" style={{ width: idx === 8 ? "auto" : "96px" }}>
                            <span className="leading-none pb-0.5 font-bold">{tick.label}</span>
                            <div className="w-px h-2.5 bg-[#8C8454]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Centered Scrollable Canvas Workspace */}
                  <div
                    ref={canvasContainerRef}
                    className="flex-1 overflow-auto p-3 sm:p-6 flex justify-center items-start relative bg-[#E2E8F0] select-none"
                    data-rpt-design
                  >
                    {/* The designer's hover and selection affordances moved into
                        ReportDesignerCanvas, which draws them as an overlay
                        positioned from each element's real bounding box. The
                        block that used to sit here styled
                        `#printable-report-document` — an id that no longer
                        exists — and `.rpt-hot`, which nothing ever applied. */}

                    <div className="flex items-start gap-1" style={{ zoom }}>
                      {/* DevExpress Left Band Strips in Design Mode */}
                      {showRuler && (
                        <div className="w-7 shrink-0 flex flex-col rounded-l border border-r-0 border-[#D1CA9B] bg-[#FAF5D8] text-[8px] font-mono text-[#5C5632] select-none overflow-hidden shadow-sm" style={{ height: "270mm" }}>
                          <div className="h-10 border-b border-[#D1CA9B] bg-[#A7F3D0] text-[#065F46] flex items-center justify-center font-bold [writing-mode:vertical-lr] rotate-180">
                            TopMargin
                          </div>
                          <div className="h-28 border-b border-[#D1CA9B] bg-[#99F6E4] text-[#115E59] flex items-center justify-center font-bold [writing-mode:vertical-lr] rotate-180">
                            Header
                          </div>
                          <div className="h-32 border-b border-[#D1CA9B] bg-[#BAE6FD] text-[#0369A1] flex items-center justify-center font-bold [writing-mode:vertical-lr] rotate-180">
                            Customer
                          </div>
                          <div className="h-28 border-b border-[#D1CA9B] bg-[#C7D2FE] text-[#3730A3] flex items-center justify-center font-bold [writing-mode:vertical-lr] rotate-180">
                            Instrument
                          </div>
                          <div className="h-32 border-b border-[#D1CA9B] bg-[#E9D5FF] text-[#6B21A8] flex items-center justify-center font-bold [writing-mode:vertical-lr] rotate-180">
                            Actions
                          </div>
                          <div className="flex-1 border-b border-[#D1CA9B] bg-[#FEF08A] text-[#854D0E] flex items-center justify-center font-bold [writing-mode:vertical-lr] rotate-180">
                            Detail (Table)
                          </div>
                          <div className="h-32 border-b border-[#D1CA9B] bg-[#FED7AA] text-[#9A3412] flex items-center justify-center font-bold [writing-mode:vertical-lr] rotate-180">
                            Signatures
                          </div>
                          <div className="h-12 bg-[#DDD6FE] text-[#5B21B6] flex items-center justify-center font-bold [writing-mode:vertical-lr] rotate-180">
                            BottomMargin
                          </div>
                        </div>
                      )}

                      {/* White A4 Report Sheet with Crisp DevExpress Graph Grid */}
                      <div className="shadow-2xl shadow-black/35 rounded-sm border border-[#94A3B8] bg-white">
                        <ReportDesignerCanvas
                          item={item}
                          sparePartRows={rows}
                          settings={settings}
                          brandLogoSrc={brandLogoSrc}
                          showGrid={showGrid}
                          selectedTarget={selectedTarget}
                          onElementClick={(target) => {
                            setSelectedTarget(target);
                            // Auto open inspector on element selection
                            setRightOpen(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Drawer Backdrop for Mobile/Tablet */}
                {rightOpen && (
                  <div
                    onClick={() => setRightOpen(false)}
                    className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
                  />
                )}

                {/* Right Pane: Docked Property Inspector */}
                <div
                  className={`fixed inset-y-0 right-0 z-50 w-[300px] sm:w-[340px] bg-surface p-3 sm:p-4 border-l border-subtle shadow-2xl transition-transform duration-200 overflow-y-auto lg:static lg:z-auto lg:translate-x-0 lg:shadow-none lg:border-none lg:p-0 lg:transition-all lg:duration-200 ${
                    rightOpen ? "translate-x-0 lg:w-72 xl:w-76 2xl:w-84 shrink-0" : "translate-x-full lg:w-0 lg:opacity-0 lg:pointer-events-none shrink-0"
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-subtle lg:hidden">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-ink">
                      <Sliders className="w-4 h-4 text-accent" />
                      <span>Property Inspector</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setRightOpen(false)}
                      className="p-1 rounded-lg hover:bg-cushion text-ink-muted hover:text-ink cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="h-full overflow-y-auto">
                    <PropertyInspector
                      target={selectedTarget}
                      onDeselect={() => setSelectedTarget(null)}
                      onSelectTarget={setSelectedTarget}
                    />
                  </div>
                </div>
              </div>
            ) : (
                /* PREVIEW & PRINT TAB WORKSPACE */
                <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-subtle bg-[#F1F5F9] shadow-inner overflow-hidden relative h-full">
                  {/* Preview & Print Action Toolbar */}
                  <div className="p-2 px-3 border-b border-subtle bg-surface/95 backdrop-blur flex items-center justify-between gap-2 shrink-0 z-20 overflow-x-auto">
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 py-1.5 rounded-xl bg-accent text-white font-bold text-xs shadow-md hover:bg-accent/90 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{lang === "km" ? "បោះពុម្ពឯកសារ A4 (Print)" : "Print A4 Report"}</span>
                      </button>

                      <div className="h-4 w-px bg-subtle" />

                      {/* Data Switcher */}
                      <button
                        type="button"
                        onClick={() => setUseSampleData(!useSampleData)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                          useSampleData
                            ? "bg-accent/10 border-accent/30 text-accent font-bold"
                            : "bg-sunken border-subtle text-ink hover:bg-cushion"
                        }`}
                        title="Toggle between Live Database Ticket and Sample Mock Ticket"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>
                          {useSampleData
                            ? (lang === "km" ? "ទិន្នន័យគំរូ (Sample)" : "Sample Data")
                            : (lang === "km" ? "ទិន្នន័យជាក់ស្តែង (Live Ticket)" : `Live: ${previewItem?.reportNo || "Draft"}`)}
                        </span>
                      </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center gap-0.5 bg-sunken p-0.5 rounded-lg border border-subtle">
                        <button
                          type="button"
                          title="Zoom Out"
                          onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.08).toFixed(2))))}
                          className="w-5 h-5 rounded flex items-center justify-center text-ink hover:bg-cushion transition cursor-pointer text-xs font-bold"
                        >
                          <ZoomOut className="w-3 h-3" />
                        </button>
                        <span className="text-[10.5px] font-mono font-bold text-ink px-1 min-w-8 text-center">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          type="button"
                          title="Zoom In"
                          onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.08).toFixed(2))))}
                          className="w-5 h-5 rounded flex items-center justify-center text-ink hover:bg-cushion transition cursor-pointer text-xs font-bold"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title="Fit to screen width"
                          onClick={handleFitZoom}
                          className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold text-accent hover:bg-accent/10 transition cursor-pointer"
                        >
                          Fit
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoom(1.0)}
                          className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold text-ink-secondary hover:text-ink hover:bg-cushion transition cursor-pointer hidden md:inline"
                        >
                          100%
                        </button>
                      </div>

                      <span className="text-[11px] text-ink-muted hidden lg:inline ml-2">
                        {lang === "km"
                          ? "ទម្រង់ A4 ស្តង់ដារ (210mm × 297mm)"
                          : "Standard A4 layout (210mm × 297mm)"}
                      </span>
                    </div>
                  </div>

                  {/* Centered Scrollable Canvas Workspace */}
                  <div
                    ref={canvasContainerRef}
                    className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-[#E2E8F0]"
                  >
                    <div className="flex items-start justify-center" style={{ zoom }}>
                      <div className="shadow-2xl shadow-black/25 rounded-sm border border-[#94A3B8] bg-white">
                        <ReportSheet item={item} sparePartRows={rows} settings={settings} brandLogoSrc={brandLogoSrc} />
                      </div>
                    </div>

                    {/* What the Print button above actually prints. The preview
                        beside it lives inside the app shell, which repositions
                        and clips anything printed from within it, and sits under
                        an inline `zoom` that no media query can reach. */}
                    <ReportPrintPortal item={item} sparePartRows={rows} settings={settings} brandLogoSrc={brandLogoSrc} />
                  </div>
                </div>
              )}
            </div>
          );

          if (isFullscreen && typeof document !== "undefined") {
            return createPortal(a4StudioContent, document.body);
          }

          return a4StudioContent;
        })()}
      </div>
      <Toaster position="bottom-right" />
    </PageWrapper>
  );
}
