"use client";

import React, { useState } from "react";
import { ShieldCheck, X, ClipboardList, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { RepairServiceItem, updateServiceStatus } from "@/services/api";
import { useI18n } from "@/i18n/LanguageProvider";
import { ModalWrapper } from "@/components/av/ModalWrapper";

interface ApproveRepairDialogProps {
  item: RepairServiceItem;
  onClose: () => void;
  onApproved: () => void;
}

export default function ApproveRepairDialog({ item, onClose, onApproved }: ApproveRepairDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useI18n();

  const modalWrapperClass = "bg-surface border border-subtle shadow-soft-xl";
  const headerClass = "border-b border-subtle bg-cushion";
  const noteBoxClass = "bg-sunken text-ink-secondary";
  const footerClass = "bg-cushion border-t border-subtle";

  const handleApprove = async () => {
    const parts = item.sparePartItems || item.sparepartItems || [];
    if (item.status === "Sale Confirmed" && parts.length > 0) {
      toast.error(
        t("msg.cannotApproveSpareParts", { ref: item.reportNo ?? "" }),
        { position: "bottom-right" }
      );
      return;
    }

    if (item.status === "Inspection" && item.serviceType === "Charge") {
      toast.error(
        t("msg.cannotApproveCharge", { ref: item.reportNo ?? "" }),
        { position: "bottom-right" }
      );
      return;
    }

    setIsSubmitting(true);
    const ok = await updateServiceStatus(item, "Repairing");
    setIsSubmitting(false);

    if (ok) {
      toast.success(t("approve.success", { ref: item.reportNo ?? "" }), { position: "bottom-right" });
      onApproved();
      onClose();
    } else {
      toast.error(t("approve.failed", { ref: item.reportNo ?? "" }), { position: "bottom-right" });
    }
  };

  return (
    <ModalWrapper
      open
      onClose={onClose}
      maxWidth="max-w-lg"
      zIndex={60}
      placement="center"
      backdropVariant="heavy"
    >
      {/* Header and footer are already `shrink-0`; making this a bounded
          column is what gives them something to be pinned against. The
          inspection and solution notes are free text and can run long, and
          before the cap existed they pushed the Approve button off a
          1366x768 screen. */}
      <div className={`w-full rounded-2xl overflow-hidden flex flex-col max-h-[var(--av-modal-inner-maxh)] ${modalWrapperClass}`}>
        <div className={`px-5 py-4 flex items-center justify-between shrink-0 ${headerClass}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-success-soft text-success flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{t("dialog.approveRepair")}</h2>
              <p className="text-xs text-ink-muted font-mono">{item.reportNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-ink-muted font-semibold">{t("field.companyName")}</p>
              <p className="font-medium truncate">{item.companyName}</p>
            </div>
            <div>
              <p className="text-ink-muted font-semibold">{t("approve.itemSerial")}</p>
              <p className="font-medium truncate">{item.itemName} · {item.serialNumber}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> {t("approve.inspectionNotes")}
            </p>
            <p className={`text-xs rounded-xl p-3 min-h-[2.5rem] whitespace-pre-wrap ${noteBoxClass}`}>
              {item.inspection || <span className="text-ink-muted italic">{t("approve.noInspectionNotes")}</span>}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> {t("field.solution")}
            </p>
            <p className={`text-xs rounded-xl p-3 min-h-[2.5rem] whitespace-pre-wrap ${noteBoxClass}`}>
              {item.solution || <span className="text-ink-muted italic">{t("approve.noSolution")}</span>}
            </p>
          </div>

          <p className="text-[11px] text-ink-muted">
            {t("approve.explainer")}
          </p>
        </div>

        <div className={`px-5 py-3.5 flex items-center justify-end gap-3 shrink-0 ${footerClass}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-xl transition-colors duration-150 disabled:opacity-60 text-ink bg-surface border border-subtle hover:bg-cushion"
          >
            {t("action.cancel")}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-success rounded-xl hover:bg-success shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {isSubmitting ? t("approve.submitting") : t("dialog.approveRepair")}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
