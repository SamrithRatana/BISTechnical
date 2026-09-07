"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, MessageSquareText, Pencil, ArrowLeft, Check, X } from "lucide-react";

export const PRESET_REMARKS = [
  "មានស្តុក",
  "ដោះពីម៉ាស៊ីន",
  "ស្តុកក្នុងស្រុក",
  "រង់ចាំ ៦ ទៅ៨អាទិត្យ"
];

export interface RemarkIndicatorProps {
  sparePartId?: string;
  remarks?: string;
  remarksUpdatedAt?: string;
  allowEdit?: boolean;
  onSave?: (newValue: string) => Promise<boolean | void> | void;
}

export const RemarkIndicator: React.FC<RemarkIndicatorProps> = ({
  remarks,
  remarksUpdatedAt,
  allowEdit = true,
  onSave
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    placement: "top" | "bottom";
  }>({ placement: "top" });

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasRemark = Boolean(remarks && remarks.trim() && remarks.trim() !== "-");

  // Calculate and update popup coordinates (anchored to button, opening UPWARDS)
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const popupHeight = 220;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Prefer UPWARDS placement (ឡើងលើ) whenever there is room above or space below is tight
      const placeUp = spaceAbove >= popupHeight || spaceBelow < popupHeight;

      const rightOffset = Math.max(12, window.innerWidth - rect.right);

      if (placeUp) {
        setCoords({
          bottom: window.innerHeight - rect.top + 6,
          right: rightOffset,
          placement: "top",
        });
      } else {
        setCoords({
          top: rect.bottom + 6,
          right: rightOffset,
          placement: "bottom",
        });
      }
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Close popup on click outside or escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setIsOpen(false);
        setShowCustomInput(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setShowCustomInput(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus textarea when custom input opened
  useEffect(() => {
    if (showCustomInput && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showCustomInput]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!allowEdit) return;
    setCustomValue(remarks ?? "");
    setShowCustomInput(false);
    setIsOpen((prev) => !prev);
  };

  const handleSelectPreset = async (preset: string) => {
    setIsOpen(false);
    setShowCustomInput(false);
    if (preset === remarks) return;
    setIsSaving(true);
    try {
      await onSave?.(preset);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCustom = async () => {
    const trimmed = customValue.trim();
    setIsOpen(false);
    setShowCustomInput(false);
    if (trimmed === (remarks ?? "")) return;
    setIsSaving(true);
    try {
      await onSave?.(trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = remarksUpdatedAt
    ? new Date(remarksUpdatedAt).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Icon trigger */}
      <button
        type="button"
        onClick={handleOpen}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isSaving}
        className={`p-1 rounded-md transition-all inline-flex items-center justify-center ${
          hasRemark
            ? "text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50"
            : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800"
        } ${!allowEdit ? "cursor-default" : "cursor-pointer"}`}
        title={allowEdit && !hasRemark ? "Add remark" : undefined}
      >
        {hasRemark ? (
          <MessageSquareText className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 shrink-0" />
        ) : (
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
        )}
      </button>

      {/* Hover Tooltip showing Remark text & Time */}
      {hasRemark && isHovered && !isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-xl bg-slate-900/95 text-white text-xs font-medium whitespace-nowrap shadow-xl z-50 flex flex-col gap-0.5 border border-white/10 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          {formattedDate && (
            <span className="text-[10px] text-slate-400 font-mono">{formattedDate}</span>
          )}
          <span className="text-slate-100 font-medium">{remarks}</span>
        </div>
      )}

      {/* Edit Popup / Dropdown rendered in Portal (Never clipped, opens UPWARDS) */}
      {isOpen && allowEdit && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              right: coords.right !== undefined ? `${coords.right}px` : undefined,
              zIndex: 99999,
            }}
            className="w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {!showCustomInput ? (
              <div className="flex flex-col gap-1">
                {PRESET_REMARKS.map((preset) => {
                  const isSelected = remarks === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-bold"
                          : "bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/60"
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setCustomValue(remarks ?? "");
                    setShowCustomInput(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-1.5 mt-0.5 transition-colors"
                >
                  <Pencil className="w-3 h-3 text-blue-500" />
                  <span>Custom Remarks</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-1">
                <textarea
                  ref={textareaRef}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  rows={2}
                  placeholder="Add remark..."
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-sans"
                />
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                    title="Back to list"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCustom}
                      className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Save remark"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body
        )
      }
    </div>
  );
};
