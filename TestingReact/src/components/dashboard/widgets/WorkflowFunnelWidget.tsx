"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Inbox,
  Search,
  Clock,
  Wrench,
  CheckCircle2,
  Send,
  ChevronRight,
} from "lucide-react";
import { useTicketSeries, statusIs } from "@/hooks/useTicketSeries";
import { useI18n } from "@/i18n/LanguageProvider";
import { useDashboard } from "@/components/dashboard/useDashboardStore";

interface FunnelStage {
  key: string;
  stepNumber: number;
  label: string;
  labelKm: string;
  icon: React.ElementType;
  color: string;
  bgLight: string;
  filterParam: string;
}

const STAGES: FunnelStage[] = [
  {
    key: "reception",
    stepNumber: 1,
    label: "Reception",
    labelKm: "ទទួលម៉ាស៊ីន",
    icon: Inbox,
    color: "text-blue-600 dark:text-blue-400",
    bgLight: "bg-blue-500/10 border-blue-200 dark:border-blue-900/60",
    filterParam: "Received",
  },
  {
    key: "inspection",
    stepNumber: 2,
    label: "Inspection",
    labelKm: "ត្រួតពិនិត្យ",
    icon: Search,
    color: "text-amber-600 dark:text-amber-400",
    bgLight: "bg-amber-500/10 border-amber-200 dark:border-amber-900/60",
    filterParam: "Checking",
  },
  {
    key: "approval",
    stepNumber: 3,
    label: "Quotation / Parts",
    labelKm: "រង់ចាំសម្រេចចិត្ត",
    icon: Clock,
    color: "text-orange-600 dark:text-orange-400",
    bgLight: "bg-orange-500/10 border-orange-200 dark:border-orange-900/60",
    filterParam: "Waiting",
  },
  {
    key: "repair",
    stepNumber: 4,
    label: "Repair & Testing",
    labelKm: "កំពុងជួសជុល",
    icon: Wrench,
    color: "text-indigo-600 dark:text-indigo-400",
    bgLight: "bg-indigo-500/10 border-indigo-200 dark:border-indigo-900/60",
    filterParam: "Repairing",
  },
  {
    key: "verification",
    stepNumber: 5,
    label: "Finished & Ready",
    labelKm: "ជួសជុលរួចរាល់",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bgLight: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-900/60",
    filterParam: "Finished",
  },
  {
    key: "delivery",
    stepNumber: 6,
    label: "Delivered / AMC",
    labelKm: "ប្រគល់ជូនរួច",
    icon: Send,
    color: "text-teal-600 dark:text-teal-400",
    bgLight: "bg-teal-500/10 border-teal-200 dark:border-teal-900/60",
    filterParam: "Delivered",
  },
];

interface WorkflowFunnelWidgetProps {
  onSelectStage?: (filter: string) => void;
  selectedFilter?: string;
}

export default function WorkflowFunnelWidget({
  onSelectStage,
  selectedFilter,
}: WorkflowFunnelWidgetProps) {
  const { items } = useTicketSeries();
  const { lang } = useI18n();
  const { isPrivacyMode } = useDashboard();

  const stageCounts = useMemo(() => {
    if (!items || items.length === 0) {
      return {
        reception: 0,
        inspection: 0,
        approval: 0,
        repair: 0,
        verification: 0,
        delivery: 0,
      };
    }

    return {
      reception: items.filter((i) => statusIs(i, "reciev") || statusIs(i, "receiv")).length,
      inspection: items.filter((i) => statusIs(i, "check")).length,
      approval: items.filter((i) => statusIs(i, "awaiting") || statusIs(i, "quotation")).length,
      repair: items.filter((i) => statusIs(i, "repairing")).length,
      verification: items.filter((i) => statusIs(i, "finish")).length,
      delivery: items.filter((i) => statusIs(i, "deliver")).length,
    };
  }, [items]);

  const totalTickets = useMemo(() => {
    return Object.values(stageCounts).reduce((a, b) => a + b, 0) || 1;
  }, [stageCounts]);

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span>{lang === "km" ? "វដ្តដំណើរការជួសជុលទាំង ៦ ដំណាក់កាល" : "6-Stage Repair Lifecycle Flow"}</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {lang === "km"
              ? "តាមដានលំហូរម៉ាស៊ីនពីការទទួល វិនិច្ឆ័យ គ្រឿងបន្លាស់ រហូតដល់ប្រគល់ជូន"
              : "Track tickets moving through reception, diagnostics, spare parts to delivery"}
          </p>
        </div>
      </div>

      {/* Responsive Horizontal Funnel Pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const count = stageCounts[stage.key as keyof typeof stageCounts] || 0;
          const percentage = Math.round((count / totalTickets) * 100);
          const isSelected = selectedFilter === stage.filterParam;

          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => onSelectStage && onSelectStage(stage.filterParam)}
              className={`relative flex flex-col justify-between p-3 rounded-xl border text-left transition-all ${
                stage.bgLight
              } ${
                isSelected
                  ? "ring-2 ring-blue-600 dark:ring-blue-400 shadow-sm scale-[1.02]"
                  : "hover:shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-5 h-5 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-600 dark:text-zinc-300 shadow-2xs">
                  {stage.stepNumber}
                </span>
                <Icon className={`w-4 h-4 ${stage.color}`} />
              </div>

              <div>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                  {lang === "km" ? stage.labelKm : stage.label}
                </span>

                <div className="flex items-baseline justify-between mt-1">
                  {isPrivacyMode ? (
                    <div className="w-9 h-6 my-0.5 bg-zinc-200/80 dark:bg-zinc-700/80 rounded animate-pulse" />
                  ) : (
                    <span className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white">
                      {count}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-400 font-medium">
                    {isPrivacyMode ? "••%" : `${percentage}%`}
                  </span>
                </div>
              </div>

              {/* Mini progress bar */}
              <div className="w-full bg-zinc-200/60 dark:bg-zinc-700/60 h-1 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-current rounded-full"
                  style={{ width: `${Math.max(percentage, 4)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
