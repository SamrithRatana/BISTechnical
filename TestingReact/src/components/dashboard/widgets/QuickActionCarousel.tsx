"use client";

import React from "react";
import Link from "next/link";
import {
  PlusCircle,
  PackagePlus,
  QrCode,
  Layers,
  FileSpreadsheet,
  Cpu,
  ArrowRight,
} from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";

interface QuickActionItem {
  id: string;
  label: string;
  labelKm: string;
  icon: React.ElementType;
  href: string;
  colorClass: string;
}

const ACTIONS: QuickActionItem[] = [
  {
    id: "receive_item",
    label: "Receive Machine",
    labelKm: "ទទួលម៉ាស៊ីនជួសជុល",
    icon: PackagePlus,
    href: "/receive-item",
    colorClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/60 hover:bg-blue-500/20",
  },
  {
    id: "new_ticket",
    label: "New Service Ticket",
    labelKm: "បង្កើតសំបុត្រថ្មី",
    icon: PlusCircle,
    href: "/service-tickets",
    colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60 hover:bg-emerald-500/20",
  },
  {
    id: "spare_parts",
    label: "Spare Parts Catalog",
    labelKm: "កាតាឡុកគ្រឿងបន្លាស់",
    icon: Cpu,
    href: "/spare-parts",
    colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/60 hover:bg-purple-500/20",
  },
  {
    id: "services_matrix",
    label: "Services Matrix",
    labelKm: "ម៉ាទ្រីសសេវាកម្ម",
    icon: FileSpreadsheet,
    href: "/services-matrix",
    colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60 hover:bg-amber-500/20",
  },
  {
    id: "approve_repair",
    label: "Approve Repairing",
    labelKm: "អនុម័តការជួសជុល",
    icon: Layers,
    href: "/approve-repairing",
    colorClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-800/60 hover:bg-indigo-500/20",
  },
];

export default function QuickActionCarousel() {
  const { lang } = useI18n();

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-3.5 shadow-xs">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {lang === "km" ? "ផ្លូវកាត់ប្រតិបត្តិការរហ័ស" : "Fast-Track Operations"}
        </h3>
        <span className="text-[11px] text-zinc-400">
          {lang === "km" ? "ចុចដើម្បីដំណើរការភ្លាមៗ" : "Instant Action Triggers"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const label = lang === "km" ? action.labelKm : action.label;

          return (
            <Link
              key={action.id}
              href={action.href}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-xs font-semibold group ${action.colorClass}`}
            >
              <div className="p-1.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 shadow-2xs group-hover:scale-105 transition-transform">
                <Icon className="w-4 h-4" />
              </div>
              <span className="truncate flex-1">{label}</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
