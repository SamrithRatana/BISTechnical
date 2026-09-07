"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Users, Wrench, CheckCircle, Award } from "lucide-react";
import { useTicketSeries, statusIs } from "@/hooks/useTicketSeries";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchUserMap, resolveUserNameSync } from "@/services/userService";
import type { RepairServiceItem } from "@/services/types";

interface TechnicianWorkload {
  name: string;
  activeCount: number;
  completedCount: number;
  totalCount: number;
  isUnassigned?: boolean;
}

function isGuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

function resolveTicketTechnician(ticket: RepairServiceItem, lang: string): string {
  // 1. Direct assigned names (from backend or user enricher)
  const candidateNames = [
    ticket.repairByName,
    ticket.repairByUserName,
    ticket.inspectByName,
    ticket.createdByName,
    ticket.verifiedByName,
  ];
  for (const name of candidateNames) {
    if (name && name.trim() && !isGuid(name)) {
      return name.trim();
    }
  }

  // 2. Resolve GUIDs via user map if names haven't been pre-computed
  const candidateGuids = [
    ticket.repairBy,
    ticket.inspectBy,
    ticket.inspectingBy,
    ticket.createBy,
    ticket.userId,
    ticket.verifiedBy,
  ];
  for (const guid of candidateGuids) {
    if (guid && isGuid(guid)) {
      const resolved = resolveUserNameSync(guid);
      if (resolved && resolved.trim()) {
        return resolved.trim();
      }
    }
  }

  return lang === "km" ? "មិនទាន់ចាត់តាំង" : "Unassigned";
}

export default function EngineerWorkloadWidget() {
  const { items, loading } = useTicketSeries();
  const { lang } = useI18n();
  const [userMapReady, setUserMapReady] = useState(false);

  useEffect(() => {
    fetchUserMap()
      .then(() => setUserMapReady(true))
      .catch(() => {});
  }, []);

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const workloads = useMemo(() => {
    if (!items || items.length === 0) return [];

    const map = new Map<string, { active: number; completed: number; isUnassigned: boolean }>();
    const unassignedLabel = lang === "km" ? "មិនទាន់ចាត់តាំង" : "Unassigned";

    items.forEach((ticket) => {
      const tech = resolveTicketTechnician(ticket, lang);
      const isUnassigned = tech === unassignedLabel;

      if (!map.has(tech)) {
        map.set(tech, { active: 0, completed: 0, isUnassigned });
      }

      const rec = map.get(tech)!;
      const isFinished = statusIs(ticket, "finish") || statusIs(ticket, "deliver");
      if (isFinished) {
        rec.completed += 1;
      } else {
        rec.active += 1;
      }
    });

    const result: TechnicianWorkload[] = [];
    map.forEach((counts, name) => {
      result.push({
        name,
        activeCount: counts.active,
        completedCount: counts.completed,
        totalCount: counts.active + counts.completed,
        isUnassigned: counts.isUnassigned,
      });
    });

    // Sort by active workload descending, keeping unassigned at the bottom if desired
    return result.sort((a, b) => {
      if (a.isUnassigned && !b.isUnassigned) return 1;
      if (!a.isUnassigned && b.isUnassigned) return -1;
      return b.activeCount - a.activeCount;
    });
  }, [items, lang, userMapReady]);

  const displayedWorkloads = useMemo(() => {
    return workloads.slice(0, visibleCount);
  }, [workloads, visibleCount]);

  const hasMore = visibleCount < workloads.length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, workloads.length));
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, workloads.length));
  };

  const maxActive = useMemo(() => {
    return Math.max(...workloads.map((w) => w.activeCount), 5);
  }, [workloads]);

  const AVATAR_COLORS = [
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25",
    "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25",
    "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25",
    "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25",
  ];

  const getAvatarColor = (name: string, isUnassigned?: boolean): string => {
    if (isUnassigned) return "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700";
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km" ? "បន្ទុកការងារជាងបច្ចេកទេស" : "Technician Workload Capacity"}
              </h3>
              {workloads.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  {hasMore ? `${displayedWorkloads.length}/${workloads.length}` : workloads.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "ការបែងចែកសំបុត្រជួសជុលតាមជាងនីមួយៗ"
                : "Active vs completed repairs distribution"}
            </p>
          </div>
        </div>
      </div>

      <div
        onScroll={handleScroll}
        className="flex-1 space-y-3 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600"
      >
        {loading && workloads.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 animate-pulse">
            {lang === "km" ? "កំពុងគណនាបន្ទុកការងារ..." : "Calculating workload..."}
          </div>
        ) : workloads.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            {lang === "km" ? "មិនទាន់មានទិន្នន័យជាងជួសជុលឡើយ" : "No technician activity recorded"}
          </div>
        ) : (
          <>
            {displayedWorkloads.map((tech) => {
              const pct = Math.round((tech.activeCount / maxActive) * 100);
              const avatarCls = getAvatarColor(tech.name, tech.isUnassigned);

              return (
                <div key={tech.name} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 ${avatarCls}`}>
                        {tech.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {tech.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] shrink-0">
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {tech.activeCount} {lang === "km" ? "កំពុងធ្វើ" : "active"}
                      </span>
                      <span className="text-zinc-400">
                        / {tech.completedCount} {lang === "km" ? "រួចរាល់" : "done"}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        tech.activeCount > 8
                          ? "bg-rose-500"
                          : tech.activeCount > 4
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.max(pct, 6)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-2 pb-1">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="w-full py-1.5 px-2 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs group cursor-pointer"
                >
                  <span>
                    {lang === "km"
                      ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedWorkloads.length}/${workloads.length})`
                      : `Scroll down or load next 25 (${displayedWorkloads.length}/${workloads.length})`}
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
