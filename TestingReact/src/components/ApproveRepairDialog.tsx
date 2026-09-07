"use client";

import React, { useState } from "react";
import { ShieldCheck, X, ClipboardList, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { RepairServiceItem, updateServiceStatus, getAuthHeaders } from "@/services/api";
import { cleanupOldTopicTelegramMessages } from "@/services/telegramService";
import { useI18n } from "@/i18n/LanguageProvider";
import { transitionGuard, type TransitionCode } from "@/validation";
import type { TranslationKey } from "@/i18n/translations";
import { ModalWrapper } from "@/components/av/ModalWrapper";

interface ApproveRepairDialogProps {
  item: RepairServiceItem;
  onClose: () => void;
  onApproved: () => void;
}

/**
 * Each shared refusal's own translated sentence. Exhaustive, so a new rule in
 * `@/validation/transitions.ts` without a key here is a compile error.
 */
const REFUSAL_KEYS: Record<TransitionCode, TranslationKey> = {
  cannotApproveSpareParts: "msg.cannotApproveSpareParts",
  cannotApproveCharge: "msg.cannotApproveCharge",
  cannotSendSparePartsCharge: "msg.cannotSendSparePartsCharge",
  cannotApproveFreeWithSpareParts: "msg.cannotApproveFreeWithSpareParts",
};

export default function ApproveRepairDialog({ item, onClose, onApproved }: ApproveRepairDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inspection, setInspection] = useState(item.inspection || "");
  const [solution, setSolution] = useState(item.solution || "");
  const { t } = useI18n();

  const modalWrapperClass = "bg-surface border border-subtle shadow-soft-xl";
  const headerClass = "border-b border-subtle bg-cushion";
  const footerClass = "bg-cushion border-t border-subtle";

  const handleApprove = async () => {
    const parts = item.sparePartItems || item.sparepartItems || [];

    // These two refusals used to be written out here, and again in the CamID
    // app's `portalDomain.transitionGuard`. They live in `@/validation` now, so
    // both platforms refuse the same moves — including the phone's third rule
    // (parts must not be dispatched against an unconfirmed Charge ticket),
    // which this screen never had.
    const refusal = transitionGuard(
      {
        status: item.status,
        serviceType: item.serviceType,
        serviceTypeId: item.serviceTypeId,
        sparePartCount: parts.length,
        reportNo: item.reportNo,
      },
      "Repairing"
    );
    if (refusal) {
      // The shared rule carries the Khmer business wording; this app has its
      // own translated copies, so the CODE decides which key. Comparing the
      // rendered sentence would pick the wrong one as soon as either is
      // rephrased.
      toast.error(t(REFUSAL_KEYS[refusal.code], { ref: item.reportNo ?? "" }), {
        position: "bottom-right",
      });
      return;
    }

    setIsSubmitting(true);

    const updatedItem: RepairServiceItem = {
      ...item,
      inspection: inspection.trim(),
      solution: solution.trim()
    };

    // If inspection notes or solution were adjusted by the approver, persist to backend
    const norm = (s?: string | null) => (s || "").replace(/\r\n/g, "\n").trim();
    if (
      norm(inspection) !== norm(item.inspection) ||
      norm(solution) !== norm(item.solution)
    ) {
      const serviceTypeId =
        item.serviceType === "Charge" ? 2 :
        item.serviceType === "Free"   ? 1 : 1;

      const priorityId =
        item.servicePriority === "HIGH" ? 2 :
        item.servicePriority === "URGENT" ? 3 : 1;

      const servicePayload = {
        id: item.id,
        customerId: item.customerId || "00000000-0000-0000-0000-000000000000",
        companyName: item.companyName || "N/A",
        address: item.address || "",
        contactName: item.contactName || "",
        phoneNumber: item.phoneNumber || "",
        itemId: item.itemId,
        reportNo: item.reportNo,
        serviceDate: item.serviceDate,
        customerRequest: item.customerRequest || "Receive Item Service Request",
        inspection: inspection.trim(),
        solution: solution.trim(),
        serviceLocation: item.serviceLocation || "CompanyService",
        serviceTypeId,
        servicePriorityId: priorityId,
        statusId: 0, // 👈 CRITICAL: Never pass statusId 2! 0 instructs backend to preserve current status so approval can transition to Repairing!
        hasContract: Boolean(item.hasContract),
        sparepartItems: item.sparePartItems || item.sparepartItems || []
      };

      try {
        await fetch("/api/proxy/technicalservices", {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(servicePayload)
        });
      } catch (err) {
        console.warn("Failed to persist updated inspection/solution before approval:", err);
      }
    }

    const res = await updateServiceStatus(updatedItem, "Repairing");
    setIsSubmitting(false);

    if (res.success) {
      // 🧹 Ensure previous telegram message in old topic (Sent Spareparts / Inspection / Sale Confirmed) is deleted
      if (item.id) {
        void cleanupOldTopicTelegramMessages(item.id);
      }
      toast.success(t("approve.success", { ref: item.reportNo ?? "" }), { position: "bottom-right" });
      onApproved();
      onClose();
    } else {
      toast.error(res.error || t("approve.failed", { ref: item.reportNo ?? "" }), { position: "bottom-right" });
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

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-accent" /> {t("approve.inspectionNotes")}
            </label>
            <textarea
              value={inspection}
              onChange={(e) => setInspection(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              placeholder={t("approve.inspectionNotes")}
              className="w-full text-xs rounded-xl p-3 bg-surface border border-subtle focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all resize-y text-ink"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-accent" /> {t("field.solution")}
            </label>
            <textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              placeholder={t("field.solution")}
              className="w-full text-xs rounded-xl p-3 bg-surface border border-subtle focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all resize-y text-ink"
            />
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
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-success rounded-xl hover:bg-success shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {isSubmitting ? t("approve.submitting") : t("dialog.approveRepair")}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
