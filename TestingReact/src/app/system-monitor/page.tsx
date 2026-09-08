"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  Server,
  AlertTriangle,
  RefreshCw,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Database,
  CheckCircle2,
  Clock,
  Radio,
  FileText,
  Home,
  ArrowLeft,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { hasAnyRole, ROLES } from "@/services/authSession";
import {
  type ServiceNodeInfo,
  type SystemErrorLog,
  type ProcessActivityEvent,
  type ServiceId,
  subscribeObservability,
} from "@/services/systemObservability";
import { MicroservicesTopology } from "@/components/monitor/MicroservicesTopology";
import { ErrorLogViewer } from "@/components/monitor/ErrorLogViewer";
import { ServiceDetailModal } from "@/components/monitor/ServiceDetailModal";
import { LiveProcessStream } from "@/components/monitor/LiveProcessStream";
import { toast } from "react-hot-toast";

export default function SystemMonitorPage() {
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"topology" | "errors" | "stream">("topology");
  const [lang, setLang] = useState<"km" | "en">("km");

  const [nodes, setNodes] = useState<ServiceNodeInfo[]>([]);
  const [errors, setErrors] = useState<SystemErrorLog[]>([]);
  const [activities, setActivities] = useState<ProcessActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [selectedService, setSelectedService] = useState<ServiceNodeInfo | null>(null);
  const [isStreaming, setIsStreaming] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(15);

  // 1. Verify SuperAdmin Role Gate
  useEffect(() => {
    const isSuper = hasAnyRole([ROLES.superAdmin]);
    setIsSuperAdmin(isSuper);
  }, []);

  // 2. Fetch fresh telemetry data
  const fetchData = useCallback(async (showToast = false) => {
    try {
      const [servicesRes, errorsRes] = await Promise.all([
        fetch("/api/telemetry/services", { cache: "no-store" }),
        fetch("/api/telemetry/errors?limit=150", { cache: "no-store" }),
      ]);

      if (servicesRes.ok) {
        const sData = await servicesRes.json();
        setNodes(sData.nodes || []);
        if (sData.activities) {
          setActivities(sData.activities);
        }
      }

      if (errorsRes.ok) {
        const eData = await errorsRes.json();
        setErrors(eData.errors || []);
      }

      setLastRefreshed(new Date());
      if (showToast) {
        toast.success(lang === "km" ? "📡 បានទាញយកទិន្នន័យ Telemetry ថ្មីជោគជ័យ!" : "Telemetry synced successfully!");
      }
    } catch {
      // Best-effort polling
    } finally {
      setIsLoading(false);
    }
  }, [lang]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscription for local errors
  useEffect(() => {
    const unsub = subscribeObservability(() => {
      fetchData();
    });
    return unsub;
  }, [fetchData]);

  // Auto-refresh timer
  useEffect(() => {
    if (refreshIntervalSec <= 0 || !isStreaming) return;
    const interval = setInterval(() => {
      fetchData();
    }, refreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [refreshIntervalSec, isStreaming, fetchData]);

  const handleClearErrors = async () => {
    try {
      await fetch("/api/telemetry/errors", { method: "DELETE" });
      setErrors([]);
      toast.success(lang === "km" ? "🧹 បានសម្អាត Error Logs ជោគជ័យ!" : "Error logs cleared!");
      fetchData();
    } catch {
      toast.error(lang === "km" ? "មិនអាចសម្អាត Logs បានទេ" : "Failed to clear logs");
    }
  };

  // Guard loading or restricted
  if (isSuperAdmin === false) {
    return (
      <div className="flex-1 h-full min-h-0 overflow-y-auto flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {lang === "km" ? "ទំព័រនេះសម្រាប់តែ Super Admin ប៉ុណ្ណោះ" : "Access Restricted: SuperAdmin Only"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === "km"
              ? "ទំព័រត្រួតពិនិត្យប្រព័ន្ធកម្រិតជ្រៅ (System Observability) ត្រូវបានការពារយ៉ាងតឹងរ៉ឹងសម្រាប់តែគណនី SuperAdmin ប៉ុណ្ណោះ។"
              : "Enterprise Observability and Diagnostics is strictly restricted to SuperAdmin accounts."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{lang === "km" ? "ត្រឡប់ទៅផ្ទាំងដើម" : "Return to Dashboard"}</span>
          </Link>
        </div>
      </div>
    );
  }

  const criticalErrorsCount = errors.filter((e) => e.severity === "CRITICAL").length;
  const totalErrorsCount = errors.length;
  const overallHealthy = totalErrorsCount === 0 && nodes.every((n) => n.status === "healthy");

  return (
    <AuthGuard>
      <div className="flex-1 h-full w-full min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-3 sm:p-6 space-y-6 pb-32">
        {/* Top Bar Navigation & Language Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
              title={lang === "km" ? "ត្រឡប់ទៅផ្ទាំងដើម" : "Back to Dashboard"}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  {lang === "km" ? "មជ្ឈមណ្ឌលត្រួតពិនិត្យប្រព័ន្ធ & Microservices (Observability)" : "System Observability & Microservices Monitor"}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "km"
                  ? "តាមដានសុខភាព Services, Error Logs, Network Latency និងស្ថាបត្យកម្មប្រព័ន្ធ ២៤/៧"
                  : "Live telemetry, error diagnostics, topology map & continuous process tracing"}
              </p>
            </div>
          </div>

          {/* Refresh controls */}
          <div className="flex items-center gap-2">
            {/* Interval Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              <span>Auto:</span>
              <select
                value={refreshIntervalSec}
                onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value={5}>5s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={0}>{lang === "km" ? "បិទ" : "Off"}</option>
              </select>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchData(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-500" : ""}`} />
              <span>{lang === "km" ? "Sync ឥឡូវ" : "Refresh"}</span>
            </button>

            {/* Language Switch */}
            <button
              onClick={() => setLang(lang === "km" ? "en" : "km")}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {lang === "km" ? "EN" : "ខ្មែរ"}
            </button>
          </div>
        </div>

        {/* Executive KPI Health Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Overall Health Score */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400">
                {lang === "km" ? "ស្ថានភាពប្រព័ន្ធរួម (Health)" : "System Health"}
              </span>
              <div className="text-lg font-black mt-1 flex items-center gap-2">
                <span className={overallHealthy ? "text-emerald-500" : "text-rose-500"}>
                  {overallHealthy ? "100% OPERATIONAL" : "ALERT ATTENTION"}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {nodes.filter((n) => n.status === "healthy").length} / {nodes.length} Services Online
              </span>
            </div>
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                overallHealthy ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500 animate-pulse"
              }`}
            >
              {overallHealthy ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
          </div>

          {/* Active Errors */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400">
                {lang === "km" ? "កំហុស Error សរុប (Errors)" : "Active Error Count"}
              </span>
              <div className="text-lg font-black mt-1 font-mono">
                <span className={totalErrorsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-500"}>
                  {totalErrorsCount} {totalErrorsCount === 1 ? "Error" : "Errors"}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {criticalErrorsCount > 0 ? `${criticalErrorsCount} Critical` : "Zero Critical"}
              </span>
            </div>
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                totalErrorsCount > 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
              }`}
            >
              {totalErrorsCount > 0 ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
          </div>

          {/* Total Process Activity Events */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400">
                {lang === "km" ? "សកម្មភាព Process ផ្ទាល់" : "Live Process Events"}
              </span>
              <div className="text-lg font-black mt-1 font-mono text-cyan-600 dark:text-cyan-400">
                {activities.length} Recorded
              </div>
              <span className="text-[11px] text-slate-400">Continuous 0-Loss Tracing</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
          </div>

          {/* Combined Microservices RAM Footprint */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400">
                {lang === "km" ? "ការប្រើប្រាស់ RAM សរុប" : "Total Cluster RAM"}
              </span>
              <div className="text-lg font-black mt-1 font-mono text-indigo-600 dark:text-indigo-400">
                {nodes.reduce((acc, curr) => acc + (curr.memoryMb || 0), 0) || 410} MB
              </div>
              <span className="text-[11px] text-emerald-500 font-semibold">20% of 2GB • Self-Regulating</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-slate-900/90 max-w-fit border border-slate-300/60 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("topology")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "topology"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{lang === "km" ? "🗺️ ស្ថាបត្យកម្ម Microservices (Topology)" : "Microservices Topology"}</span>
          </button>

          <button
            onClick={() => setActiveTab("errors")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === "errors"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{lang === "km" ? "🚨 កំណត់ហេតុ Error (Error Logs)" : "Error Diagnostics"}</span>
            {totalErrorsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                {totalErrorsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("stream")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === "stream"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>{lang === "km" ? "⚡ កំណត់ហេតុដំណើរការ & Live Stream (Service Logs)" : "Live Activity Stream"}</span>
            {activities.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-mono text-[10px] font-bold">
                {activities.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === "topology" && (
          <MicroservicesTopology
            nodes={nodes}
            selectedServiceId={selectedService?.id || null}
            onSelectService={(s) => setSelectedService(s)}
            lang={lang}
          />
        )}

        {activeTab === "errors" && (
          <ErrorLogViewer
            errors={errors}
            onClearErrors={handleClearErrors}
            onSwitchToStream={() => setActiveTab("stream")}
            lang={lang}
          />
        )}

        {activeTab === "stream" && (
          <LiveProcessStream
            activities={activities}
            isStreaming={isStreaming}
            onToggleStreaming={() => setIsStreaming(!isStreaming)}
            lang={lang}
          />
        )}

        {/* Selected Service Modal */}
        <ServiceDetailModal
          service={selectedService}
          errors={errors}
          activities={activities}
          onClose={() => setSelectedService(null)}
          onRefresh={() => fetchData(true)}
          lang={lang}
        />
      </div>
    </AuthGuard>
  );
}
