"use client";

import React, { useState } from "react";
import {
  Activity,
  Play,
  Pause,
  Clock,
  ArrowUpRight,
  Shield,
  Zap,
  CheckCircle2,
  AlertCircle,
  Radio,
} from "lucide-react";
import { type ProcessActivityEvent } from "@/services/systemObservability";

interface Props {
  activities: ProcessActivityEvent[];
  isStreaming: boolean;
  onToggleStreaming: () => void;
  lang?: "km" | "en";
}

export const LiveProcessStream: React.FC<Props> = ({
  activities,
  isStreaming,
  onToggleStreaming,
  lang = "km",
}) => {
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = activities.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false;
    return true;
  });

  return (
    <div className="w-full space-y-4">
      {/* Stream Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-3 w-3 relative">
            {isStreaming && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isStreaming ? "bg-cyan-500" : "bg-slate-400"
              }`}
            />
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>{lang === "km" ? "លំហូរសកម្មភាព Process ផ្ទាល់ (Live Telemetry Stream)" : "Live Process Stream"}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold">
                {activities.length} Events
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === "km"
                ? "កត់ត្រារាល់ការហៅ API, ការកែប្រែទិន្នន័យ, និងសកម្មភាពអ្នកប្រើប្រាស់ មិនឱ្យបាត់សូម្បីមួយ"
                : "Continuous event tracing across in-flight writes, mutations, and authentication"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">{lang === "km" ? "គ្រប់ប្រភេទ (All Types)" : "All Types"}</option>
            <option value="MUTATION">Mutation / Save</option>
            <option value="QUERY">Query / Fetch</option>
            <option value="AUTH">Authentication</option>
            <option value="ERROR">Error</option>
          </select>

          {/* Pause / Resume Button */}
          <button
            onClick={onToggleStreaming}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
              isStreaming
                ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
            }`}
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>{lang === "km" ? "ផ្អាក Stream" : "Pause"}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>{lang === "km" ? "បន្ត Stream" : "Resume"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stream Timeline List */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
            {lang === "km" ? "មិនទាន់មានព្រឹត្តិការណ៍ Process ថ្មីត្រូវបានកត់ត្រានៅឡើយទេ..." : "No recent process activities recorded."}
          </div>
        ) : (
          filtered.map((act) => {
            const isError = act.type === "ERROR";
            const isMutation = act.type === "MUTATION";
            const isAuth = act.type === "AUTH";

            let badgeClass = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
            let Icon = Activity;

            if (isError) {
              badgeClass = "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
              Icon = AlertCircle;
            } else if (isMutation) {
              badgeClass = "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
              Icon = ArrowUpRight;
            } else if (isAuth) {
              badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
              Icon = Shield;
            }

            return (
              <div
                key={act.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-slate-100 dark:border-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${badgeClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${badgeClass}`}>
                        {act.type}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        {act.serviceId}
                      </span>
                      {act.statusCode && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 rounded ${
                            act.statusCode >= 400
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          }`}
                        >
                          HTTP {act.statusCode}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium truncate mt-0.5">
                      {lang === "km" ? act.descriptionKm : act.descriptionEn}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 text-right">
                  {act.durationMs !== undefined && (
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      {act.durationMs}ms
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
