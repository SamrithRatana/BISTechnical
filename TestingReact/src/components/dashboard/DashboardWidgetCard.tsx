"use client";

import React from "react";
import {
  GripVertical,
  Maximize2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Columns,
  EyeOff,
} from "lucide-react";
import { DashboardWidgetConfig, WidgetColSpan } from "./types";
import { WIDGET_REGISTRY } from "./widgetRegistry";
import { useDashboard } from "./useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";

interface DashboardWidgetCardProps {
  config: DashboardWidgetConfig;
  index: number;
  children: React.ReactNode;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd?: () => void;
  isDragOver?: boolean;
}

const COL_SPAN_CLASSES: Record<WidgetColSpan, string> = {
  1: "col-span-1",
  2: "col-span-1 md:col-span-2",
  3: "col-span-1 md:col-span-2 lg:col-span-3",
  4: "col-span-1 md:col-span-2 lg:col-span-4",
};

export default function DashboardWidgetCard({
  config,
  index,
  children,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragOver = false,
}: DashboardWidgetCardProps) {
  const {
    isCustomizing,
    isPrivacyMode,
    setWidgetColSpan,
    moveWidget,
    removeWidget,
    widgets,
  } = useDashboard();
  const { lang } = useI18n();

  const meta = WIDGET_REGISTRY[config.id] || {
    id: config.id,
    title: config.id,
    titleKm: config.id,
    minColSpan: 1,
    maxColSpan: 4,
  };

  const title = lang === "km" ? meta.titleKm || meta.title : meta.title;
  const colSpan = config.colSpan || meta.defaultColSpan || 4;
  const isFirst = index === 0;
  const isLast = index === widgets.length - 1;

  const allowedSpans: WidgetColSpan[] = [1, 2, 4].filter(
    (s) => s >= (meta.minColSpan || 1) && s <= (meta.maxColSpan || 4)
  ) as WidgetColSpan[];

  return (
    <div
      draggable={isCustomizing}
      onDragStart={(e) => onDragStart && onDragStart(e, index)}
      onDragOver={(e) => onDragOver && onDragOver(e, index)}
      onDragEnd={onDragEnd}
      className={`relative flex flex-col transition-all duration-200 ${
        COL_SPAN_CLASSES[colSpan]
      } ${
        isCustomizing
          ? "rounded-2xl ring-2 ring-blue-500/30 dark:ring-blue-400/30 p-2 bg-blue-50/20 dark:bg-blue-950/20 shadow-sm"
          : ""
      } ${
        isDragOver
          ? "scale-[0.98] ring-2 ring-blue-600 dark:ring-blue-400 opacity-80"
          : ""
      }`}
    >
      {/* Customize Mode Bar */}
      {isCustomizing && (
        <div className="mb-2.5 shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm text-xs select-none">
          {/* Left: Drag Handle & Title */}
          <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing text-zinc-600 dark:text-zinc-300">
            <GripVertical className="w-4 h-4 text-zinc-400" />
            <span className="font-semibold truncate max-w-[140px] sm:max-w-[220px]">
              {title}
            </span>
          </div>

          {/* Center/Right: ColSpan buttons & Actions */}
          <div className="flex items-center gap-1.5">
            {/* Reordering shortcuts */}
            <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-800">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => moveWidget(config.id, "up")}
                title="Move up / left"
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-zinc-700 dark:text-zinc-300"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700" />
              <button
                type="button"
                disabled={isLast}
                onClick={() => moveWidget(config.id, "down")}
                title="Move down / right"
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-zinc-700 dark:text-zinc-300"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Resize options */}
            {allowedSpans.length > 1 && (
              <div className="hidden sm:flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-800 p-0.5 gap-0.5">
                {allowedSpans.map((span) => (
                  <button
                    key={span}
                    type="button"
                    onClick={() => setWidgetColSpan(config.id, span)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      colSpan === span
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    {span === 4 ? "Full" : `${span}x`}
                  </button>
                ))}
              </div>
            )}

            {/* Hide/Remove widget button */}
            <button
              type="button"
              onClick={() => removeWidget(config.id)}
              title="Remove widget from dashboard"
              className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Widget Content */}
      <div className={`flex-1 flex flex-col min-h-0 ${isPrivacyMode ? "data-privacy-active" : ""}`}>
        {children}
      </div>
    </div>
  );
}
