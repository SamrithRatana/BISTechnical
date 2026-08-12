"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, PackageCheck, Hourglass, CheckCircle2 } from "lucide-react";
import { fetchRepairServices } from "@/services/api";

interface StatItem {
  id: string;
  title: string;
  count: number;
  icon: React.ElementType;
  color: string;
  bgLight: string;
  borderColor: string;
}

interface StatCardsProps {
  selectedFilter: string;
  setSelectedFilter: (id: string) => void;
}

export default function StatCards({ selectedFilter, setSelectedFilter }: StatCardsProps) {
  const [counts, setCounts] = useState<Record<string, number>>({
    Today: 0,
    Received: 0,
    Waiting: 0,
    Finished: 0,
  });

  useEffect(() => {
    let isMounted = true;
    async function loadCounts() {
      try {
        const [todayRes, receivedRes, waitingRes, finishedRes] = await Promise.all([
          fetchRepairServices(1, 1, "Today"),
          fetchRepairServices(1, 1, "Received"),
          fetchRepairServices(1, 1, "Awaiting Customer Confirm"),
          fetchRepairServices(1, 1, "Finished"),
        ]);
        if (isMounted) {
          setCounts({
            Today: todayRes.totalCount ?? 0,
            Received: receivedRes.totalCount ?? 0,
            Waiting: waitingRes.totalCount ?? 0,
            Finished: finishedRes.totalCount ?? 0,
          });
        }
      } catch (err) {
        console.warn("Failed to load stat card counts:", err);
      }
    }
    void loadCounts();
    return () => {
      isMounted = false;
    };
  }, []);

  const statsList: StatItem[] = [
    {
      id: "Today",
      title: "TODAY'S REPORT",
      count: counts.Today,
      icon: TrendingUp,
      color: "text-blue-600",
      bgLight: "bg-blue-50/80 dark:bg-blue-950/40",
      borderColor: "border-blue-500",
    },
    {
      id: "Received",
      title: "RECEIVED ITEM",
      count: counts.Received,
      icon: PackageCheck,
      color: "text-cyan-600",
      bgLight: "bg-cyan-50/80 dark:bg-cyan-950/40",
      borderColor: "border-transparent",
    },
    {
      id: "Waiting",
      title: "WAITING CUSTOMER",
      count: counts.Waiting,
      icon: Hourglass,
      color: "text-amber-600",
      bgLight: "bg-amber-50/80 dark:bg-amber-950/40",
      borderColor: "border-transparent",
    },
    {
      id: "Finished",
      title: "FINISHED",
      count: counts.Finished,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgLight: "bg-emerald-50/80 dark:bg-emerald-950/40",
      borderColor: "border-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statsList.map((stat) => {
        const Icon = stat.icon;
        const isSelected = selectedFilter === stat.id;

        return (
          <div
            key={stat.id}
            onClick={() => setSelectedFilter(stat.id)}
            className={`p-5 rounded-2xl bg-white border transition-all cursor-pointer shadow-sm hover:shadow-md dark:bg-slate-900 ${
              isSelected
                ? "border-blue-600 ring-2 ring-blue-500/20 shadow-blue-500/5 dark:border-blue-500"
                : "border-slate-200/80 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 tracking-wider uppercase">
                  {stat.title}
                </span>
                <div className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                  {stat.count}
                </div>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgLight} ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
