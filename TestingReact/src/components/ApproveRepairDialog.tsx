"use client";

import React, { useState } from "react";
import { ShieldCheck, X, ClipboardList, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { RepairServiceItem, updateServiceStatus } from "@/services/api";

interface ApproveRepairDialogProps {
  item: RepairServiceItem;
  onClose: () => void;
  onApproved: () => void;
}

/**
 * The dedicated "Approve Repairing" action — matches RepairItemList.razor's
 * OnApplyButtonClick / ConfirmCustomerConfirm flow, NOT the generic inline
 * status dropdown (which has no path into "Repairing" at all for this queue).
 *
 * Approving stamps repairDate/repairBy and deducts any attached spare-part
 * stock server-side (POST /repairitem → SetRepairCommand) — this dialog is
 * the confirmation + business-rule gate in front of that action.
 *
 * Inspection/Solution are shown read-only for review context. The Blazor
 * source lets you edit them here too, saving via a dedicated
 * `/technicalservices/{id}/inspection-solution` endpoint — but that route
 * doesn't exist anywhere in the backend (dead code upstream). Routing the
 * edit through the generic full-record PUT instead would require resending
 * a complete, correctly-shaped spare-parts sub-array the client doesn't
 * reliably have, risking silently wiping data — so editing is intentionally
 * left out here rather than faked.
 */
export default function ApproveRepairDialog({ item, onClose, onApproved }: ApproveRepairDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    // Business rule: a "Sale Confirmed" ticket with spare parts already
    // attached must go through stock processing first.
    const parts = item.sparePartItems || item.sparepartItems || [];
    if (item.status === "Sale Confirmed" && parts.length > 0) {
      toast.error(
        `${item.reportNo}: Cannot approve — spare parts are already attached. Process spare parts through Stock first.`,
        { position: "bottom-right" }
      );
      return;
    }

    // Business rule: a "Charge" service still in Inspection must be
    // confirmed by Sales/Marketing before it can be approved for repair.
    if (item.status === "Inspection" && item.serviceType === "Charge") {
      toast.error(
        `${item.reportNo}: Cannot approve — this is a Charge service and must be confirmed by Sales first.`,
        { position: "bottom-right" }
      );
      return;
    }

    setIsSubmitting(true);
    const ok = await updateServiceStatus(item, "Repairing");
    setIsSubmitting(false);

    if (ok) {
      toast.success(`${item.reportNo} approved for repair.`, { position: "bottom-right" });
      onApproved();
      onClose();
    } else {
      toast.error(`Failed to approve ${item.reportNo}. Please try again.`, { position: "bottom-right" });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Approve Repairing</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{item.reportNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-400 dark:text-slate-500 font-semibold">Company</p>
              <p className="text-slate-800 dark:text-slate-200 font-medium truncate">{item.companyName}</p>
            </div>
            <div>
              <p className="text-slate-400 dark:text-slate-500 font-semibold">Item / Serial</p>
              <p className="text-slate-800 dark:text-slate-200 font-medium truncate">{item.itemName} · {item.serialNumber}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Inspection Notes
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 min-h-[2.5rem] whitespace-pre-wrap">
              {item.inspection || <span className="text-slate-400 italic">No inspection notes recorded.</span>}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> Solution
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 min-h-[2.5rem] whitespace-pre-wrap">
              {item.solution || <span className="text-slate-400 italic">No solution recorded.</span>}
            </p>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Approving stamps the current time as the repair-start date, assigns you as the repairing engineer, and moves this ticket to the Repairing queue.
          </p>
        </div>

        <div className="px-5 py-3.5 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-60"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {isSubmitting ? "Approving..." : "Approve Repairing"}
          </button>
        </div>
      </div>
    </div>
  );
}
