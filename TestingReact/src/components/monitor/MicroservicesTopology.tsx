"use client";

import React, { useMemo } from "react";
import {
  Server,
  Globe,
  Database,
  ShieldCheck,
  Send,
  Cloud,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { type ServiceNodeInfo, type ServiceId } from "@/services/systemObservability";

interface Props {
  nodes: ServiceNodeInfo[];
  selectedServiceId: ServiceId | null;
  onSelectService: (service: ServiceNodeInfo) => void;
  lang?: "km" | "en";
}

interface NodeLayout {
  id: ServiceId;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  icon: React.ElementType;
}

const TOPOLOGY_COORDINATES: NodeLayout[] = [
  { id: "nginx-gateway", x: 12, y: 38, icon: Layers },
  { id: "web-frontend", x: 37, y: 38, icon: Globe },
  { id: "our-technical-api", x: 64, y: 20, icon: Server },
  { id: "our-user-api", x: 64, y: 50, icon: ShieldCheck },
  { id: "mssql-db", x: 90, y: 38, icon: Database },
  { id: "redis", x: 64, y: 80, icon: Zap },
  { id: "telegram", x: 90, y: 15, icon: Send },
  { id: "cloudflare-r2", x: 37, y: 80, icon: Cloud },
];

const CONNECTIONS: Array<{ from: ServiceId; to: ServiceId; label?: string }> = [
  { from: "nginx-gateway", to: "web-frontend", label: "HTTPS / Reverse Proxy" },
  { from: "web-frontend", to: "our-technical-api", label: "Internal HTTP / 8000" },
  { from: "web-frontend", to: "our-user-api", label: "Auth & Identity / 8087" },
  { from: "web-frontend", to: "cloudflare-r2", label: "Media Uploads / CDN" },
  { from: "our-technical-api", to: "mssql-db", label: "TechnicalServiceDB" },
  { from: "our-user-api", to: "mssql-db", label: "EngineerUserDB" },
  { from: "our-technical-api", to: "telegram", label: "Workshop Topics" },
  { from: "our-technical-api", to: "redis", label: "Telemetry & Cache" },
];

export const MicroservicesTopology: React.FC<Props> = ({
  nodes,
  selectedServiceId,
  onSelectService,
  lang = "km",
}) => {
  const nodeMap = useMemo(() => {
    const map = new Map<ServiceId, ServiceNodeInfo>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const coordMap = useMemo(() => {
    const map = new Map<ServiceId, NodeLayout>();
    TOPOLOGY_COORDINATES.forEach((c) => map.set(c.id, c));
    return map;
  }, []);

  return (
    <div className="relative w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50/90 via-white to-slate-100/90 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 shadow-xl overflow-x-auto select-none">
      <div className="min-w-[840px] relative min-h-[580px]">
        {/* Ambient background grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
          style={{
            backgroundImage: "radial-gradient(#64748b 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

      {/* Header bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              {lang === "km" ? "ផែនទីលំហូរស្ថាបត្យកម្ម Microservices (Interactive Topology)" : "Interactive Microservices Architecture Topology"}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === "km"
              ? "ចុចលើ Service ណាមួយដើម្បីពិនិត្យ Error Log, Memory, Latency និងដំណើរការ Process ជាក់ស្តែង"
              : "Click any service node to inspect its error logs, memory, latency, and live processes"}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span>{lang === "km" ? "ប្រក្រតី (Healthy)" : "Healthy"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
            <span>{lang === "km" ? "យឺត/ប្រុងប្រយ័ត្ន (Degraded)" : "Degraded"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50 animate-pulse" />
            <span>{lang === "km" ? "មានបញ្ហា (Error / Down)" : "Error / Down"}</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas for Connecting Lines & Flow Particles */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <linearGradient id="lineGradHealthy" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="lineGradError" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#e11d48" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {CONNECTIONS.map((conn, idx) => {
          const from = coordMap.get(conn.from);
          const to = coordMap.get(conn.to);
          const fromNode = nodeMap.get(conn.from);
          const toNode = nodeMap.get(conn.to);

          if (!from || !to) return null;

          const hasError = (fromNode?.errorCount || 0) > 0 || (toNode?.errorCount || 0) > 0;

          return (
            <g key={`conn-${idx}`}>
              <line
                x1={`${from.x}%`}
                y1={`${from.y}%`}
                x2={`${to.x}%`}
                y2={`${to.y}%`}
                stroke={hasError ? "url(#lineGradError)" : "url(#lineGradHealthy)"}
                strokeWidth={hasError ? 2.5 : 2}
                strokeDasharray={hasError ? "4,4" : "6,6"}
                className={hasError ? "animate-pulse" : ""}
              />
            </g>
          );
        })}
      </svg>

      {/* Nodes Layer */}
      <div className="relative z-10 w-full h-[540px]">
        {TOPOLOGY_COORDINATES.map((layout) => {
          const info = nodeMap.get(layout.id);
          const Icon = layout.icon;
          const isSelected = selectedServiceId === layout.id;
          const hasError = (info?.errorCount || 0) > 0 || info?.status === "error";
          const isDegraded = info?.status === "degraded";

          let borderTone = "border-slate-300/80 dark:border-slate-700/80";
          let glowTone = "";
          let bgBadge = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";

          if (hasError) {
            borderTone = "border-rose-500 ring-4 ring-rose-500/20";
            glowTone = "shadow-lg shadow-rose-500/30 animate-pulse";
            bgBadge = "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40";
          } else if (isDegraded) {
            borderTone = "border-amber-500 ring-2 ring-amber-500/20";
            glowTone = "shadow-md shadow-amber-500/20";
            bgBadge = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40";
          } else if (isSelected) {
            borderTone = "border-cyan-500 ring-4 ring-cyan-500/30";
            glowTone = "shadow-lg shadow-cyan-500/25";
          }

          return (
            <div
              key={layout.id}
              onClick={() => info && onSelectService(info)}
              style={{
                left: `${layout.x}%`,
                top: `${layout.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              className={`absolute cursor-pointer transition-all duration-300 hover:scale-105 group`}
            >
              {/* Pulsing Alarm Ripple for Errors */}
              {hasError && (
                <div className="absolute -inset-2 rounded-2xl bg-rose-500/25 animate-ping pointer-events-none" />
              )}

              <div
                className={`relative flex flex-col p-3 sm:p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border ${borderTone} ${glowTone} min-w-[150px] sm:min-w-[170px] max-w-[200px] shadow-lg`}
              >
                {/* Node Top: Icon & Port Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      hasError
                        ? "bg-rose-500 text-white shadow-md shadow-rose-500/40"
                        : isDegraded
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                        : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200/60 dark:border-slate-700/60">
                    {info?.port || "N/A"}
                  </span>
                </div>

                {/* Service Name */}
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {lang === "km" ? info?.nameKm || info?.name : info?.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mb-2">
                  {info?.containerName}
                </div>

                {/* Status & Latency Pills */}
                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                  <div className={`flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded border ${bgBadge}`}>
                    {hasError ? (
                      <>
                        <XCircle className="w-3 h-3" />
                        <span>{info?.errorCount || 1} Error</span>
                      </>
                    ) : isDegraded ? (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        <span>Degraded</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Online</span>
                      </>
                    )}
                  </div>

                  {info?.latencyMs !== null && info?.latencyMs !== undefined && (
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                      {info.latencyMs}ms
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};
