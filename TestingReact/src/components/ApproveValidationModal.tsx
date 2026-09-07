"use client";

import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  Package,
  Wrench,
  X,
  PhoneCall,
  Search,
} from "lucide-react";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import { useI18n } from "@/i18n/LanguageProvider";
import { RepairServiceItem } from "@/services/api";
import { isChargeService, type TransitionCode } from "@/validation";

interface ApproveValidationModalProps {
  open: boolean;
  onClose: () => void;
  ticket: RepairServiceItem | null;
  ruleCode?: TransitionCode | null;
  message?: string | null;
}

export default function ApproveValidationModal({
  open,
  onClose,
  ticket,
  ruleCode,
  message,
}: ApproveValidationModalProps) {
  const { t } = useI18n();

  if (!open || !ticket) return null;

  const parts = ticket.sparePartItems || ticket.sparepartItems || [];
  const isCharge = isChargeService(ticket.serviceType, ticket.serviceTypeId);
  const hasParts = parts.length > 0;

  // Determine workflow rule (1, 2, 3, 4)
  let ruleNumber = 1;
  let ruleTitle = "Charge មាន Sparepart";
  if (isCharge && hasParts) {
    ruleNumber = 1;
    ruleTitle = "Charge មាន Sparepart";
  } else if (isCharge && !hasParts) {
    ruleNumber = 2;
    ruleTitle = "Charge គ្មាន Sparepart";
  } else if (!isCharge && hasParts) {
    ruleNumber = 3;
    ruleTitle = "Free មាន Sparepart";
  } else {
    ruleNumber = 4;
    ruleTitle = "Free គ្មាន Sparepart";
  }

  return (
    <ModalWrapper
      open={open}
      onClose={onClose}
      placement="center"
      maxWidth="max-w-xl"
      isAlert
    >
      <div className="bg-surface rounded-2xl border border-subtle shadow-soft-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle bg-cushion/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink leading-tight">
                មិនអាចអនុម័តជួសជុលបានទេ
              </h3>
              <p className="text-xs text-ink-muted">
                លក្ខខណ្ឌដំណើរការ (Workflow Validation)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-sunken transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Ticket Information Card */}
          <div className="p-3.5 rounded-xl bg-cushion/40 border border-subtle/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-ink-muted">លេខ Report: </span>
              <span className="font-mono font-bold text-ink">
                {ticket.reportNo}
              </span>
            </div>
            <div>
              <span className="text-ink-muted">ប្រភេទសេវា: </span>
              <span
                className={`font-semibold px-2 py-0.5 rounded-full ${
                  isCharge
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {isCharge ? "Charge (ជួសជុលគិតលុយ)" : "Free (ជួសជុលមិនគិតលុយ)"}
              </span>
            </div>
            <div>
              <span className="text-ink-muted">គ្រឿងបន្លាស់: </span>
              <span className="font-semibold text-ink">
                {hasParts ? `${parts.length} មុខ` : "គ្មានគ្រឿងបន្លាស់"}
              </span>
            </div>
            <div>
              <span className="text-ink-muted">ស្ថានភាពបច្ចុប្បន្ន: </span>
              <span className="font-semibold text-info">
                {ticket.status || "N/A"}
              </span>
            </div>
          </div>

          {/* Workflow Step Visualizer */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-secondary">
                លំដាប់លំហូរការងារ: Rule {ruleNumber} ({ruleTitle})
              </span>
            </div>

            {ruleNumber === 1 && (
              <div className="p-3.5 rounded-xl bg-cushion/30 border border-subtle flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> វិនិច្ឆ័យ
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> បញ្ជូនទៅស្តុក
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> បញ្ជូនទៅទីផ្សារ
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold whitespace-nowrap border border-amber-500/40 animate-pulse">
                    <Clock className="w-3.5 h-3.5" /> បញ្ជូនគ្រឿងបន្លាស់
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sunken text-ink-muted font-medium whitespace-nowrap border border-subtle">
                    <Lock className="w-3.5 h-3.5" /> អនុម័តជួសជុល
                  </div>
                </div>
              </div>
            )}

            {ruleNumber === 2 && (
              <div className="p-3.5 rounded-xl bg-cushion/30 border border-subtle flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> វិនិច្ឆ័យ
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold whitespace-nowrap border border-amber-500/40 animate-pulse">
                    <PhoneCall className="w-3.5 h-3.5" /> បញ្ជូនទៅទីផ្សារ
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sunken text-ink-muted font-medium whitespace-nowrap border border-subtle">
                    <Lock className="w-3.5 h-3.5" /> អនុម័តជួសជុល
                  </div>
                </div>
              </div>
            )}

            {ruleNumber === 3 && (
              <div className="p-3.5 rounded-xl bg-cushion/30 border border-subtle flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> វិនិច្ឆ័យ
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> បញ្ជូនទៅស្តុក
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold whitespace-nowrap border border-amber-500/40 animate-pulse">
                    <Package className="w-3.5 h-3.5" /> បញ្ជូនគ្រឿងបន្លាស់
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sunken text-ink-muted font-medium whitespace-nowrap border border-subtle">
                    <Lock className="w-3.5 h-3.5" /> អនុម័តជួសជុល
                  </div>
                </div>
              </div>
            )}

            {ruleNumber === 4 && (
              <div className="p-3.5 rounded-xl bg-cushion/30 border border-subtle flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold whitespace-nowrap border border-amber-500/40 animate-pulse">
                    <Search className="w-3.5 h-3.5" /> វិនិច្ឆ័យរួចរាល់
                  </div>
                  <ArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap border border-emerald-500/20">
                    <Wrench className="w-3.5 h-3.5" /> អនុម័តជួសជុល
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reason & Action Description Box */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-1.5">
            <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
              {message || "មិនអាចអនុម័តជួសជុលក្នុងដំណាក់កាលនេះបានទេ"}
            </p>
            <p className="text-amber-700 dark:text-amber-400">
              {ruleNumber === 1 &&
                "របាយការណ៍នេះជាប្រភេទ Charge ដែលមានគ្រឿងបន្លាស់។ មុននឹងអាចអនុម័តជួសជុលបាន ត្រូវរង់ចាំឱ្យផ្នែកស្តុកពិនិត្យកាត់ស្តុក និងចុច «បញ្ជូនគ្រឿងបន្លាស់» (Sent Spareparts) ទៅឱ្យជាងជួសជុលជាមុនសិន។"}
              {ruleNumber === 2 &&
                "របាយការណ៍នេះជាប្រភេទ Charge គ្មានគ្រឿងបន្លាស់។ មុននឹងអាចអនុម័តជួសជុលបាន ត្រូវបញ្ជូនទៅផ្នែកទីផ្សារ Confirm (Sale Confirmed) ជាមួយអតិថិជនជាមុនសិន។"}
              {ruleNumber === 3 &&
                "របាយការណ៍នេះជាប្រភេទ Free ដែលមានគ្រឿងបន្លាស់។ មុននឹងអាចអនុម័តជួសជុលបាន ត្រូវរង់ចាំផ្នែកស្តុកបញ្ជូនគ្រឿងបន្លាស់ (Sent Spareparts) ទៅឱ្យជាងជាមុនសិន។"}
              {ruleNumber === 4 &&
                "របាយការណ៍នេះជាប្រភេទ Free គ្មានគ្រឿងបន្លាស់។ ត្រូវធ្វើការវិនិច្ឆ័យ (Inspection) ឱ្យរួចរាល់ជាមុនសិន ទើបអាចអនុម័តជួសជុលបាន។"}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-subtle bg-cushion/40 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-accent hover:bg-accent/90 shadow-sm transition-colors cursor-pointer"
          >
            យល់ព្រម (Understood)
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
