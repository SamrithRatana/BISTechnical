"use client";

import React, { useState } from "react";
import {
  X,
  Server,
  Activity,
  Cpu,
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  RefreshCw,
  Zap,
  Terminal,
  Radio,
} from "lucide-react";
import { type ServiceNodeInfo, type SystemErrorLog, type ProcessActivityEvent } from "@/services/systemObservability";
import { toast } from "react-hot-toast";

interface Props {
  service: ServiceNodeInfo | null;
  errors: SystemErrorLog[];
  activities?: ProcessActivityEvent[];
  onClose: () => void;
  onRefresh: () => void;
  lang?: "km" | "en";
}

export const ServiceDetailModal: React.FC<Props> = ({
  service,
  errors,
  activities = [],
  onClose,
  onRefresh,
  lang = "km",
}) => {
  const [isCleaning, setIsCleaning] = useState(false);

  if (!service) return null;

  const serviceErrors = errors.filter((e) => e.serviceId === service.id);
  const serviceActivities = activities.filter((a) => a.serviceId === service.id);

  const handleCleanServiceMemory = async () => {
    setIsCleaning(true);
    try {
      const res = await fetch("/api/health", { method: "POST" });
      if (res.ok) {
        toast.success(lang === "km" ? "🧹 បានបញ្ជាសម្អាត Memory សេវានេះជោគជ័យ!" : "Memory cleaned successfully!");
        onRefresh();
      }
    } catch {
      toast.error(lang === "km" ? "មិនអាចសម្អាត Memory បានទេ" : "Failed to clean memory");
    } finally {
      setIsCleaning(false);
    }
  };

  const isHealthy = service.status === "healthy";
  const isError = service.status === "error";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                isError
                  ? "bg-rose-500 shadow-rose-500/30"
                  : isHealthy
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25"
                  : "bg-amber-500 shadow-amber-500/25"
              }`}
            >
              <Server className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {lang === "km" ? service.nameKm || service.name : service.name}
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                  Port: {service.port}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Container: <span className="font-mono">{service.containerName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 font-medium">{lang === "km" ? "ស្ថានភាព (Status)" : "Status"}</span>
              <div className="flex items-center gap-1.5 font-bold text-xs mt-1 text-slate-800 dark:text-slate-100">
                {isError ? (
                  <>
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <span className="text-rose-600 dark:text-rose-400">Error / Down</span>
                  </>
                ) : isHealthy ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Operational</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">Degraded</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 font-medium">{lang === "km" ? "ល្បឿនឆ្លើយតប (Latency)" : "Latency"}</span>
              <div className="flex items-center gap-1.5 font-bold text-xs mt-1 font-mono text-slate-800 dark:text-slate-100">
                <Activity className="w-4 h-4 text-cyan-500" />
                <span>{service.latencyMs !== null ? `${service.latencyMs} ms` : "Timeout"}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 font-medium">{lang === "km" ? "ការប្រើ RAM (Memory)" : "RAM Usage"}</span>
              <div className="flex items-center gap-1.5 font-bold text-xs mt-1 font-mono text-slate-800 dark:text-slate-100">
                <Cpu className="w-4 h-4 text-indigo-500" />
                <span>{service.memoryMb ? `${service.memoryMb} MB` : "Shared"}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 font-medium">{lang === "km" ? "ចំនួន Error (Errors)" : "Errors"}</span>
              <div className="flex items-center gap-1.5 font-bold text-xs mt-1 text-slate-800 dark:text-slate-100">
                <span
                  className={`px-2 py-0.5 rounded-md font-mono ${
                    serviceErrors.length > 0
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  }`}
                >
                  {serviceErrors.length}
                </span>
              </div>
            </div>
          </div>

          {/* Details / Configuration table */}
          {service.details && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === "km" ? "ព័ត៌មានបច្ចេកទេស និង Configuration របស់ Service:" : "Service Details & Metadata:"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(service.details).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Errors specific to this service */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {lang === "km" ? `កំហុសដែលបានកត់ត្រាក្នុងសេវានេះ (${serviceErrors.length}):` : `Logged Errors (${serviceErrors.length}):`}
              </h4>
            </div>

            {serviceErrors.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-700 dark:text-emerald-400 font-medium text-center">
                {lang === "km" ? "✅ សេវានេះគ្មានកំហុស Error ណាមួយឡើយ (All OK)" : "✅ Zero logged errors for this service"}
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {serviceErrors.slice(0, 5).map((err) => (
                  <div
                    key={err.id}
                    className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-rose-700 dark:text-rose-400">
                        {err.statusCode ? `[HTTP ${err.statusCode}] ` : ""}
                        {err.message}
                      </span>
                      <span className="font-mono text-slate-400 text-[10px]">
                        {new Date(err.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      💡 {lang === "km" ? err.rootCauseKm : err.rootCauseEn}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activities specific to this service */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-500" />
                <span>
                  {lang === "km"
                    ? `សកម្មភាព Process ដំណើរការចុងក្រោយ (${serviceActivities.length}):`
                    : `Recent Service Run Logs (${serviceActivities.length}):`}
                </span>
              </h4>
            </div>

            {serviceActivities.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-400 text-center">
                {lang === "km" ? "មិនទាន់មាន Process ថ្មីសម្រាប់សេវានេះនៅឡើយទេ" : "No recent activity recorded for this service"}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {serviceActivities.slice(0, 10).map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs hover:border-cyan-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                          act.type === "MUTATION"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                            : act.type === "AUTH"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : act.type === "ERROR"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {act.type}
                      </span>
                      <span className="truncate text-slate-700 dark:text-slate-200 font-medium">
                        {lang === "km" ? act.descriptionKm : act.descriptionEn}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono text-slate-400">
                      {act.durationMs !== undefined && (
                        <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{act.durationMs}ms</span>
                      )}
                      <span>{new Date(act.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCleanServiceMemory}
              disabled={isCleaning}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isCleaning ? (lang === "km" ? "កំពុងសម្អាត..." : "Cleaning...") : (lang === "km" ? "សម្អាត RAM សេវានេះ" : "Purge RAM")}</span>
            </button>

            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{lang === "km" ? "ធ្វើតេស្ត Ping ម្តងទៀត" : "Re-Probe"}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors"
          >
            {lang === "km" ? "បិទផ្ទាំង" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
};
