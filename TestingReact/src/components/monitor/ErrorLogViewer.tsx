"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Copy,
  Check,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Terminal,
  Clock,
  User,
  Globe,
  Radio,
} from "lucide-react";
import { type SystemErrorLog, type ServiceId, type ErrorSeverity } from "@/services/systemObservability";
import { toast } from "react-hot-toast";

interface Props {
  errors: SystemErrorLog[];
  onClearErrors: () => void;
  onSwitchToStream?: () => void;
  lang?: "km" | "en";
}

export const ErrorLogViewer: React.FC<Props> = ({
  errors,
  onClearErrors,
  onSwitchToStream,
  lang = "km",
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorSeverity | "all">("all");
  const [selectedService, setSelectedService] = useState<ServiceId | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredErrors = errors.filter((err) => {
    if (selectedSeverity !== "all" && err.severity !== selectedSeverity) return false;
    if (selectedService !== "all" && err.serviceId !== selectedService) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        err.message.toLowerCase().includes(q) ||
        err.rootCauseKm.toLowerCase().includes(q) ||
        err.rootCauseEn.toLowerCase().includes(q) ||
        (err.endpoint && err.endpoint.toLowerCase().includes(q)) ||
        (err.statusCode && String(err.statusCode).includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleCopyDiagnostic = (err: SystemErrorLog) => {
    const report = `================================================
CAMPROTEC ENTERPRISE ERROR DIAGNOSTIC REPORT
================================================
Timestamp:    ${err.timestamp}
Service:      ${err.serviceName} (${err.serviceId})
Severity:     ${err.severity}
Status Code:  ${err.statusCode || "N/A"}
Method:       ${err.method || "N/A"}
Endpoint:     ${err.endpoint || "N/A"}
Error Message: ${err.message}

--- ROOT CAUSE ANALYSIS ---
(KM): ${err.rootCauseKm}
(EN): ${err.rootCauseEn}

--- ACTIONABLE FIX ADVICE ---
(KM): ${err.actionAdviceKm}
(EN): ${err.actionAdviceEn}

--- USER CONTEXT ---
Username:     ${err.userContext?.username || "N/A"}
Role:         ${err.userContext?.role || "N/A"}

--- STACK TRACE ---
${err.stackTrace || "No internal stack trace captured."}
================================================`;

    navigator.clipboard.writeText(report);
    setCopiedId(err.id);
    toast.success(lang === "km" ? "📋 បានចម្លងរបាយការណ៍ Error សម្រាប់ Developer រួចរាល់!" : "📋 Diagnostic report copied!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="w-full space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === "km"
                ? "ស្វែងរក Error តាម Message, Endpoint, Status Code..."
                : "Search errors by message, endpoint, status..."
            }
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2">
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">{lang === "km" ? "គ្រប់កម្រិត (All Severity)" : "All Severity"}</option>
            <option value="CRITICAL">Critical (ធ្ងន់ធ្ងរ)</option>
            <option value="ERROR">Error (កំហុស)</option>
            <option value="WARNING">Warning (ប្រុងប្រយ័ត្ន)</option>
          </select>

          {/* Service Filter */}
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">{lang === "km" ? "គ្រប់សេវាកម្ម (All Services)" : "All Services"}</option>
            <option value="our-technical-api">Technical API (.NET 8)</option>
            <option value="our-user-api">User API (.NET 8)</option>
            <option value="web-frontend">Web Frontend (Next.js)</option>
            <option value="mssql-db">MSSQL Database</option>
            <option value="telegram">Telegram Dispatcher</option>
            <option value="cloudflare-r2">Cloudflare R2</option>
          </select>

          {errors.length > 0 && (
            <button
              onClick={onClearErrors}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === "km" ? "សម្អាត Logs" : "Clear Logs"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Errors List */}
      {filteredErrors.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-inner">
            <Check className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {lang === "km" ? "ប្រព័ន្ធដំណើរការរលូន គ្មានកំហុស Error ឡើយ" : "All Services Operational — Zero Errors"}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
            {lang === "km"
              ? "រាល់សកម្មភាព និងការហៅ API ទាំងអស់កំពុងដំណើរការយ៉ាងរលូន គ្មាន Error ណាមួយកើតឡើងឡើយ។"
              : "No active or recorded errors matching the current filter. Live error telemetry is listening."}
          </p>

          {onSwitchToStream && (
            <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 max-w-lg text-left space-y-2.5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                </span>
                <span>
                  {lang === "km" ? "💡 ស្វែងរក Log នៃដំណើរការ Services (Process & Service Run Logs)?" : "💡 Looking for Service Runtime & Process Logs?"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === "km"
                  ? "ផ្ទាំង 'Error Logs' នេះកត់ត្រាតែពេលមានបញ្ហា/កំហុសប្រព័ន្ធប៉ុណ្ណោះ។ ដើម្បីតាមដានរាល់ដំណើរការ API ផ្ទាល់ (Live Stream), ការ Update ទិន្នន័យ និងប្រតិបត្តិការ Services សូមចូលទៅកាន់ផ្ទាំង Live Stream។"
                  : "This 'Error Logs' tab only logs system faults and errors. To trace live API requests, data updates, and continuous microservices execution, visit the Live Stream tab."}
              </p>
              <button
                onClick={onSwitchToStream}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{lang === "km" ? "⚡ មើលសកម្មភាពដំណើរការ (Live Stream)" : "⚡ Switch to Live Process Stream"}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredErrors.map((err) => {
            const isExpanded = expandedErrorId === err.id;
            const isCritical = err.severity === "CRITICAL";
            const isWarning = err.severity === "WARNING";

            return (
              <div
                key={err.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden bg-white dark:bg-slate-900 shadow-sm ${
                  isCritical
                    ? "border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/10"
                    : isWarning
                    ? "border-amber-300 dark:border-amber-900/60 ring-1 ring-amber-500/10"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                {/* Error Summary Card */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Severity Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ${
                        isCritical
                          ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                          : isWarning
                          ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                          : "bg-red-500 text-white shadow-md shadow-red-500/20"
                      }`}
                    >
                      {isCritical ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1 flex-1">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isCritical
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : isWarning
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                          }`}
                        >
                          {err.severity} {err.statusCode ? `• ${err.statusCode}` : ""}
                        </span>

                        <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {err.serviceName}
                        </span>

                        {err.endpoint && (
                          <span className="font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60 truncate max-w-[280px]">
                            {err.method ? `${err.method} ` : ""}
                            {err.endpoint}
                          </span>
                        )}

                        <span className="text-slate-400 dark:text-slate-500 ml-auto flex items-center gap-1 font-mono text-[10px]">
                          <Clock className="w-3 h-3" />
                          {new Date(err.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Main Message */}
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                        {err.message}
                      </h4>

                      {/* Root cause preview */}
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{lang === "km" ? err.rootCauseKm : err.rootCauseEn}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleCopyDiagnostic(err)}
                      title={lang === "km" ? "ចម្លងរបាយការណ៍ Error សម្រាប់ Developer" : "Copy Diagnostic Report for Dev"}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {copiedId === err.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{lang === "km" ? "ចម្លង Diagnostic" : "Copy Report"}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 transition-colors"
                    >
                      <span>{isExpanded ? (lang === "km" ? "បិទ" : "Close") : (lang === "km" ? "លម្អិត" : "Inspect")}</span>
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expandable Diagnostic Drawer */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 space-y-3">
                    {/* Action Advice Box */}
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs">
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        <Info className="w-4 h-4 text-emerald-500" />
                        <span>{lang === "km" ? "ដំណោះស្រាយដែលត្រូវអនុវត្ត (Actionable Fix Advice):" : "Recommended Action:"}</span>
                      </div>
                      <p>{lang === "km" ? err.actionAdviceKm : err.actionAdviceEn}</p>
                    </div>

                    {/* Stack Trace / Exception Details */}
                    {err.stackTrace && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <Terminal className="w-3.5 h-3.5" />
                          <span>{lang === "km" ? "Stack Trace & Exception Code:" : "Stack Trace:"}</span>
                        </div>
                        <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
                          {err.stackTrace}
                        </pre>
                      </div>
                    )}

                    {/* Payload / Context */}
                    {err.payloadSnippet && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {lang === "km" ? "Request Payload:" : "Request Payload:"}
                        </div>
                        <pre className="p-3 rounded-xl bg-slate-900 text-amber-300 font-mono text-[11px] overflow-x-auto max-h-36 border border-slate-800">
                          {err.payloadSnippet}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
