"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowDown,
  Key,
  ScanFace,
  Smartphone,
  Fingerprint,
  Shield,
  Layers,
  Cpu,
  Database,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wrench,
  Package,
  TrendingUp,
  Boxes,
  Search,
  QrCode,
  Activity,
  Zap,
  Workflow,
} from "lucide-react";
import type { DocsDiagram } from "./content/docsData";
import { useDocsText } from "./useDocsText";
import { useDocsTheme } from "./DocsThemeContext";

export const SERVICE_STATUSES_DB = [
  { id: 1, nameEn: "Item Recieved", nameKm: "ម៉ាស៊ីនទទួលចូល", dept: "បច្ចេកទេស", route: "/receive-item", color: "violet" },
  { id: 10, nameEn: "Inspecting", nameKm: "កំពុងត្រួតពិនិត្យ/វិនិច្ឆ័យ", dept: "បច្ចេកទេស", route: "/inspect-item", color: "cyan" },
  { id: 2, nameEn: "Inspection", nameKm: "វិនិច្ឆ័យរួចរាល់", dept: "បច្ចេកទេស", route: "/inspect-item", color: "indigo" },
  { id: 4, nameEn: "Awaiting Sparepart", nameKm: "រង់ចាំ/ឆែកគ្រឿងបន្លាស់", dept: "ស្តុក", route: "/spare-request", color: "amber" },
  { id: 3, nameEn: "Awaiting Customer Confirm", nameKm: "រង់ចាំអតិថិជនយល់ព្រមតម្លៃ", dept: "ផ្នែកលក់", route: "/waiting-confirm", color: "cyan" },
  { id: 11, nameEn: "Sale Confirmed", nameKm: "បញ្ជាក់ការលក់/អាចជួសជុលបាន", dept: "ផ្នែកលក់", route: "/confirmed-sale", color: "emerald" },
  { id: 7, nameEn: "Customer Rejected", nameKm: "អតិថិជនបដិសេធតម្លៃ", dept: "ផ្នែកលក់", route: "/rejected", color: "rose" },
  { id: 8, nameEn: "Unrepairable", nameKm: "ខូចជួសជុលលែងកើត", dept: "បច្ចេកទេស/លក់", route: "/unrepairable", color: "rose" },
  { id: 12, nameEn: "Sent Spareparts", nameKm: "បានបញ្ជូនគ្រឿងបន្លាស់ទៅជាង", dept: "ស្តុក", route: "/spare-request", color: "emerald" },
  { id: 5, nameEn: "Repairing", nameKm: "កំពុងជួសជុល", dept: "បច្ចេកទេស", route: "/pending-repairs", color: "violet" },
  { id: 9, nameEn: "Repair by Third-Party", nameKm: "ជួសជុលដោយដៃគូក្រៅ (Outsource)", dept: "បច្ចេកទេស", route: "/third-party-repairs", color: "amber" },
  { id: 6, nameEn: "Finished", nameKm: "ជួសជុលរួចរាល់/ប្រគល់ជូន", dept: "បច្ចេកទេស", route: "/completed-repairs", color: "emerald" },
];

const CABLES_CONFIG = [
  {
    id: "cable-1",
    fromId: "port-a4",
    toId: "port-b5",
    labelKm: "១. ស្នើគ្រឿងបន្លាស់",
    labelEn: "1. Request Spareparts",
    subKm: "A (បច្ចេកទេស) ➔ B (ស្តុក)",
    subEn: "A (Technical) ➔ B (Stock)",
    color: "#06b6d4",
    colorLight: "#0e7490",
    strokeGrad: "grad-a-to-b",
    biDirectional: false,
  },
  {
    id: "cable-2",
    fromId: "port-b6",
    toId: "port-c7",
    labelKm: "២. តម្លៃ Quote & Lead Time",
    labelEn: "2. Parts Cost & ETA",
    subKm: "B (ស្តុក) ➔ C (ផ្នែកលក់)",
    subEn: "B (Stock) ➔ C (Sales)",
    color: "#f59e0b",
    colorLight: "#b45309",
    strokeGrad: "grad-b-to-c",
    biDirectional: false,
  },
  {
    id: "cable-3",
    fromId: "port-c9",
    toId: "port-b12-in",
    labelKm: "៣. Sale Confirmed ➔ ដកគ្រឿង",
    labelEn: "3. Confirmed ➔ Issue Parts",
    subKm: "C (ផ្នែកលក់) ➔ B (ស្តុក)",
    subEn: "C (Sales) ➔ B (Stock)",
    color: "#10b981",
    colorLight: "#047857",
    strokeGrad: "grad-c-to-b",
    biDirectional: false,
  },
  {
    id: "cable-4",
    fromId: "port-b12-out",
    toId: "port-a-repair",
    labelKm: "៤. ប្រគល់គ្រឿង ➔ ជួសជុល & QA",
    labelEn: "4. Sent Parts ➔ Repair & QA",
    subKm: "B (ស្តុក) ➔ A (បច្ចេកទេស)",
    subEn: "B (Stock) ➔ A (Technical)",
    color: "#8b5cf6",
    colorLight: "#6d28d9",
    strokeGrad: "grad-b-to-a",
    biDirectional: false,
  },
  {
    id: "cable-5",
    fromId: "port-a-unrepair",
    toId: "port-c-unrepair",
    labelKm: "៥. ខូចជួសជុលមិនកើត (ចុចបាន ២ ផ្នែក)",
    labelEn: "5. Unrepairable (Dual Trigger)",
    subKm: "A (បច្ចេកទេស) ↔ C (ផ្នែកលក់)",
    subEn: "A (Technical) ↔ C (Sales)",
    color: "#f43f5e",
    colorLight: "#be123c",
    strokeGrad: "grad-a-to-c-rose",
    biDirectional: true,
  },
];

function AuraServicesSwimlane({ isKhmer }: { isKhmer: boolean }) {
  const { isDark } = useDocsTheme();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [activeCable, setActiveCable] = React.useState<string | null>(null);
  const [paths, setPaths] = React.useState<
    {
      id: string;
      d: string;
      color: string;
      colorLight: string;
      strokeGrad: string;
      labelKm: string;
      labelEn: string;
      subKm: string;
      subEn: string;
      biDirectional?: boolean;
    }[]
  >([]);

  const recalculatePaths = React.useCallback(() => {
    if (!containerRef.current) return;
    const contRect = containerRef.current.getBoundingClientRect();
    const result: typeof paths = [];

    for (const cable of CABLES_CONFIG) {
      const fromEl = document.getElementById(cable.fromId);
      const toEl = document.getElementById(cable.toId);
      if (!fromEl || !toEl) continue;

      const r1 = fromEl.getBoundingClientRect();
      const r2 = toEl.getBoundingClientRect();

      const x1 = r1.left - contRect.left + r1.width / 2;
      const y1 = r1.top - contRect.top + r1.height / 2;
      const x2 = r2.left - contRect.left + r2.width / 2;
      const y2 = r2.top - contRect.top + r2.height / 2;

      let d = "";
      if (cable.id === "cable-5") {
        // Long arch spanning across column A to column C
        const midY = Math.max(y1, y2) + 35;
        d = `M ${x1} ${y1} C ${x1 + 80} ${midY}, ${x2 - 80} ${midY}, ${x2} ${y2}`;
      } else if (x2 < x1) {
        // Reverse curve (C to B or B to A)
        const curveOffset = 45;
        d = `M ${x1} ${y1} C ${x1 - curveOffset} ${y1 + 25}, ${x2 + curveOffset} ${y2 - 25}, ${x2} ${y2}`;
      } else {
        // Forward curve (A to B or B to C)
        const dx = Math.max(35, Math.abs(x2 - x1) * 0.5);
        d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      }

      result.push({
        id: cable.id,
        d,
        color: cable.color,
        colorLight: cable.colorLight,
        strokeGrad: cable.strokeGrad,
        labelKm: cable.labelKm,
        labelEn: cable.labelEn,
        subKm: cable.subKm,
        subEn: cable.subEn,
        biDirectional: cable.biDirectional,
      });
    }

    setPaths(result);
  }, []);

  React.useEffect(() => {
    recalculatePaths();
    const handleResize = () => recalculatePaths();
    window.addEventListener("resize", handleResize);

    const timer1 = setTimeout(recalculatePaths, 150);
    const timer2 = setTimeout(recalculatePaths, 600);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      observer = new ResizeObserver(() => recalculatePaths());
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer1);
      clearTimeout(timer2);
      observer?.disconnect();
    };
  }, [recalculatePaths]);

  return (
    <div className="my-8 space-y-8">
      {/* Main 3-Department Workflow Card */}
      <div className={`overflow-hidden rounded-2xl border p-5 shadow-xl backdrop-blur-sm sm:p-8 transition-colors ${isDark ? "border-cyan-500/30 bg-[#070913]" : "border-slate-200 bg-white text-slate-800 shadow-lg"}`}>
        <div className={`mb-6 flex flex-col gap-2 border-b ${isDark ? "border-white/10" : "border-slate-200"} pb-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`flex h-2.5 w-2.5 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-500"} animate-pulse`} />
              <h4 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"} sm:text-xl font-sans tracking-wide`}>
                Company Services Workflow (លំហូរការងាររវាង ៣ ផ្នែក)
              </h4>
            </div>
            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-600"} sm:text-sm`}>
              {isKhmer
                ? "គំនូសបំព្រួញលំហូរផ្លូវការរវាង ផ្នែកបច្ចេកទេស (A) ↔ ផ្នែកស្តុក (B) ↔ ផ្នែកលក់ (C) ជាមួយខ្សែ Laser Network ភ្ជាប់ផ្ទាល់ (Aura Soft UI)"
                : "Cross-departmental service workflow connected with live Aura Soft UI laser network lines: Technical (A) <-> Stock (B) <-> Sales (C)"}
            </p>
          </div>
          <span className={`self-start rounded-full border ${isDark ? "border-emerald-500/30" : "border-emerald-200"} bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
            Aura Soft UI Network
          </span>
        </div>

        {/* ════ LIVE ANIMATED INTER-DEPARTMENT NETWORK HIGHWAY ════ */}
        <div className={`mb-8 rounded-2xl border ${isDark ? "border-white/10" : "border-slate-200"} bg-gradient-to-r ${isDark ? "from-[#0d1424] via-[#09101f] to-[#0d1424]" : "from-slate-100 via-white to-slate-100"} p-4 sm:p-5 relative overflow-hidden shadow-inner`}>
          {/* Ambient Background Grid Glow */}
          <div className={`pointer-events-none absolute inset-0 ${isDark ? "opacity-20" : "opacity-10"} bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500 via-violet-500 to-transparent`} />

          <div className={`flex items-center justify-between border-b ${isDark ? "border-white/10" : "border-slate-200"} pb-3 mb-4`}>
            <div className="flex items-center gap-2">
              <Activity className={`h-4 w-4 ${isDark ? "text-emerald-400" : "text-emerald-700"} animate-pulse`} />
              <span className={`text-xs sm:text-sm font-bold ${isDark ? "text-white" : "text-slate-900"} uppercase tracking-wider`}>
                {isKhmer ? "បណ្តាញបញ្ជូនទិន្នន័យ Laser Network ឆ្លងកាត់ផ្នែកទាំង ៣" : "Live Inter-Department Laser Transfers"}
              </span>
            </div>
            <span className={`flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-500"} animate-ping`} />
              Real-Time Laser Beam
            </span>
          </div>

          {/* 5 Interactive Step Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {CABLES_CONFIG.map((cable) => {
              const isActive = activeCable === cable.id;
              return (
                <div
                  key={cable.id}
                  onMouseEnter={() => setActiveCable(cable.id)}
                  onMouseLeave={() => setActiveCable(null)}
                  onClick={() => setActiveCable(isActive ? null : cable.id)}
                  className={`rounded-xl border p-3 relative cursor-pointer transition-all ${
                    isActive
                      ? isDark
                        ? "border-white bg-white/[0.08] shadow-[0_0_25px_rgba(6,182,212,0.3)] scale-[1.02]"
                        : "border-slate-400 bg-slate-100 shadow-[0_0_25px_rgba(6,182,212,0.25)] scale-[1.02]"
                      : isDark
                      ? "border-white/10 bg-black/40 hover:border-white/30"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1" style={{ color: isDark ? cable.color : cable.colorLight }}>
                    <span>{isKhmer ? cable.subKm : cable.subEn}</span>
                    <Zap className={`h-3.5 w-3.5 ${isActive ? "animate-spin" : "animate-bounce"}`} />
                  </div>
                  <div className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"} leading-snug`}>{isKhmer ? cable.labelKm : cable.labelEn}</div>
                  <div className={`mt-2 h-1.5 w-full ${isDark ? "bg-slate-800" : "bg-slate-200"} rounded-full overflow-hidden`}>
                    <div
                      className="h-full rounded-full w-full animate-pulse"
                      style={{
                        background: isDark
                          ? `linear-gradient(90deg, ${cable.color}, #ffffff, ${cable.color})`
                          : `linear-gradient(90deg, ${cable.colorLight}, ${cable.color}, ${cable.colorLight})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ════ 3 DEPARTMENT COLUMNS WITH REAL SVG LASER NETWORK OVERLAY ════ */}
        <div ref={containerRef} className="relative">
          {/* SVG LASER NETWORK CABLES OVERLAY */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full z-20 overflow-visible">
            <defs>
              <filter id="aura-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <linearGradient id="grad-a-to-b" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={isDark ? "#06b6d4" : "#0e7490"} />
                <stop offset="100%" stopColor={isDark ? "#f59e0b" : "#b45309"} />
              </linearGradient>
              <linearGradient id="grad-b-to-c" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={isDark ? "#f59e0b" : "#b45309"} />
                <stop offset="100%" stopColor={isDark ? "#06b6d4" : "#0e7490"} />
              </linearGradient>
              <linearGradient id="grad-c-to-b" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={isDark ? "#06b6d4" : "#0e7490"} />
                <stop offset="100%" stopColor={isDark ? "#10b981" : "#047857"} />
              </linearGradient>
              <linearGradient id="grad-b-to-a" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={isDark ? "#10b981" : "#047857"} />
                <stop offset="100%" stopColor={isDark ? "#8b5cf6" : "#6d28d9"} />
              </linearGradient>
              <linearGradient id="grad-a-to-c-rose" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={isDark ? "#f43f5e" : "#be123c"} />
                <stop offset="50%" stopColor={isDark ? "#fb7185" : "#e11d48"} />
                <stop offset="100%" stopColor={isDark ? "#f43f5e" : "#be123c"} />
              </linearGradient>
            </defs>

            {paths.map((p) => {
              const isHovered = activeCable === p.id;
              const isDimmed = activeCable !== null && !isHovered;

              return (
                <g key={p.id} className="transition-opacity duration-300" opacity={isDimmed ? 0.2 : 1}>
                  {/* Broad Neon Glow Aura */}
                  <path
                    d={p.d}
                    fill="none"
                    stroke={isDark ? p.color : p.colorLight}
                    strokeWidth={isHovered ? 10 : 6}
                    strokeOpacity={isHovered ? 0.6 : 0.3}
                    filter="url(#aura-glow)"
                  />

                  {/* High-Tech Dashed Pipeline */}
                  <path
                    d={p.d}
                    fill="none"
                    stroke={`url(#${p.strokeGrad})`}
                    strokeWidth={isHovered ? 3.5 : 2.5}
                    strokeDasharray="6, 6"
                    strokeOpacity="0.8"
                  />

                  {/* Traveling Laser Light Stream */}
                  <path
                    d={p.d}
                    fill="none"
                    stroke={isDark ? "#ffffff" : "#0f172a"}
                    strokeWidth={isHovered ? 4.5 : 3}
                    strokeDasharray="28, 180"
                    strokeLinecap="round"
                    filter="url(#aura-glow)"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="208"
                      to="0"
                      dur={isHovered ? "1.5s" : "2.4s"}
                      repeatCount="indefinite"
                    />
                  </path>

                  {/* Traveling Glowing Photon Core */}
                  <circle r="4" fill={isDark ? "#ffffff" : "#0f172a"} filter="url(#aura-glow)">
                    <animateMotion path={p.d} dur={isHovered ? "1.5s" : "2.4s"} repeatCount="indefinite" />
                  </circle>
                  <circle r="8" fill={isDark ? p.color : p.colorLight} fillOpacity="0.5" filter="url(#aura-glow)">
                    <animateMotion path={p.d} dur={isHovered ? "1.5s" : "2.4s"} repeatCount="indefinite" />
                  </circle>

                  {/* If Bi-directional, add reverse traveling photon pulse */}
                  {p.biDirectional && (
                    <>
                      <circle r="4" fill={isDark ? "#ffffff" : "#0f172a"} filter="url(#aura-glow)">
                        <animateMotion path={p.d} dur={isHovered ? "1.5s" : "2.4s"} repeatCount="indefinite" keyTimes="0;1" keyPoints="1;0" />
                      </circle>
                      <circle r="8" fill={isDark ? "#fb7185" : "#be123c"} fillOpacity="0.5" filter="url(#aura-glow)">
                        <animateMotion path={p.d} dur={isHovered ? "1.5s" : "2.4s"} repeatCount="indefinite" keyTimes="0;1" keyPoints="1;0" />
                      </circle>
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* 3 Department Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
            {/* ════ COLUMN A: ផ្នែកបច្ចេកទេស (Technical Department) ════ */}
            <div className={`flex flex-col rounded-xl border p-4 relative shadow-xl backdrop-blur-sm transition-colors ${isDark ? "border-emerald-500/30 bg-emerald-950/10" : "border-emerald-200 bg-emerald-50/50"}`}>
              <div className={`flex items-center gap-2 border-b ${isDark ? "border-emerald-500/20" : "border-emerald-200"} pb-3 mb-4`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"} text-xs`}>
                  A
                </span>
                <span className={`font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"} text-sm flex items-center gap-1.5`}>
                  <Wrench className="h-4 w-4" /> ផ្នែកបច្ចេកទេស (Technical)
                </span>
              </div>

              <div className="flex flex-col space-y-3 text-xs">
                {/* 1. ម៉ាស៊ីនចូលថ្មី (ចុះបញ្ជីក្នុង Received Inventory) */}
                <Link
                  href="/received-inventory"
                  className={`rounded-lg ${isDark ? "border border-emerald-500/40 bg-emerald-950/30 text-white" : "border border-emerald-300 bg-white text-slate-900 shadow-sm hover:shadow-md"} p-2.5 transition-colors ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"} block hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} mr-1`}>1.</span>
                      <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>ម៉ាស៊ីនចូលថ្មី (/received-inventory)</span>
                    </div>
                    <ExternalLink className={`h-3 w-3 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} />
                  </div>
                  <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"} mt-0.5`}>ចុះបញ្ជីម៉ូដែល & Serial ថ្មីក្នុង Inventory</div>
                </Link>

                <div className="flex justify-center"><ArrowDown className={`h-3.5 w-3.5 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} /></div>

                {/* 2. ម៉ាស៊ីនចូល (Receive Item) */}
                <Link
                  href="/receive-item"
                  className={`rounded-lg ${isDark ? "border border-emerald-500/40 bg-emerald-950/30 text-white" : "border border-emerald-300 bg-white text-slate-900 shadow-sm hover:shadow-md"} p-2.5 transition-colors ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"} hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} mr-1`}>2.</span>
                      <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>ម៉ាស៊ីនចូល (/receive-item)</span>
                    </div>
                    <ExternalLink className={`h-3 w-3 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} />
                  </div>
                  <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>បង្កើតសំបុត្រ ➔ Status ID: 1 (Item Recieved)</div>
                </Link>

                <div className="flex justify-center"><ArrowDown className={`h-3.5 w-3.5 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} /></div>

                {/* 3. កំពុងវិនិច្ឆ័យ (Inspecting) */}
                <div className={`rounded-lg ${isDark ? "border border-cyan-500/30 bg-black/40 text-white" : "border border-cyan-200 bg-white text-slate-900 shadow-sm"} p-2.5`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-[10px] font-bold ${isDark ? "text-cyan-400" : "text-cyan-700"} mr-1`}>3.</span>
                      <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>កំពុងវិនិច្ឆ័យ (Inspecting)</span>
                    </div>
                  </div>
                  <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>Status ID: 10 (Inspecting) ➔ បញ្ជូនទៅជាងធ្វើតេស្ត</div>
                </div>

                <div className="flex justify-center"><ArrowDown className={`h-3.5 w-3.5 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} /></div>

                {/* 4. វិនិច្ឆ័យរួចរាល់ (Inspection Done) with Aura Socket */}
                <div className="relative">
                  <Link
                    href="/inspect-item"
                    className={`rounded-lg ${isDark ? "border border-indigo-500/40 bg-indigo-950/30 text-white" : "border border-indigo-300 bg-white text-slate-900 shadow-sm hover:shadow-md"} p-2.5 transition-all ${isDark ? "hover:border-indigo-400" : "hover:border-indigo-500"} block hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-[10px] font-bold ${isDark ? "text-indigo-400" : "text-indigo-700"} mr-1`}>4.</span>
                        <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>វិនិច្ឆ័យរួចរាល់ (/inspect-item)</span>
                      </div>
                      <ExternalLink className={`h-3 w-3 ${isDark ? "text-indigo-400" : "text-indigo-700"}`} />
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>Status ID: 2 (Inspection)</div>
                  </Link>

                  {/* Aura Socket to Stock */}
                  <span
                    id="port-a4"
                    className={`absolute -right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 shadow-[0_0_14px_#06b6d4] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                    title="Output: ស្នើគ្រឿងបន្លាស់ ➔ ផ្នែកស្តុក (B)"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  </span>
                </div>

                {/* 5. Unrepairable Dual Trigger Box in Technical (A) */}
                <div className="relative my-1">
                  <div className={`rounded-lg ${isDark ? "border border-rose-500/40 bg-rose-950/30 text-rose-300" : "border border-rose-300 bg-rose-50/90 text-rose-900 shadow-sm"} p-2`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>ខូចជួសជុលមិនកើត (Status: 8)</span>
                      <AlertCircle className={`h-3.5 w-3.5 ${isDark ? "text-rose-400" : "text-rose-700"}`} />
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"} mt-0.5`}>ជាងពិនិត្យឃើញខូចធ្ងន់ធ្ងរ ➔ ចុចបញ្ជូនដំណឹងទៅផ្នែកលក់</div>
                  </div>

                  {/* Aura Socket to/from Sales */}
                  <span
                    id="port-a-unrepair"
                    className={`absolute -right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 shadow-[0_0_14px_#f43f5e] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                    title="Dual Trigger Unrepairable (Status 8): អាចចុចបានទាំងបច្ចេកទេស និងផ្នែកលក់"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  </span>
                </div>

                <div className={`pt-4 border-t ${isDark ? "border-emerald-500/20" : "border-emerald-200"} my-2`}>
                  <div className={`text-[10px] font-bold ${isDark ? "text-slate-400" : "text-slate-600"} uppercase mb-2`}>ដំណាក់កាលជួសជុល & QA ផ្ទៀងផ្ទាត់</div>

                  {/* ជួសជុល with Aura Socket */}
                  <div className="relative">
                    {/* Aura Socket from Stock */}
                    <span
                      id="port-a-repair"
                      className={`absolute -right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 shadow-[0_0_14px_#8b5cf6] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                      title="Input: ទទួលគ្រឿងបន្លាស់ពីស្តុក (B)"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    </span>

                    <Link
                      href="/pending-repairs"
                      className={`rounded-lg border ${isDark ? "border-violet-500/40 bg-violet-950/30" : "border-violet-300 bg-violet-50"} p-2.5 transition-all ${isDark ? "hover:border-violet-400" : "hover:border-violet-500"} block mb-1.5 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)]`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>ជួសជុល (/pending-repairs)</span>
                        <ExternalLink className={`h-3 w-3 ${isDark ? "text-violet-400" : "text-violet-700"}`} />
                      </div>
                      <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>Status ID: 5 ➔ ជាងចុច &apos;Approved Repair&apos;</div>
                    </Link>
                  </div>

                  <div className="flex justify-center"><ArrowDown className={`h-3 w-3 ${isDark ? "text-emerald-400" : "text-emerald-700"} my-0.5`} /></div>

                  {/* Manager Technical QA */}
                  <Link
                    href="/approve-verify"
                    className={`rounded-lg ${isDark ? "border border-indigo-500/40 bg-indigo-950/30 text-white" : "border border-indigo-300 bg-white text-slate-900 shadow-sm hover:shadow-md"} p-2.5 transition-colors ${isDark ? "hover:border-indigo-400" : "hover:border-indigo-500"} block mb-1.5 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>QA ផ្ទៀងផ្ទាត់ (/approve-verify)</span>
                      <ExternalLink className={`h-3 w-3 ${isDark ? "text-indigo-400" : "text-indigo-700"}`} />
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-indigo-300" : "text-indigo-700"} mt-0.5`}>Manager Technical ធ្វើតេស្ត & ចុះហត្ថលេខា</div>
                  </Link>

                  <div className="flex justify-center"><ArrowDown className={`h-3 w-3 ${isDark ? "text-emerald-400" : "text-emerald-700"} my-0.5`} /></div>

                  {/* Finished Page */}
                  <Link
                    href="/completed-repairs"
                    className={`rounded-lg border ${isDark ? "border-emerald-500/60 bg-emerald-950/50" : "border-emerald-400 bg-emerald-50"} p-2.5 transition-colors ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"} block hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Finished Page (/completed-repairs)</span>
                      <CheckCircle2 className={`h-3.5 w-3.5 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} />
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"} mt-0.5`}>Status ID: 6 (Finished) ➔ ទាក់ទងអតិថិជនមកទទួល</div>
                  </Link>
                </div>
              </div>
            </div>

            {/* ════ COLUMN B: ផ្នែកស្តុក (Stock Department) ════ */}
            <div className={`flex flex-col rounded-xl border p-4 relative shadow-xl backdrop-blur-sm transition-colors ${isDark ? "border-amber-500/30 bg-amber-950/10" : "border-amber-200 bg-amber-50/50"}`}>
              <div className={`flex items-center gap-2 border-b ${isDark ? "border-amber-500/20" : "border-amber-200"} pb-3 mb-4`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 font-bold ${isDark ? "text-amber-300" : "text-amber-700"} text-xs`}>
                  B
                </span>
                <span className={`font-bold ${isDark ? "text-amber-300" : "text-amber-700"} text-sm flex items-center gap-1.5`}>
                  <Package className="h-4 w-4" /> ផ្នែកស្តុក (Stock / Inventory)
                </span>
              </div>

              <div className="flex flex-col space-y-3 text-xs">
                {/* 5. ឆែកគ្រឿងបន្លាស់ with Aura Socket */}
                <div className="relative">
                  {/* Aura Socket from Technical */}
                  <span
                    id="port-b5"
                    className={`absolute -left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 shadow-[0_0_14px_#f59e0b] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                    title="Input: ទទួលសំណើគ្រឿងពីបច្ចេកទេស (A)"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  </span>

                  <Link
                    href="/spare-request"
                    className={`rounded-lg ${isDark ? "border border-amber-500/40 bg-amber-950/30 text-white" : "border border-amber-300 bg-white text-slate-900 shadow-sm hover:shadow-md"} p-2.5 transition-all ${isDark ? "hover:border-amber-400" : "hover:border-amber-500"} block hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-[10px] font-bold ${isDark ? "text-amber-400" : "text-amber-700"} mr-1`}>5.</span>
                        <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>ឆែកគ្រឿងបន្លាស់ (Parts Check)</span>
                      </div>
                      <ExternalLink className={`h-3 w-3 ${isDark ? "text-amber-400" : "text-amber-700"}`} />
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>Status ID: 4 (Awaiting Sparepart)</div>
                  </Link>
                </div>

                <div className="flex justify-center"><ArrowDown className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"}`} /></div>

                {/* 6. ស្ថានភាពស្តុកទាំង ៤ ជម្រើស with Aura Socket */}
                <div className="relative">
                  <div className={`rounded-xl border ${isDark ? "border-amber-500/20 bg-black/40" : "border-amber-200 bg-slate-50"} p-3`}>
                    <div className={`text-[10px] font-bold ${isDark ? "text-amber-300" : "text-amber-700"} uppercase mb-2`}>
                      6. ស្ថានភាពស្តុក (៤ ជម្រើស)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className={`rounded border ${isDark ? "border-emerald-500/30" : "border-emerald-200"} bg-emerald-500/10 p-1.5 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-semibold text-center`}>
                        6.1 មានស្តុក
                      </div>
                      <div className={`rounded border ${isDark ? "border-cyan-500/30" : "border-cyan-200"} bg-cyan-500/10 p-1.5 ${isDark ? "text-cyan-300" : "text-cyan-700"} font-semibold text-center`}>
                        6.2 ដោះពីម៉ាស៊ីន
                      </div>
                      <div className={`rounded border ${isDark ? "border-indigo-500/30" : "border-indigo-200"} bg-indigo-500/10 p-1.5 ${isDark ? "text-indigo-300" : "text-indigo-700"} font-semibold text-center`}>
                        6.3 ស្តុកក្នុងស្រុក
                      </div>
                      <div className={`rounded border ${isDark ? "border-rose-500/30" : "border-rose-200"} bg-rose-500/10 p-1.5 ${isDark ? "text-rose-300" : "text-rose-700"} font-semibold text-center`}>
                        6.4 រង់ចាំ ៦-៨ សប្តាហ៍
                      </div>
                    </div>
                  </div>

                  {/* Aura Socket to Sales */}
                  <span
                    id="port-b6"
                    className={`absolute -right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 shadow-[0_0_14px_#f59e0b] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                    title="Output: ផ្ញើតម្លៃ & ETA ➔ ផ្នែកលក់ (C)"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  </span>
                </div>

                <div className={`pt-4 border-t ${isDark ? "border-amber-500/20" : "border-amber-200"} my-2`}>
                  {/* 12. បញ្ជូនគ្រឿងបន្លាស់ with 2 Sockets */}
                  <div className="relative">
                    {/* Aura Socket from Sales */}
                    <span
                      id="port-b12-in"
                      className={`absolute -right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_14px_#10b981] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                      title="Input: ទទួល Sale Confirmed ពីផ្នែកលក់ (C)"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    </span>

                    <Link
                      href="/spare-request"
                      className={`rounded-lg border ${isDark ? "border-emerald-500/50 bg-emerald-950/30" : "border-emerald-400 bg-emerald-50"} p-3 transition-all ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"} block hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} mr-1`}>12.</span>
                          <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>បញ្ជូនគ្រឿងបន្លាស់ (Sent Spareparts)</span>
                        </div>
                        <ExternalLink className={`h-3 w-3 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} />
                      </div>
                      <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"} mt-1`}>Status ID: 12 (Sent Spareparts)</div>
                    </Link>

                    {/* Aura Socket to Tech Repair */}
                    <span
                      id="port-b12-out"
                      className={`absolute -left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 shadow-[0_0_14px_#8b5cf6] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                      title="Output: ប្រគល់គ្រឿងជូនជាង ➔ ផ្នែកបច្ចេកទេស (A)"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ════ COLUMN C: ផ្នែកលក់ (Sales Department) ════ */}
            <div className={`flex flex-col rounded-xl border p-4 relative shadow-xl backdrop-blur-sm transition-colors ${isDark ? "border-cyan-500/30 bg-cyan-950/10" : "border-cyan-200 bg-cyan-50/50"}`}>
              <div className={`flex items-center gap-2 border-b ${isDark ? "border-cyan-500/20" : "border-cyan-200"} pb-3 mb-4`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 font-bold ${isDark ? "text-cyan-300" : "text-cyan-700"} text-xs`}>
                  C
                </span>
                <span className={`font-bold ${isDark ? "text-cyan-300" : "text-cyan-700"} text-sm flex items-center gap-1.5`}>
                  <TrendingUp className="h-4 w-4" /> ផ្នែកលក់ (Sales / Quotation)
                </span>
              </div>

              <div className="flex flex-col space-y-3 text-xs">
                {/* 7. ដាក់ Quote អោយអតិថិជន with Aura Socket */}
                <div className="relative">
                  {/* Aura Socket from Stock */}
                  <span
                    id="port-c7"
                    className={`absolute -left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 shadow-[0_0_14px_#06b6d4] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                    title="Input: ទទួលតម្លៃ & ETA ពីស្តុក (B)"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  </span>

                  <Link
                    href="/waiting-confirm"
                    className={`rounded-lg ${isDark ? "border border-cyan-500/40 bg-cyan-950/30 text-white" : "border border-cyan-300 bg-white text-slate-900 shadow-sm hover:shadow-md"} p-2.5 transition-all ${isDark ? "hover:border-cyan-400" : "hover:border-cyan-500"} block hover:shadow-[0_0_20px_rgba(6,182,212,0.25)]`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-[10px] font-bold ${isDark ? "text-cyan-400" : "text-cyan-700"} mr-1`}>7.</span>
                        <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>ដាក់ Quote អោយអតិថិជន</span>
                      </div>
                      <ExternalLink className={`h-3 w-3 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} />
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>Status ID: 3 (Awaiting Confirm)</div>
                  </Link>
                </div>

                <div className="flex justify-center"><ArrowDown className={`h-3.5 w-3.5 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} /></div>

                {/* 8. រង់ចាំយល់ព្រមពីភ្ញៀវ */}
                <div className={`rounded-lg ${isDark ? "border border-cyan-500/30 bg-black/40 text-white" : "border border-cyan-200 bg-white text-slate-900 shadow-sm"} p-2.5`}>
                  <span className={`text-[10px] font-bold ${isDark ? "text-cyan-400" : "text-cyan-700"} mr-1`}>8.</span>
                  <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>រង់ចាំយល់ព្រមពីភ្ញៀវ (Aging Days)</span>
                </div>

                <div className="flex justify-center"><ArrowDown className={`h-3.5 w-3.5 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} /></div>

                {/* 9, 9.1 & 9.2 Decision Outcomes */}
                <div className="space-y-2.5">
                  {/* 9. អាចជួសជុលបាន with Aura Socket */}
                  <div className="relative">
                    {/* Aura Socket to Stock */}
                    <span
                      id="port-c9"
                      className={`absolute -left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_14px_#10b981] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                      title="Output: Sale Confirmed ➔ ដកគ្រឿងនៅស្តុក (B)"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    </span>

                    <Link
                      href="/confirmed-sale"
                      className={`rounded-lg border ${isDark ? "border-emerald-500/50 bg-emerald-950/30" : "border-emerald-400 bg-emerald-50"} p-2.5 transition-all ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"} block hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} mr-1`}>9.</span>
                          <span className={`font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>អាចជួសជុលបាន (Sale Confirmed)</span>
                        </div>
                        <ExternalLink className={`h-3 w-3 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} />
                      </div>
                      <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"} mt-0.5`}>Status ID: 11 (Sale Confirmed)</div>
                    </Link>
                  </div>

                  {/* 9.1 អតិថិជនមិនជួសជុល (Customer Rejected) */}
                  <Link
                    href="/rejected"
                    className={`rounded-lg ${isDark ? "border border-rose-500/40 bg-rose-950/30 text-rose-300" : "border border-rose-300 bg-rose-50/90 text-rose-900 shadow-sm"} p-2.5 transition-all ${isDark ? "hover:border-rose-400" : "hover:border-rose-500"} block hover:shadow-[0_0_20px_rgba(244,63,94,0.25)]`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-[10px] font-bold ${isDark ? "text-rose-400" : "text-rose-700"} mr-1`}>9.1</span>
                        <span className={`font-bold ${isDark ? "text-rose-300" : "text-rose-700"}`}>អតិថិជនមិនជួសជុល (Customer Rejected)</span>
                      </div>
                      <ExternalLink className={`h-3 w-3 ${isDark ? "text-rose-400" : "text-rose-700"}`} />
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"} mt-0.5`}>Status ID: 7 ➔ ភ្ញៀវបដិសេធតម្លៃ (Hot Sales Lead)</div>
                  </Link>

                  {/* 9.2 ខូចជួសជុលលែងកើត (Unrepairable) with Bi-directional Aura Socket */}
                  <div className="relative">
                    {/* Aura Socket connected with Technical */}
                    <span
                      id="port-c-unrepair"
                      className={`absolute -left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 shadow-[0_0_14px_#f43f5e] border-2 ${isDark ? "border-[#070913]" : "border-white"} z-30`}
                      title="Dual Trigger Unrepairable (Status 8): អាចចុចបានទាំងផ្នែកលក់ និងបច្ចេកទេស"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    </span>

                    <Link
                      href="/unrepairable"
                      className={`rounded-lg border ${isDark ? "border-rose-500/50 bg-rose-950/40" : "border-rose-400 bg-rose-50"} p-2.5 transition-all ${isDark ? "hover:border-rose-400" : "hover:border-rose-500"} block hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-[10px] font-bold ${isDark ? "text-rose-400" : "text-rose-700"} mr-1`}>9.2</span>
                          <span className={`font-bold ${isDark ? "text-rose-200" : "text-rose-800"}`}>ខូចជួសជុលលែងកើត (Unrepairable)</span>
                        </div>
                        <ExternalLink className={`h-3 w-3 ${isDark ? "text-rose-400" : "text-rose-700"}`} />
                      </div>
                      <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"} mt-0.5`}>
                        Status ID: 8 (Unrepairable) ➔ <span className={`${isDark ? "text-amber-300" : "text-amber-700"} font-semibold`}>ចុចបាន ២ ផ្នែក (A ↔ C)</span>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════ SECTION: 4 INDIVIDUAL FLOW DIAGRAMS & SPAREPART RULES ════ */}
      <div className={`overflow-hidden rounded-2xl border p-5 shadow-xl backdrop-blur-sm sm:p-7 space-y-8 transition-colors ${isDark ? "border-white/10 bg-[#080a14]" : "border-slate-200 bg-white text-slate-800 shadow-lg"}`}>
        {/* Section Header */}
        <div className={`flex flex-col gap-2 border-b ${isDark ? "border-white/10" : "border-slate-200"} pb-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 border ${isDark ? "border-cyan-500/30 text-cyan-400" : "border-cyan-200 text-cyan-700"}`}>
              <Workflow className="h-4 w-4" />
            </span>
            <div>
              <h4 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"} sm:text-lg`}>
                គំនូសលំហូរការងារបំបែកតាម ៤ ករណីជាក់ស្តែង (Separate Workflows by Scenario)
              </h4>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>
                បង្ហាញលំហូរជំហានលម្អិតដាច់ដោយឡែកពីគ្នា ងាយស្រួលមើល និងយល់ច្បាស់ពីលក្ខខណ្ឌរំលងស្តុក/ផ្នែកលក់
              </p>
            </div>
          </div>
          <span className={`rounded border ${isDark ? "border-cyan-500/30" : "border-cyan-200"} bg-cyan-500/10 px-2.5 py-1 text-[11px] font-mono ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>
            4 Standalone Cases
          </span>
        </div>

        {/* ─── 1. SPAREPART CONDITION DEFINITIONS CARD ─── */}
        <div className={`rounded-xl ${isDark ? "border border-white/10 bg-black/40 text-white" : "border border-slate-200 bg-white text-slate-900 shadow-sm"} p-4 sm:p-5`}>
          <div className="flex items-center gap-2 mb-3">
            <Layers className={`h-4 w-4 ${isDark ? "text-amber-400" : "text-amber-700"}`} />
            <span className={`text-xs sm:text-sm font-bold ${isDark ? "text-white" : "text-slate-900"} uppercase tracking-wider`}>
              គោលការណ៍កំណត់ Sparepart Condition (Business Rules)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Fix Condition */}
            <div className={`rounded-xl border ${isDark ? "border-amber-500/40 bg-amber-950/20" : "border-amber-300 bg-amber-50"} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`${isDark ? "text-amber-300" : "text-amber-700"} font-bold text-sm flex items-center gap-1.5`}>
                  <Wrench className="h-4 w-4" /> Fix (ជួសជុល/កែច្នៃ)
                </span>
                <span className={`rounded bg-amber-500/20 border ${isDark ? "border-amber-500/40" : "border-amber-300"} px-2 py-0.5 text-[10px] font-bold ${isDark ? "text-amber-200" : "text-amber-800"}`}>
                  មិនកាត់ស្តុក (Non-Stock)
                </span>
              </div>
              <div className={`space-y-1 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                <p>
                  • ប្រើសម្រាប់មុខទំនិញដែលជាងកែសម្រួល ឬជួសជុលដោយមិនបាច់ដូរគ្រឿងថ្មី (Labor / Service Charge)។
                </p>
                <p className={`${isDark ? "text-amber-200" : "text-amber-800"} font-medium pt-1`}>
                  ⚡ <strong>ច្បាប់រត់សំបុត្រ៖</strong> បើសិនជ្រើសរើស <strong className={`${isDark ? "text-white" : "text-slate-900"}`}>Fix ទាំងអស់</strong> ➔ <strong className={`${isDark ? "text-amber-300" : "text-amber-700"}`}>មិនបញ្ជូនទៅស្តុកទេ (រំលងស្តុក)</strong> ដោយបញ្ជូនទៅផ្នែកលក់ Direct (បើ Charge) ឬរត់ទៅជួសជុល Direct (បើ Free)។
                </p>
              </div>
            </div>

            {/* Replace / Free Condition */}
            <div className={`rounded-xl border ${isDark ? "border-emerald-500/40 bg-emerald-950/20" : "border-emerald-300 bg-emerald-50"} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`${isDark ? "text-emerald-300" : "text-emerald-700"} font-bold text-sm flex items-center gap-1.5`}>
                  <Package className="h-4 w-4" /> Replace / Free (ប្តូរថ្មី/គ្រឿង Free)
                </span>
                <span className={`rounded bg-emerald-500/20 border ${isDark ? "border-emerald-500/40" : "border-emerald-300"} px-2 py-0.5 text-[10px] font-bold ${isDark ? "text-emerald-200" : "text-emerald-800"}`}>
                  កាត់ស្តុកជាក់ស្តែង
                </span>
              </div>
              <div className={`space-y-1 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                <p>
                  • ប្រើសម្រាប់មុខទំនិញដែលត្រូវដកគ្រឿងបន្លាស់ពិតប្រាកដចេញពី Inventory (Stock Item Deduction)។
                </p>
                <p className={`${isDark ? "text-emerald-200" : "text-emerald-800"} font-medium pt-1`}>
                  ⚡ <strong>ច្បាប់រត់សំបុត្រ៖</strong> បើសិនមានជ្រើសរើស <strong className={`${isDark ? "text-white" : "text-slate-900"}`}>Replace ឬ Free</strong> យ៉ាងហោចណាស់ ១ មុខ ➔ <strong className={`${isDark ? "text-emerald-300" : "text-emerald-700"}`}>ត្រូវតែបញ្ជូនទៅផ្នែកស្តុកជាមុន</strong> ដើម្បីឆែកស្តុក និងដកចេញគ្រឿងបន្លាស់។
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 2. THE 4 DEDICATED INDIVIDUAL FLOW DIAGRAMS ─── */}
        <div className="space-y-6">
          {/* ════ FLOW 1: Charge + មាន Sparepart ════ */}
          <div className={`rounded-2xl border p-4 sm:p-6 shadow-xl transition-colors ${isDark ? "border-sky-500/40 bg-gradient-to-br from-[#0c1629] to-[#070b16]" : "border-sky-300 bg-sky-50/50"}`}>
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between border-b ${isDark ? "border-sky-500/20" : "border-sky-200"} pb-3 mb-4 gap-2`}>
              <div className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 ${isDark ? "text-sky-400" : "text-sky-700"} font-bold text-sm`}>
                  1
                </span>
                <div>
                  <h5 className={`text-sm sm:text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    ករណីទី ១៖ Charge + មាន Sparepart (Replace ឬ Free ក្នុងចំណោមមួយ)
                  </h5>
                  <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    សេវាគិតប្រាក់ និងមានដូរគ្រឿងបន្លាស់ ➔ រត់ពេញលេញគ្រប់ ៣ ផ្នែក (A ➔ B ➔ C ➔ B ➔ A)
                  </span>
                </div>
              </div>
              <span className={`self-start rounded-full border ${isDark ? "border-sky-500/40" : "border-sky-300"} bg-sky-500/10 px-3 py-1 text-[11px] font-bold ${isDark ? "text-sky-300" : "text-sky-700"}`}>
                Full 3-Department Cycle
              </span>
            </div>

            {/* Step-by-Step Flow Pipeline */}
            <div className="flex flex-wrap items-center gap-2 py-2 text-xs">
              {/* Step 1: Technical Inspect */}
              <div className={`rounded-xl border ${isDark ? "border-emerald-500/40 bg-emerald-950/40" : "border-emerald-300 bg-emerald-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} uppercase`}>1. បច្ចេកទេស (A)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>វិនិច្ឆ័យរួចរាល់</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/inspect-item (Status: 2)</div>
              </div>

              <span className={`${isDark ? "text-sky-400" : "text-sky-700"} font-bold text-lg`}>➔</span>

              {/* Step 2: Stock Check */}
              <div className={`rounded-xl border ${isDark ? "border-amber-500/40 bg-amber-950/40" : "border-amber-300 bg-amber-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-amber-400" : "text-amber-700"} uppercase`}>2. ផ្នែកស្តុក (B)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>ឆែកគ្រឿង & ស្ថានភាព</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/spare-request (Status: 4)</div>
              </div>

              <span className={`${isDark ? "text-sky-400" : "text-sky-700"} font-bold text-lg`}>➔</span>

              {/* Step 3: Sales Quote */}
              <div className={`rounded-xl border ${isDark ? "border-cyan-500/40 bg-cyan-950/40" : "border-cyan-300 bg-cyan-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-cyan-400" : "text-cyan-700"} uppercase`}>3. ផ្នែកលក់ (C)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>ដាក់ Quote អោយភ្ញៀវ</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/waiting-confirm (Status: 3)</div>
              </div>

              <span className={`${isDark ? "text-sky-400" : "text-sky-700"} font-bold text-lg`}>➔</span>

              {/* Step 4: Sale Confirmed */}
              <div className={`rounded-xl border ${isDark ? "border-emerald-500/40 bg-emerald-950/40" : "border-emerald-300 bg-emerald-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} uppercase`}>4. ផ្នែកលក់ (C)</div>
                <div className={`font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"} mt-0.5`}>Sale Confirmed</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/confirmed-sale (Status: 11)</div>
              </div>

              <span className={`${isDark ? "text-sky-400" : "text-sky-700"} font-bold text-lg`}>➔</span>

              {/* Step 5: Stock Issue */}
              <div className={`rounded-xl border ${isDark ? "border-amber-500/40 bg-amber-950/40" : "border-amber-300 bg-amber-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-amber-400" : "text-amber-700"} uppercase`}>5. ផ្នែកស្តុក (B)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>បញ្ជូនគ្រឿងបន្លាស់</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>Status ID: 12 (Sent Parts)</div>
              </div>

              <span className={`${isDark ? "text-sky-400" : "text-sky-700"} font-bold text-lg`}>➔</span>

              {/* Step 6: Tech Repair & QA */}
              <div className={`rounded-xl border ${isDark ? "border-violet-500/40 bg-violet-950/40" : "border-violet-300 bg-violet-50"} p-3 min-w-[170px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-violet-400" : "text-violet-700"} uppercase`}>6. បច្ចេកទេស (A)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>អនុម័តជួសជុល & QA</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/pending-repairs ➔ Finished</div>
              </div>
            </div>
          </div>

          {/* ════ FLOW 2: Charge + គ្មាន Sparepart (Fix ទាំងអស់) ════ */}
          <div className={`rounded-2xl border ${isDark ? "border-amber-500/40" : "border-amber-300"} bg-gradient-to-br ${isDark ? "from-[#1a140a] to-[#0d0905]" : "from-amber-50 to-white"} p-4 sm:p-6 shadow-xl`}>
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between border-b ${isDark ? "border-amber-500/20" : "border-amber-200"} pb-3 mb-4 gap-2`}>
              <div className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 ${isDark ? "text-amber-400" : "text-amber-700"} font-bold text-sm`}>
                  2
                </span>
                <div>
                  <h5 className={`text-sm sm:text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    ករណីទី ២៖ Charge + គ្មាន Sparepart (Service charge / Fix ទាំងអស់)
                  </h5>
                  <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    សេវាគិតប្រាក់ មិនដូរគ្រឿងបន្លាស់ ➔ <strong className={`${isDark ? "text-amber-300" : "text-amber-700"}`}>រំលងផ្នែកស្តុកទាំងស្រុង (Bypass Stock)</strong>
                  </span>
                </div>
              </div>
              <span className={`self-start rounded-full border ${isDark ? "border-amber-500/40" : "border-amber-300"} bg-amber-500/10 px-3 py-1 text-[11px] font-bold ${isDark ? "text-amber-300" : "text-amber-700"}`}>
                ⚡ Bypass Stock (រំលងស្តុក)
              </span>
            </div>

            {/* Step-by-Step Flow Pipeline */}
            <div className="flex flex-wrap items-center gap-2 py-2 text-xs">
              {/* Step 1: Technical Inspect */}
              <div className={`rounded-xl border ${isDark ? "border-emerald-500/40 bg-emerald-950/40" : "border-emerald-300 bg-emerald-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} uppercase`}>1. បច្ចេកទេស (A)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>វិនិច្ឆ័យ (Fix / Service)</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/inspect-item (Status: 2)</div>
              </div>

              {/* Bypass Stock Pill */}
              <div className={`flex items-center gap-1.5 rounded-lg border border-dashed ${isDark ? "border-amber-500/60" : "border-amber-400"} bg-amber-500/10 px-3 py-2 ${isDark ? "text-amber-300" : "text-amber-700"} font-bold text-xs`}>
                <Zap className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"} animate-pulse`} />
                <span>រំលងស្តុក (Bypass)</span>
                <span className={`${isDark ? "text-amber-400" : "text-amber-700"} text-base`}>➔</span>
              </div>

              {/* Step 2: Sales Quote */}
              <div className={`rounded-xl border ${isDark ? "border-cyan-500/40 bg-cyan-950/40" : "border-cyan-300 bg-cyan-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-cyan-400" : "text-cyan-700"} uppercase`}>2. ផ្នែកលក់ (C)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>ដាក់ Quote ថ្លៃសេវា</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/waiting-confirm (Status: 3)</div>
              </div>

              <span className={`${isDark ? "text-amber-400" : "text-amber-700"} font-bold text-lg`}>➔</span>

              {/* Step 3: Sale Confirmed */}
              <div className={`rounded-xl border ${isDark ? "border-emerald-500/40 bg-emerald-950/40" : "border-emerald-300 bg-emerald-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} uppercase`}>3. ផ្នែកលក់ (C)</div>
                <div className={`font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"} mt-0.5`}>Sale Confirmed</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/confirmed-sale (Status: 11)</div>
              </div>

              {/* Bypass Stock Pill */}
              <div className={`flex items-center gap-1.5 rounded-lg border border-dashed ${isDark ? "border-amber-500/60" : "border-amber-400"} bg-amber-500/10 px-3 py-2 ${isDark ? "text-amber-300" : "text-amber-700"} font-bold text-xs`}>
                <Zap className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"} animate-pulse`} />
                <span>រំលងស្តុក ➔ ជួសជុល</span>
                <span className={`${isDark ? "text-amber-400" : "text-amber-700"} text-base`}>➔</span>
              </div>

              {/* Step 4: Tech Repair & QA */}
              <div className={`rounded-xl border ${isDark ? "border-violet-500/40 bg-violet-950/40" : "border-violet-300 bg-violet-50"} p-3 min-w-[170px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-violet-400" : "text-violet-700"} uppercase`}>4. បច្ចេកទេស (A)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>អនុម័តជួសជុល & QA</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/pending-repairs ➔ Finished</div>
              </div>
            </div>
          </div>

          {/* ════ FLOW 3: Free + មាន Sparepart (Warranty Replace) ════ */}
          <div className={`rounded-2xl border ${isDark ? "border-emerald-500/40" : "border-emerald-300"} bg-gradient-to-br ${isDark ? "from-[#091a13] to-[#050e0a]" : "from-emerald-50 to-white"} p-4 sm:p-6 shadow-xl`}>
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between border-b ${isDark ? "border-emerald-500/20" : "border-emerald-200"} pb-3 mb-4 gap-2`}>
              <div className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 ${isDark ? "text-emerald-400" : "text-emerald-700"} font-bold text-sm`}>
                  3
                </span>
                <div>
                  <h5 className={`text-sm sm:text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    ករណីទី ៣៖ Free + មាន Sparepart (Warranty Parts Replace)
                  </h5>
                  <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    សេវាឥតគិតថ្លៃក្នុងធានា + ដូរគ្រឿងបន្លាស់ ➔ <strong className={`${isDark ? "text-emerald-300" : "text-emerald-700"}`}>កាត់ស្តុកគ្រឿង Free & រំលងផ្នែកលក់</strong>
                  </span>
                </div>
              </div>
              <span className={`self-start rounded-full border ${isDark ? "border-emerald-500/40" : "border-emerald-300"} bg-emerald-500/10 px-3 py-1 text-[11px] font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                ⚡ Bypass Sales (រំលងផ្នែកលក់)
              </span>
            </div>

            {/* Step-by-Step Flow Pipeline */}
            <div className="flex flex-wrap items-center gap-2 py-2 text-xs">
              {/* Step 1: Technical Inspect */}
              <div className={`rounded-xl border ${isDark ? "border-emerald-500/40 bg-emerald-950/40" : "border-emerald-300 bg-emerald-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} uppercase`}>1. បច្ចេកទេស (A)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>វិនិច្ឆ័យ (Free + Parts)</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/inspect-item (Status: 2)</div>
              </div>

              <span className={`${isDark ? "text-emerald-400" : "text-emerald-700"} font-bold text-lg`}>➔</span>

              {/* Step 2: Stock Parts Check */}
              <div className={`rounded-xl border ${isDark ? "border-amber-500/40 bg-amber-950/40" : "border-amber-300 bg-amber-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-amber-400" : "text-amber-700"} uppercase`}>2. ផ្នែកស្តុក (B)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>ឆែក & ដកគ្រឿង Free</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/spare-request (Status: 4)</div>
              </div>

              <span className={`${isDark ? "text-emerald-400" : "text-emerald-700"} font-bold text-lg`}>➔</span>

              {/* Step 3: Stock Issue */}
              <div className={`rounded-xl border ${isDark ? "border-amber-500/40 bg-amber-950/40" : "border-amber-300 bg-amber-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-amber-400" : "text-amber-700"} uppercase`}>3. ផ្នែកស្តុក (B)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>បញ្ជូនគ្រឿងបន្លាស់</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>Status ID: 12 (Sent Parts)</div>
              </div>

              {/* Bypass Sales Pill */}
              <div className={`flex items-center gap-1.5 rounded-lg border border-dashed ${isDark ? "border-emerald-500/60" : "border-emerald-400"} bg-emerald-500/10 px-3 py-2 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-bold text-xs`}>
                <Zap className={`h-3.5 w-3.5 ${isDark ? "text-emerald-400" : "text-emerald-700"} animate-pulse`} />
                <span>រំលងផ្នែកលក់ (មិនបាច់ Quote)</span>
                <span className={`${isDark ? "text-emerald-400" : "text-emerald-700"} text-base`}>➔</span>
              </div>

              {/* Step 4: Tech Repair & QA */}
              <div className={`rounded-xl border ${isDark ? "border-violet-500/40 bg-violet-950/40" : "border-violet-300 bg-violet-50"} p-3 min-w-[170px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-violet-400" : "text-violet-700"} uppercase`}>4. បច្ចេកទេស (A)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>អនុម័តជួសជុល & QA</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/pending-repairs ➔ Finished</div>
              </div>
            </div>
          </div>

          {/* ════ FLOW 4: Free + គ្មាន Sparepart (Direct Fast-Track) ════ */}
          <div className={`rounded-2xl border ${isDark ? "border-purple-500/40" : "border-purple-300"} bg-gradient-to-br ${isDark ? "from-[#160b24] to-[#0c0514]" : "from-purple-50 to-white"} p-4 sm:p-6 shadow-xl`}>
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between border-b ${isDark ? "border-purple-500/20" : "border-purple-200"} pb-3 mb-4 gap-2`}>
              <div className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 ${isDark ? "text-purple-400" : "text-purple-700"} font-bold text-sm`}>
                  4
                </span>
                <div>
                  <h5 className={`text-sm sm:text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    ករណីទី ៤៖ Free + គ្មាន Sparepart (Direct Internal Fast-Track)
                  </h5>
                  <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    សេវាឥតគិតថ្លៃ មិនដូរគ្រឿងបន្លាស់ (Fix/Software/សម្អាត) ➔ <strong className={`${isDark ? "text-purple-300" : "text-purple-700"}`}>រំលងទាំងស្តុក និងផ្នែកលក់ Direct</strong>
                  </span>
                </div>
              </div>
              <span className={`self-start rounded-full border ${isDark ? "border-purple-500/40" : "border-purple-300"} bg-purple-500/10 px-3 py-1 text-[11px] font-bold ${isDark ? "text-purple-300" : "text-purple-700"}`}>
                ⚡ Direct Fast-Track (រំលងទាំងពីរ)
              </span>
            </div>

            {/* Step-by-Step Flow Pipeline */}
            <div className="flex flex-wrap items-center gap-2 py-2 text-xs">
              {/* Step 1: Technical Inspect Done */}
              <div className={`rounded-xl border ${isDark ? "border-emerald-500/40 bg-emerald-950/40" : "border-emerald-300 bg-emerald-50"} p-3 min-w-[170px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} uppercase`}>1. បច្ចេកទេស (A)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>វិនិច្ឆ័យរួចរាល់ (Free/Fix)</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/inspect-item (Status: 2)</div>
              </div>

              {/* Direct Fast Track Bypass Pill */}
              <div className={`flex items-center gap-1.5 rounded-lg border border-dashed ${isDark ? "border-purple-500/60" : "border-purple-400"} bg-purple-500/10 px-3.5 py-2 ${isDark ? "text-purple-300" : "text-purple-700"} font-bold text-xs shadow-inner`}>
                <Zap className={`h-3.5 w-3.5 ${isDark ? "text-purple-400" : "text-purple-700"} animate-pulse`} />
                <span>រំលងទាំងស្តុក & ផ្នែកលក់ Direct</span>
                <span className={`${isDark ? "text-purple-400" : "text-purple-700"} text-base`}>➔</span>
              </div>

              {/* Step 2: Tech Repair */}
              <div className={`rounded-xl border ${isDark ? "border-violet-500/40 bg-violet-950/40" : "border-violet-300 bg-violet-50"} p-3 min-w-[170px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-violet-400" : "text-violet-700"} uppercase`}>2. ជាងបច្ចេកទេស (A)</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>អនុម័តជួសជុល</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/pending-repairs (Status: 5)</div>
              </div>

              <span className={`${isDark ? "text-purple-400" : "text-purple-700"} font-bold text-lg`}>➔</span>

              {/* Step 3: QA Verify */}
              <div className={`rounded-xl border ${isDark ? "border-indigo-500/40 bg-indigo-950/40" : "border-indigo-300 bg-indigo-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-indigo-400" : "text-indigo-700"} uppercase`}>3. QA ផ្ទៀងផ្ទាត់</div>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} mt-0.5`}>Manager Technical QA</div>
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>/approve-verify</div>
              </div>

              <span className={`${isDark ? "text-purple-400" : "text-purple-700"} font-bold text-lg`}>➔</span>

              {/* Step 4: Finished */}
              <div className={`rounded-xl border ${isDark ? "border-emerald-500/50 bg-emerald-950/50" : "border-emerald-400 bg-emerald-50"} p-3 min-w-[160px] shadow-sm`}>
                <div className={`text-[10px] font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"} uppercase`}>4. Finished Page</div>
                <div className={`font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"} mt-0.5`}>ប្រគល់ជូនអតិថិជន</div>
                <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>/completed-repairs (Status: 6)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database ServiceStatuses (12 Statuses) Matrix Table (Matching Image 2) */}
      <div className={`overflow-hidden rounded-2xl border p-5 shadow-xl backdrop-blur-sm sm:p-7 transition-colors ${isDark ? "border-white/10 bg-[#080a14]" : "border-slate-200 bg-white text-slate-800 shadow-lg"}`}>
        <div className={`mb-4 flex flex-col gap-2 border-b ${isDark ? "border-white/10" : "border-slate-200"} pb-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 border ${isDark ? "border-indigo-500/30 text-indigo-400" : "border-indigo-200 text-indigo-700"}`}>
              <Database className="h-4 w-4" />
            </span>
            <div>
              <h4 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"} sm:text-lg`}>
                តារាងស្ថានភាពសេវាកម្មក្នុង Database (SQL Server ServiceStatuses Table)
              </h4>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>
                ទិន្នន័យផ្លូវការ ១២ ស្ថានភាព (Status ID 1 ➔ 12) ដែលកំណត់គ្រប់សកម្មភាពនៃសំបុត្រជួសជុល
              </p>
            </div>
          </div>
          <span className={`rounded border ${isDark ? "border-indigo-500/30" : "border-indigo-200"} bg-indigo-500/10 px-2.5 py-1 text-[11px] font-mono ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>
            dbo.ServiceStatuses
          </span>
        </div>

        <div className={`overflow-x-auto rounded-xl border ${isDark ? "border-white/5" : "border-slate-200"}`}>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-slate-50"} text-[11px] font-bold ${isDark ? "text-slate-400" : "text-slate-600"} uppercase tracking-wider`}>
                <th className="py-2.5 px-3 w-16 text-center">Id (PK)</th>
                <th className="py-2.5 px-4 min-w-[200px]">Status Name (English)</th>
                <th className="py-2.5 px-4 min-w-[220px]">ឈ្មោះស្ថានភាព (ខ្មែរ)</th>
                <th className="py-2.5 px-4 min-w-[140px]">ផ្នែកទទួលបន្ទុក</th>
                <th className="py-2.5 px-3 text-center">ទំព័រ Route</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-white/5" : "divide-slate-200"} font-sans`}>
              {SERVICE_STATUSES_DB.map((st) => (
                <tr key={st.id} className={`${isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"} transition-colors`}>
                  <td className={`py-2.5 px-3 text-center font-mono font-bold ${isDark ? "text-violet-400 bg-black/20" : "text-violet-700 bg-slate-100"}`}>
                    {st.id}
                  </td>
                  <td className={`py-2.5 px-4 font-mono font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {st.nameEn}
                  </td>
                  <td className={`py-2.5 px-4 ${isDark ? "text-slate-300" : "text-slate-600"} font-medium`}>
                    {st.nameKm}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-block rounded border ${isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-100"} px-2 py-0.5 text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      {st.dept}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Link
                      href={st.route}
                      className={`inline-flex items-center gap-1 font-mono text-[11px] ${isDark ? "text-violet-400 hover:text-violet-300" : "text-violet-700 hover:text-violet-900"} hover:underline`}
                    >
                      <span>{st.route}</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface DocsInteractiveFlowProps {
  diagram: DocsDiagram;
  type?: "login" | "lifecycle" | "architecture" | "decision" | "general";
}

export default function DocsInteractiveFlow({
  diagram,
  type = "general",
}: DocsInteractiveFlowProps) {
  const { isKhmer } = useDocsText();
  const { isDark } = useDocsTheme();

  // ── 1. LOGIN PROCESS FLOWCHART ──
  if (type === "login" || diagram.nodes.some((n) => n.id.startsWith("lp"))) {
    return (
      <div className={`my-8 overflow-hidden rounded-2xl border p-5 shadow-xl backdrop-blur-sm sm:p-8 transition-colors ${isDark ? "border-violet-500/30 bg-[#070913]" : "border-slate-200 bg-white text-slate-800 shadow-lg"}`}>
        <div className={`mb-6 flex flex-col gap-2 border-b ${isDark ? "border-white/10" : "border-slate-200"} pb-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`flex h-2.5 w-2.5 rounded-full ${isDark ? "bg-violet-400" : "bg-violet-500"} animate-pulse`} />
              <h4 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"} sm:text-lg`}>
                {isKhmer ? "គំនូសបំព្រួញលំហូរដំណើរការ Login គ្រប់ជម្រើស" : "Complete Login Process Flowchart"}
              </h4>
            </div>
            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-600"} sm:text-sm`}>
              {isKhmer
                ? "ផ្ទៀងផ្ទាត់តាម Mobile 2FA (Face Login, Match Number, Scan QR) & ជម្រើសផ្សេងទៀត ➔ ចេញ JWT Token ➔ បែងចែកតាម Role"
                : "Multi-modal authentication: Mobile 2FA (Face/PIN, Match Number, Scan QR), Password, Local Face, Passkey -> JWT -> RBAC"}
            </p>
          </div>
          <span className={`self-start rounded-full border ${isDark ? "border-violet-500/30" : "border-violet-200"} bg-violet-500/10 px-3 py-1 text-[11px] font-semibold ${isDark ? "text-violet-300" : "text-violet-700"}`}>
            Auth Flowchart
          </span>
        </div>

        {/* Step 1: User Entry Point */}
        <div className="flex flex-col items-center">
          <Link
            href="/login"
            className={`w-full max-w-md rounded-xl border ${isDark ? "border-violet-500/40 bg-violet-950/40" : "border-violet-300 bg-violet-50"} p-3.5 text-center shadow-lg transition-all ${isDark ? "hover:border-violet-400 hover:bg-violet-900/40" : "hover:border-violet-500 hover:bg-violet-100"}`}
          >
            <div className={`text-[11px] font-bold ${isDark ? "text-violet-300" : "text-violet-700"} uppercase tracking-wider`}>
              {isKhmer ? "ច្រកចូលដំបូង (Entry Point)" : "Entry Point"}
            </div>
            <div className={`mt-1 font-bold ${isDark ? "text-white" : "text-slate-900"} text-sm sm:text-base flex items-center justify-center gap-2`}>
              <span>{isKhmer ? "អ្នកប្រើប្រាស់ចូលមកកាន់ទំព័រ /login" : "User navigates to /login"}</span>
              <ExternalLink className={`h-3.5 w-3.5 ${isDark ? "text-violet-400" : "text-violet-700"}`} />
            </div>
          </Link>

          <ArrowDown className={`my-3 h-5 w-5 ${isDark ? "text-violet-400" : "text-violet-700"} animate-bounce`} />

          {/* Section A: Primary Mobile 2FA (CAM ID App) */}
          <div className={`w-full rounded-2xl border ${isDark ? "border-cyan-500/30 bg-cyan-950/20" : "border-cyan-200 bg-cyan-50"} p-4 sm:p-5 mb-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? "border-cyan-500/20" : "border-cyan-200"} pb-3 mb-4`}>
              <div className="flex items-center gap-2">
                <Smartphone className={`h-5 w-5 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} />
                <div>
                  <div className={`text-xs sm:text-sm font-bold ${isDark ? "text-cyan-200" : "text-cyan-800"}`}>
                    {isKhmer ? "វិធីសាស្ត្រចម្បង៖ Mobile 2FA តាម App CAM ID (៣ របៀប)" : "Primary Method: Mobile 2FA via App CAM ID"}
                  </div>
                  <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {isKhmer ? "សុវត្ថិភាពខ្ពស់ ផ្ទៀងផ្ទាត់ជីវមាត្រផ្ទាល់ពីទូរស័ព្ទដៃដែលបានភ្ជាប់" : "High security biometric authentication on paired smartphone"}
                  </div>
                </div>
              </div>
              <span className={`rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-bold ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>
                Mobile 2FA
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Tab 1: Face Login / PIN */}
              <div className={`rounded-xl ${isDark ? "border border-cyan-500/30 bg-black/40 text-white" : "border border-cyan-200 bg-white text-slate-900 shadow-sm"} p-3.5 flex flex-col justify-between`}>
                <div>
                  <div className={`flex items-center gap-2 ${isDark ? "text-cyan-300" : "text-cyan-700"} font-bold text-xs mb-1.5`}>
                    <ScanFace className={`h-4 w-4 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} />
                    <span>{isKhmer ? "១. Face Login / PIN" : "1. Face Login / PIN"}</span>
                  </div>
                  <p className={`text-[11.5px] ${isDark ? "text-slate-300" : "text-slate-600"} leading-relaxed`}>
                    {isKhmer
                      ? "វាយ Username ➔ ចុចផ្ញើសំណើ ➔ App CAM ID លោត Push ➔ ស្កេន Face ឬវាយ PIN ៦ខ្ទង់ ➔ SignalR Auto Login"
                      : "Input Username -> Push notification to CAM ID App -> Scan Face or enter PIN -> SignalR Auto Login"}
                  </p>
                </div>
                <div className={`mt-2 text-[10px] ${isDark ? "text-cyan-400" : "text-cyan-700"} font-mono`}>Push Notification Challenge</div>
              </div>

              {/* Tab 2: Match Number */}
              <div className={`rounded-xl border ${isDark ? "border-amber-500/40 bg-black/40" : "border-amber-300 bg-slate-50"} p-3.5 flex flex-col justify-between`}>
                <div>
                  <div className={`flex items-center gap-2 ${isDark ? "text-amber-300" : "text-amber-700"} font-bold text-xs mb-1.5`}>
                    <Key className={`h-4 w-4 ${isDark ? "text-amber-400" : "text-amber-700"}`} />
                    <span>{isKhmer ? "២. Match Number (លេខផ្គូផ្គង)" : "2. Match Number"}</span>
                  </div>
                  <p className={`text-[11.5px] ${isDark ? "text-slate-300" : "text-slate-600"} leading-relaxed`}>
                    {isKhmer
                      ? "វាយ Username ➔ កុំព្យូទ័របង្ហាញលេខកូដ (ឧ. 42) ➔ User ចុចលេខដូចគ្នានៅលើទូរស័ព្ទ (ការពារ MFA Fatigue / Bombing)"
                      : "Computer shows Match Number -> User selects matching number on CAM ID App -> Anti-MFA bombing"}
                  </p>
                </div>
                <div className={`mt-2 text-[10px] ${isDark ? "text-amber-400" : "text-amber-700"} font-mono`}>Number Matching Security</div>
              </div>

              {/* Tab 3: Scan QR */}
              <div className={`rounded-xl border ${isDark ? "border-indigo-500/40 bg-black/40" : "border-indigo-300 bg-slate-50"} p-3.5 flex flex-col justify-between`}>
                <div>
                  <div className={`flex items-center gap-2 ${isDark ? "text-indigo-300" : "text-indigo-700"} font-bold text-xs mb-1.5`}>
                    <QrCode className={`h-4 w-4 ${isDark ? "text-indigo-400" : "text-indigo-700"}`} />
                    <span>{isKhmer ? "៣. ស្កេន QR (Scan QR)" : "3. Scan QR Code"}</span>
                  </div>
                  <p className={`text-[11.5px] ${isDark ? "text-slate-300" : "text-slate-600"} leading-relaxed`}>
                    {isKhmer
                      ? "កុំព្យូទ័របង្ហាញ Dynamic Session QR ➔ បើក App CAM ID ស្កេន QR លើអេក្រង់ ➔ SignalR WebSocket Auto Login"
                      : "Desktop renders Dynamic Session QR -> Scan via CAM ID App -> SignalR WebSocket Handshake"}
                  </p>
                </div>
                <div className={`mt-2 text-[10px] ${isDark ? "text-indigo-400" : "text-indigo-700"} font-mono`}>Dynamic QR Bridge (5 min)</div>
              </div>
            </div>
          </div>

          {/* Section B: Alternative Sign-In Methods */}
          <div className={`w-full rounded-2xl border ${isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-slate-50"} p-4 sm:p-5 mb-4`}>
            <div className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-600"} uppercase tracking-wider mb-3`}>
              {isKhmer ? "ជម្រើស Sign In ផ្សេងទៀត (Alternative Sign-In Methods)" : "Alternative Sign-In Methods"}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Method 1: Password */}
              <div className={`rounded-xl border ${isDark ? "border-violet-500/30" : "border-violet-200"} bg-violet-500/10 p-3.5`}>
                <div className={`flex items-center gap-2 ${isDark ? "text-violet-300" : "text-violet-700"} font-bold text-xs mb-1.5`}>
                  <Key className="h-4 w-4" />
                  <span>{isKhmer ? "Password Login" : "Password Login"}</span>
                </div>
                <p className={`text-[11.5px] ${isDark ? "text-slate-300" : "text-slate-600"} leading-relaxed`}>
                  {isKhmer
                    ? "បញ្ចូល Username & Password ➔ ផ្ទៀងផ្ទាត់ Hash ក្នុង UserManagement DB"
                    : "Enter Username & Password -> Validated by UserManagementAPI"}
                </p>
              </div>

              {/* Method 2: Local Face ID */}
              <div className={`rounded-xl border ${isDark ? "border-cyan-500/30" : "border-cyan-200"} bg-cyan-500/10 p-3.5`}>
                <div className={`flex items-center gap-2 ${isDark ? "text-cyan-300" : "text-cyan-700"} font-bold text-xs mb-1.5`}>
                  <ScanFace className="h-4 w-4" />
                  <span>{isKhmer ? "Local Face ID (Webcam)" : "Local Face ID (Webcam)"}</span>
                </div>
                <p className={`text-[11.5px] ${isDark ? "text-slate-300" : "text-slate-600"} leading-relaxed`}>
                  {isKhmer
                    ? "កាមេរ៉ាកុំព្យូទ័រចាប់មុខ ➔ គណនា 128D Vector ➔ ផ្គូផ្គងផ្ទៃមុខ >90% លើកុំព្យូទ័រ"
                    : "Desktop Webcam capture -> 128D Vector extraction -> >90% match"}
                </p>
              </div>

              {/* Method 3: Passkey */}
              <div className={`rounded-xl border ${isDark ? "border-sky-500/30" : "border-sky-200"} bg-sky-500/10 p-3.5`}>
                <div className={`flex items-center gap-2 ${isDark ? "text-sky-300" : "text-sky-700"} font-bold text-xs mb-1.5`}>
                  <Fingerprint className="h-4 w-4" />
                  <span>{isKhmer ? "WebAuthn Passkey" : "Passkey (FIDO2)"}</span>
                </div>
                <p className={`text-[11.5px] ${isDark ? "text-slate-300" : "text-slate-600"} leading-relaxed`}>
                  {isKhmer
                    ? "Windows Hello / Apple Touch ID / Security Key ➔ ផ្ទៀងផ្ទាត់ Public Key"
                    : "Touch ID / Windows Hello PIN -> Public Key Signature Assertion"}
                </p>
              </div>
            </div>
          </div>

          <ArrowDown className={`my-2 h-5 w-5 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} />

          {/* Step 3: JWT Token & Claims Issuance */}
          <div className={`w-full max-w-lg rounded-xl ${isDark ? "border border-emerald-500/40 bg-emerald-950/30 text-white" : "border border-emerald-300 bg-white text-slate-900 shadow-sm hover:shadow-md"} p-4 text-center shadow-lg`}>
            <div className={`flex items-center justify-center gap-2 ${isDark ? "text-emerald-400" : "text-emerald-700"} font-bold text-xs uppercase tracking-wider mb-1`}>
              <Shield className="h-4 w-4" />
              <span>{isKhmer ? "បង្កើត JWT Access & Refresh Tokens" : "Issue JWT & Refresh Tokens"}</span>
            </div>
            <p className={`text-xs ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              {isKhmer
                ? "UserManagementAPI ចេញ Cryptographic JWT + Refresh Token ភ្ជាប់ Claims & Roles"
                : "Issues secure signed JWT tokens with claims and permissions attached"}
            </p>
          </div>

          <ArrowDown className={`my-2 h-5 w-5 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} />

          {/* Step 4: RBAC Role-Based Workspace Routing */}
          <div className="w-full">
            <div className={`mb-2 text-center text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-600"} uppercase tracking-wider`}>
              {isKhmer ? "បែងចែកទៅកាន់ផ្ទាំងការងារតាមតួនាទី (RBAC Routing)" : "Role-Based Routing"}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className={`rounded-lg border ${isDark ? "border-purple-500/30" : "border-purple-200"} bg-purple-500/10 p-3 text-center`}>
                <div className={`font-bold ${isDark ? "text-purple-300" : "text-purple-700"} text-xs`}>Admin</div>
                <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>គ្រប់គ្រងប្រព័ន្ធទាំងអស់</div>
              </div>
              <div className={`rounded-lg border ${isDark ? "border-cyan-500/30" : "border-cyan-200"} bg-cyan-500/10 p-3 text-center`}>
                <div className={`font-bold ${isDark ? "text-cyan-300" : "text-cyan-700"} text-xs`}>Supervisor</div>
                <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>អនុម័ត QA & របាយការណ៍</div>
              </div>
              <div className={`rounded-lg border ${isDark ? "border-amber-500/30" : "border-amber-200"} bg-amber-500/10 p-3 text-center`}>
                <div className={`font-bold ${isDark ? "text-amber-300" : "text-amber-700"} text-xs`}>Technician</div>
                <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>ផ្ទាំងជួសជុលជាក់ស្តែង</div>
              </div>
              <div className={`rounded-lg border ${isDark ? "border-emerald-500/30" : "border-emerald-200"} bg-emerald-500/10 p-3 text-center`}>
                <div className={`font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"} text-xs`}>Front Desk</div>
                <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"} mt-0.5`}>ទំព័រទទួលម៉ាស៊ីន Intake</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. COMPANY SERVICES 3-DEPARTMENT SWIMLANE FLOWCHART (Matching User Image 1) ──
  if (type === "lifecycle" || diagram.nodes.some((n) => n.id === "s1" || n.id === "s4")) {
    return <AuraServicesSwimlane isKhmer={isKhmer} />;
  }

  // ── 3. THREE-TIER ARCHITECTURE FLOWCHART ──
  if (type === "architecture" || diagram.nodes.some((n) => n.id === "techApi")) {
    return (
      <div className={`my-8 overflow-hidden rounded-2xl border p-5 shadow-xl backdrop-blur-sm sm:p-8 transition-colors ${isDark ? "border-cyan-500/20 bg-[#070913]" : "border-slate-200 bg-white text-slate-800 shadow-lg"}`}>
        <div className={`mb-6 flex flex-col gap-2 border-b ${isDark ? "border-white/10" : "border-slate-200"} pb-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`flex h-2.5 w-2.5 rounded-full ${isDark ? "bg-cyan-400" : "bg-cyan-500"} animate-pulse`} />
              <h4 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"} sm:text-lg`}>
                {isKhmer ? "គំនូសបំព្រួញស្ថាបត្យកម្មប្រព័ន្ធ ៣ ជាន់ (Three-Tier Architecture)" : "Three-Tier Architecture"}
              </h4>
            </div>
            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-600"} sm:text-sm`}>
              {isKhmer
                ? "Frontend Next.js 16 ↔ API Proxy ↔ .NET 8 Microservices ↔ SQL Server Databases"
                : "Frontend Next.js 16 <-> Proxy Gateway <-> .NET 8 Microservices <-> SQL Server"}
            </p>
          </div>
          <span className={`self-start rounded-full border ${isDark ? "border-cyan-500/30" : "border-cyan-200"} bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>
            Microservices
          </span>
        </div>

        {/* 3-Tier Layered Stack */}
        <div className="space-y-4">
          {/* Layer 1: Client Tier */}
          <div className={`rounded-xl border ${isDark ? "border-violet-500/30 bg-violet-950/20" : "border-violet-200 bg-violet-50"} p-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? "border-violet-500/20" : "border-violet-200"} pb-2 mb-3`}>
              <div className={`flex items-center gap-2 font-bold ${isDark ? "text-violet-300" : "text-violet-700"} text-xs uppercase tracking-wider`}>
                <Globe className="h-4 w-4" />
                <span>{isKhmer ? "ជាន់ទី ១៖ Client Tier (Frontend React 19 & Next.js 16)" : "Tier 1: Frontend Client"}</span>
              </div>
              <span className={`text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>Port 3000</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
              <div className={`rounded-lg ${isDark ? "bg-black/40" : "bg-slate-50"} p-2.5 border ${isDark ? "border-white/5" : "border-slate-200"}`}>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>App Router UI</div>
                <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>Tailwind CSS 4 + Framer Motion</div>
              </div>
              <div className={`rounded-lg ${isDark ? "bg-black/40" : "bg-slate-50"} p-2.5 border ${isDark ? "border-white/5" : "border-slate-200"}`}>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>ExcelJS Engine</div>
                <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>បង្កើត Excel Reports & A4 Forms</div>
              </div>
              <div className={`rounded-lg ${isDark ? "bg-black/40" : "bg-slate-50"} p-2.5 border ${isDark ? "border-white/5" : "border-slate-200"}`}>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>/api/proxy Gateway</div>
                <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>CORS Protection & Token Injection</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className={`h-5 w-5 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} />
          </div>

          {/* Layer 2: Application Tier */}
          <div className={`rounded-xl border ${isDark ? "border-cyan-500/30 bg-cyan-950/20" : "border-cyan-200 bg-cyan-50"} p-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? "border-cyan-500/20" : "border-cyan-200"} pb-2 mb-3`}>
              <div className={`flex items-center gap-2 font-bold ${isDark ? "text-cyan-300" : "text-cyan-700"} text-xs uppercase tracking-wider`}>
                <Cpu className="h-4 w-4" />
                <span>{isKhmer ? "ជាន់ទី ២៖ Microservices API Tier (.NET 8 Minimal APIs)" : "Tier 2: Microservices Backend"}</span>
              </div>
              <span className={`text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>Ports 8000 & 8087</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className={`rounded-lg ${isDark ? "bg-black/40" : "bg-slate-50"} p-3 border ${isDark ? "border-white/5" : "border-slate-200"}`}>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} flex items-center justify-between`}>
                  <span>TechnicalService.API</span>
                  <span className={`text-[10px] font-mono ${isDark ? "text-cyan-400" : "text-cyan-700"}`}>:8000</span>
                </div>
                <p className={`mt-1 text-[11px] ${isDark ? "text-slate-300" : "text-slate-600"} leading-relaxed`}>
                  {isKhmer
                    ? "គ្រប់គ្រង Ticket Lifecycle, ការកាត់ស្តុក Spare Parts, ការកែតម្រូវ, និងការទាញ Aggregate របាយការណ៍"
                    : "Manages Ticket Lifecycles, Stock Audits, Adjustments, and 29 Reports Data"}
                </p>
              </div>

              <div className={`rounded-lg ${isDark ? "bg-black/40" : "bg-slate-50"} p-3 border ${isDark ? "border-white/5" : "border-slate-200"}`}>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"} flex items-center justify-between`}>
                  <span>UserManagementAPI</span>
                  <span className={`text-[10px] font-mono ${isDark ? "text-sky-400" : "text-sky-700"}`}>:8087</span>
                </div>
                <p className={`mt-1 text-[11px] ${isDark ? "text-slate-300" : "text-slate-600"} leading-relaxed`}>
                  {isKhmer
                    ? "JWT Tokens, Face Recognition, Passkeys WebAuthn, និង SignalR Mobile Pairing"
                    : "JWT Authentication, Face Biometrics, WebAuthn Passkeys, and SignalR"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} />
          </div>

          {/* Layer 3: Database Tier */}
          <div className={`rounded-xl border ${isDark ? "border-emerald-500/30 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"} p-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? "border-emerald-500/20" : "border-emerald-200"} pb-2 mb-3`}>
              <div className={`flex items-center gap-2 font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"} text-xs uppercase tracking-wider`}>
                <Database className="h-4 w-4" />
                <span>{isKhmer ? "ជាន់ទី ៣៖ Database Tier (SQL Server 2022 & Audit Ledger)" : "Tier 3: SQL Server Database"}</span>
              </div>
              <span className={`text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>ACID Transactions</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className={`rounded-lg ${isDark ? "bg-black/40" : "bg-slate-50"} p-3 border ${isDark ? "border-white/5" : "border-slate-200"}`}>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>TechnicalService DB</div>
                <p className={`mt-1 text-[11px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {isKhmer
                    ? "Services, Spareparts, SparepartStockAuditLog, ServiceStatuses, Monthly Matrices"
                    : "Stores core business tables with 100% immutable stock audit trails"}
                </p>
              </div>
              <div className={`rounded-lg ${isDark ? "bg-black/40" : "bg-slate-50"} p-3 border ${isDark ? "border-white/5" : "border-slate-200"}`}>
                <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>UserManagement DB</div>
                <p className={`mt-1 text-[11px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {isKhmer
                    ? "Users, Roles, Face Descriptors (128D vectors), Passkeys, Active Sessions"
                    : "Identity database with biometric vectors and role claims"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 3.5. INSPECTION 4-BRANCH SMART ROUTING & SPAREPART CONDITION MATRIX ──
  if (diagram.nodes.some((n) => n.id.startsWith("ii"))) {
    return (
      <div className={`my-8 overflow-hidden rounded-2xl border p-5 shadow-xl backdrop-blur-sm sm:p-8 transition-colors ${isDark ? "border-indigo-500/30 bg-[#070913]" : "border-slate-200 bg-white text-slate-800 shadow-lg"}`}>
        <div className={`mb-6 flex flex-col gap-2 border-b ${isDark ? "border-white/10" : "border-slate-200"} pb-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`flex h-2.5 w-2.5 rounded-full ${isDark ? "bg-indigo-400" : "bg-indigo-500"} animate-pulse`} />
              <h4 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"} sm:text-lg`}>
                {isKhmer ? "លំហូរការងារក្រោយការវិនិច្ឆ័យ (Post-Inspection 4-Branch Smart Routing)" : "Post-Inspection 4-Branch Smart Routing"}
              </h4>
            </div>
            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-600"} sm:text-sm`}>
              {isKhmer
                ? "រាល់ Inspection រួច៖ បើមានដោះដូរគ្រឿងបន្លាស់ ➔ បញ្ជូនទៅស្តុក | បើគ្មានដោះដូរ ➔ រំលងទៅផ្នែកទីផ្សារ ឬអនុម័តជួសជុលផ្ទាល់"
                : "If parts replaced -> Send to Stock | If no parts/service only -> Route to Sales/Direct repair"}
            </p>
          </div>
          <span className={`self-start rounded-full border ${isDark ? "border-indigo-500/30" : "border-indigo-200"} bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>
            Inspection Decision
          </span>
        </div>

        {/* Diagnostic Input Card */}
        <div className={`mb-6 rounded-xl ${isDark ? "border border-indigo-500/40 bg-indigo-950/30 text-white" : "border border-indigo-300 bg-white text-slate-900 shadow-sm hover:shadow-md"} p-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 ${isDark ? "text-indigo-300" : "text-indigo-700"} font-bold`}>
                <Search className="h-5 w-5" />
              </div>
              <div>
                <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>
                  {isKhmer ? "ច្រកចូលដំបូង (Diagnostic Trigger)" : "Diagnostic Trigger"}
                </div>
                <div className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {isKhmer
                    ? "ទទួលសំបុត្រពី Received Item ដែលបញ្ជូនមកវិនិច្ឆ័យ Inspecting ➔ ធ្វើតេស្ត & កត់ត្រាមូលហេតុពិត [Status: 2 Inspection]"
                    : "Intake from Received Item dispatched to Inspecting -> Diagnostics & Findings [Status 2]"}
                </div>
              </div>
            </div>
            <Link
              href="/inspect-item"
              className={`inline-flex items-center gap-1.5 rounded-lg border ${isDark ? "border-indigo-500/40" : "border-indigo-300"} bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold ${isDark ? "text-indigo-200" : "text-indigo-800"} hover:bg-indigo-500/30`}
            >
              <span>/inspect-item</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Smart Routing Branches */}
        <div className="space-y-4 mb-6">
          <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            {isKhmer ? "លំហូរការងារទាំង ៤ ករណី (៤ Distinct Workflows)" : "4 Distinct Routing Workflows"}
          </div>

          {/* Branch 1 */}
          <div className={`rounded-xl border ${isDark ? "border-amber-500/30 bg-amber-950/15" : "border-amber-200 bg-amber-50"} p-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? "border-amber-500/20" : "border-amber-200"} pb-2 mb-3`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 ${isDark ? "text-amber-300" : "text-amber-700"} text-xs font-bold`}>1</span>
                <span className={`font-bold ${isDark ? "text-amber-300" : "text-amber-700"} text-xs sm:text-sm`}>
                  {isKhmer ? "ករណីទី ១៖ Charge មាន Sparepart (ប្តូរគ្រឿងបន្លាស់គិតថ្លៃ)" : "Case 1: Charge with Sparepart"}
                </span>
              </div>
              <span className={`rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold ${isDark ? "text-amber-300" : "text-amber-700"}`}>Full Pipeline</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-lg border ${isDark ? "border-indigo-500/30 bg-black/40" : "border-indigo-200 bg-slate-50"} px-2.5 py-1.5 ${isDark ? "text-slate-200" : "text-slate-700"} font-medium`}>វិនិច្ឆ័យរួច (/inspect-item)</span>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"} shrink-0`} />
              <Link href="/spare-request" className={`rounded-lg border ${isDark ? "border-amber-500/40" : "border-amber-300"} bg-amber-500/10 px-2.5 py-1.5 ${isDark ? "text-amber-200" : "text-amber-800"} font-semibold ${isDark ? "hover:border-amber-400" : "hover:border-amber-500"}`}>បញ្ជូនទៅស្តុក (ឆែក & កក់ទុក)</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"} shrink-0`} />
              <Link href="/waiting-confirm" className={`rounded-lg border ${isDark ? "border-cyan-500/40" : "border-cyan-300"} bg-cyan-500/10 px-2.5 py-1.5 ${isDark ? "text-cyan-200" : "text-cyan-800"} font-semibold ${isDark ? "hover:border-cyan-400" : "hover:border-cyan-500"}`}>បញ្ជូនទៅទីផ្សារ (ធ្វើ Quote)</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"} shrink-0`} />
              <Link href="/confirmed-sale" className={`rounded-lg border ${isDark ? "border-emerald-500/40" : "border-emerald-300"} bg-emerald-500/10 px-2.5 py-1.5 ${isDark ? "text-emerald-200" : "text-emerald-800"} font-semibold ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"}`}>Sale Confirmed</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"} shrink-0`} />
              <span className={`rounded-lg border ${isDark ? "border-emerald-500/30 bg-black/40" : "border-emerald-200 bg-slate-50"} px-2.5 py-1.5 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-medium`}>បញ្ជូនគ្រឿងបន្លាស់ (Status: 12)</span>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"} shrink-0`} />
              <Link href="/pending-repairs" className={`rounded-lg border ${isDark ? "border-violet-500/40" : "border-violet-300"} bg-violet-500/10 px-2.5 py-1.5 ${isDark ? "text-violet-200" : "text-violet-800"} font-semibold ${isDark ? "hover:border-violet-400" : "hover:border-violet-500"}`}>ជួសជុល (ចុច &apos;Approved Repair&apos;)</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"} shrink-0`} />
              <Link href="/approve-verify" className={`rounded-lg border ${isDark ? "border-indigo-500/40" : "border-indigo-300"} bg-indigo-500/10 px-2.5 py-1.5 ${isDark ? "text-indigo-200" : "text-indigo-800"} font-semibold ${isDark ? "hover:border-indigo-400" : "hover:border-indigo-500"}`}>Manager QA</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-700"} shrink-0`} />
              <Link href="/completed-repairs" className={`rounded-lg border ${isDark ? "border-emerald-500/50" : "border-emerald-400"} bg-emerald-500/20 px-2.5 py-1.5 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-bold ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"}`}>Finished Page</Link>
            </div>
          </div>

          {/* Branch 2 */}
          <div className={`rounded-xl border ${isDark ? "border-cyan-500/30 bg-cyan-950/15" : "border-cyan-200 bg-cyan-50"} p-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? "border-cyan-500/20" : "border-cyan-200"} pb-2 mb-3`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 ${isDark ? "text-cyan-300" : "text-cyan-700"} text-xs font-bold`}>2</span>
                <span className={`font-bold ${isDark ? "text-cyan-300" : "text-cyan-700"} text-xs sm:text-sm`}>
                  {isKhmer ? "ករណីទី ២៖ Charge គ្មាន Sparepart (សេវាពលកម្ម Service Charge, Cleaning...)" : "Case 2: Charge No Sparepart (Service Charge)"}
                </span>
              </div>
              <span className={`rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>Skip Stock</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-lg border ${isDark ? "border-indigo-500/30 bg-black/40" : "border-indigo-200 bg-slate-50"} px-2.5 py-1.5 ${isDark ? "text-slate-200" : "text-slate-700"} font-medium`}>វិនិច្ឆ័យរួច (/inspect-item)</span>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-cyan-400" : "text-cyan-700"} shrink-0`} />
              <Link href="/waiting-confirm" className={`rounded-lg border ${isDark ? "border-cyan-500/40" : "border-cyan-300"} bg-cyan-500/10 px-2.5 py-1.5 ${isDark ? "text-cyan-200" : "text-cyan-800"} font-semibold ${isDark ? "hover:border-cyan-400" : "hover:border-cyan-500"}`}>បញ្ជូនទៅទីផ្សារ (Quote សេវាពលកម្ម)</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-cyan-400" : "text-cyan-700"} shrink-0`} />
              <Link href="/confirmed-sale" className={`rounded-lg border ${isDark ? "border-emerald-500/40" : "border-emerald-300"} bg-emerald-500/10 px-2.5 py-1.5 ${isDark ? "text-emerald-200" : "text-emerald-800"} font-semibold ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"}`}>Sale Confirmed</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-cyan-400" : "text-cyan-700"} shrink-0`} />
              <Link href="/pending-repairs" className={`rounded-lg border ${isDark ? "border-violet-500/40" : "border-violet-300"} bg-violet-500/10 px-2.5 py-1.5 ${isDark ? "text-violet-200" : "text-violet-800"} font-semibold ${isDark ? "hover:border-violet-400" : "hover:border-violet-500"}`}>ជួសជុល (ចុច &apos;Approved Repair&apos;)</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-cyan-400" : "text-cyan-700"} shrink-0`} />
              <Link href="/approve-verify" className={`rounded-lg border ${isDark ? "border-indigo-500/40" : "border-indigo-300"} bg-indigo-500/10 px-2.5 py-1.5 ${isDark ? "text-indigo-200" : "text-indigo-800"} font-semibold ${isDark ? "hover:border-indigo-400" : "hover:border-indigo-500"}`}>Manager QA</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-cyan-400" : "text-cyan-700"} shrink-0`} />
              <Link href="/completed-repairs" className={`rounded-lg border ${isDark ? "border-emerald-500/50" : "border-emerald-400"} bg-emerald-500/20 px-2.5 py-1.5 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-bold ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"}`}>Finished Page</Link>
            </div>
          </div>

          {/* Branch 3 */}
          <div className={`rounded-xl border ${isDark ? "border-violet-500/30 bg-violet-950/15" : "border-violet-200 bg-violet-50"} p-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? "border-violet-500/20" : "border-violet-200"} pb-2 mb-3`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 ${isDark ? "text-violet-300" : "text-violet-700"} text-xs font-bold`}>3</span>
                <span className={`font-bold ${isDark ? "text-violet-300" : "text-violet-700"} text-xs sm:text-sm`}>
                  {isKhmer ? "ករណីទី ៣៖ Free មាន Sparepart (ប្តូរគ្រឿងបន្លាស់ធានាឥតគិតថ្លៃ Free/Warranty)" : "Case 3: Free with Sparepart (Warranty Part)"}
                </span>
              </div>
              <span className={`rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold ${isDark ? "text-violet-300" : "text-violet-700"}`}>Skip Sales Quote</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-lg border ${isDark ? "border-indigo-500/30 bg-black/40" : "border-indigo-200 bg-slate-50"} px-2.5 py-1.5 ${isDark ? "text-slate-200" : "text-slate-700"} font-medium`}>វិនិច្ឆ័យរួច (/inspect-item)</span>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-violet-400" : "text-violet-700"} shrink-0`} />
              <Link href="/spare-request" className={`rounded-lg border ${isDark ? "border-amber-500/40" : "border-amber-300"} bg-amber-500/10 px-2.5 py-1.5 ${isDark ? "text-amber-200" : "text-amber-800"} font-semibold ${isDark ? "hover:border-amber-400" : "hover:border-amber-500"}`}>បញ្ជូនទៅស្តុក (ឆែក & ដកគ្រឿងឥតគិតថ្លៃ)</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-violet-400" : "text-violet-700"} shrink-0`} />
              <span className={`rounded-lg border ${isDark ? "border-emerald-500/30 bg-black/40" : "border-emerald-200 bg-slate-50"} px-2.5 py-1.5 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-medium`}>បញ្ជូនគ្រឿងបន្លាស់ (Status: 12)</span>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-violet-400" : "text-violet-700"} shrink-0`} />
              <Link href="/pending-repairs" className={`rounded-lg border ${isDark ? "border-violet-500/40" : "border-violet-300"} bg-violet-500/10 px-2.5 py-1.5 ${isDark ? "text-violet-200" : "text-violet-800"} font-semibold ${isDark ? "hover:border-violet-400" : "hover:border-violet-500"}`}>ជួសជុល (ចុច &apos;Approved Repair&apos;)</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-violet-400" : "text-violet-700"} shrink-0`} />
              <Link href="/approve-verify" className={`rounded-lg border ${isDark ? "border-indigo-500/40" : "border-indigo-300"} bg-indigo-500/10 px-2.5 py-1.5 ${isDark ? "text-indigo-200" : "text-indigo-800"} font-semibold ${isDark ? "hover:border-indigo-400" : "hover:border-indigo-500"}`}>Manager QA</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-violet-400" : "text-violet-700"} shrink-0`} />
              <Link href="/completed-repairs" className={`rounded-lg border ${isDark ? "border-emerald-500/50" : "border-emerald-400"} bg-emerald-500/20 px-2.5 py-1.5 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-bold ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"}`}>Finished Page</Link>
            </div>
          </div>

          {/* Branch 4 */}
          <div className={`rounded-xl border ${isDark ? "border-emerald-500/30 bg-emerald-950/15" : "border-emerald-200 bg-emerald-50"} p-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? "border-emerald-500/20" : "border-emerald-200"} pb-2 mb-3`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 ${isDark ? "text-emerald-300" : "text-emerald-700"} text-xs font-bold`}>4</span>
                <span className={`font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"} text-xs sm:text-sm`}>
                  {isKhmer ? "ករណីទី ៤៖ Free គ្មាន Sparepart (កែតម្រូវ/សម្អាតឥតគិតថ្លៃ Fast-Track)" : "Case 4: Free No Sparepart (Fast-Track)"}
                </span>
              </div>
              <span className={`rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>Fast Track</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-lg border ${isDark ? "border-indigo-500/30 bg-black/40" : "border-indigo-200 bg-slate-50"} px-2.5 py-1.5 ${isDark ? "text-slate-200" : "text-slate-700"} font-medium`}>វិនិច្ឆ័យរួចរាល់ (/inspect-item)</span>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-emerald-400" : "text-emerald-700"} shrink-0`} />
              <Link href="/pending-repairs" className={`rounded-lg border ${isDark ? "border-violet-500/40" : "border-violet-300"} bg-violet-500/10 px-2.5 py-1.5 ${isDark ? "text-violet-200" : "text-violet-800"} font-semibold ${isDark ? "hover:border-violet-400" : "hover:border-violet-500"}`}>
                ជួសជុល (ចុច &apos;Approved Repair&apos;)
              </Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-emerald-400" : "text-emerald-700"} shrink-0`} />
              <Link href="/approve-verify" className={`rounded-lg border ${isDark ? "border-indigo-500/40" : "border-indigo-300"} bg-indigo-500/10 px-2.5 py-1.5 ${isDark ? "text-indigo-200" : "text-indigo-800"} font-semibold ${isDark ? "hover:border-indigo-400" : "hover:border-indigo-500"}`}>Manager QA</Link>
              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? "text-emerald-400" : "text-emerald-700"} shrink-0`} />
              <Link href="/completed-repairs" className={`rounded-lg border ${isDark ? "border-emerald-500/50" : "border-emerald-400"} bg-emerald-500/20 px-2.5 py-1.5 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-bold ${isDark ? "hover:border-emerald-400" : "hover:border-emerald-500"}`}>Finished Page</Link>
            </div>
          </div>
        </div>

        {/* Sparepart Condition & Stock Deduction Logic Table */}
        <div className={`rounded-xl ${isDark ? "border border-white/10 bg-black/40 text-white" : "border border-slate-200 bg-white text-slate-900 shadow-sm"} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <Boxes className={`h-4 w-4 ${isDark ? "text-amber-400" : "text-amber-700"}`} />
            <h5 className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"} uppercase tracking-wider`}>
              {isKhmer ? "លក្ខខណ្ឌគ្រឿងបន្លាស់ & ការកាត់ស្តុក (Sparepart Condition Rules)" : "Sparepart Condition Rules"}
            </h5>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isDark ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-600"} text-[11px] font-bold uppercase`}>
                  <th className="py-2 px-3">Condition</th>
                  <th className="py-2 px-3">អត្ថន័យ & សកម្មភាព</th>
                  <th className="py-2 px-3">ការកាត់ស្តុក (Inventory)</th>
                  <th className="py-2 px-3">លក្ខខណ្ឌបញ្ជូន (Routing Logic)</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-white/5 text-slate-300" : "divide-slate-200 text-slate-600"}`}>
                <tr>
                  <td className={`py-2.5 px-3 font-mono font-bold ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>Fix</td>
                  <td className="py-2.5 px-3">ជួសជុល / កែតម្រូវគ្រឿងចាស់</td>
                  <td className={`py-2.5 px-3 ${isDark ? "text-rose-300" : "text-rose-700"} font-semibold`}>មិនកាត់ស្តុក (No Deduct)</td>
                  <td className={`py-2.5 px-3 ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>
                    បើជ្រើស Fix ទាំងអស់ ➔ <strong>មិនបញ្ជូនទៅស្តុកទេ</strong> ➔ ទៅផ្នែកទីផ្សារ / ជួសជុល Direct
                  </td>
                </tr>
                <tr>
                  <td className={`py-2.5 px-3 font-mono font-bold ${isDark ? "text-amber-300" : "text-amber-700"}`}>Replace</td>
                  <td className="py-2.5 px-3">ដោះដូរប្តូរគ្រឿងបន្លាស់ថ្មី (គិតថ្លៃ)</td>
                  <td className={`py-2.5 px-3 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-semibold`}>កាត់ស្តុក (Deduct Stock)</td>
                  <td className={`py-2.5 px-3 ${isDark ? "text-amber-300" : "text-amber-700"}`}>
                    បើមាន Replace ឬ Free យ៉ាងហោចមួយ ➔ <strong>ត្រូវបញ្ជូនទៅផ្នែកស្តុកជាមុនសិន</strong>
                  </td>
                </tr>
                <tr>
                  <td className={`py-2.5 px-3 font-mono font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>Free</td>
                  <td className="py-2.5 px-3">គ្រឿងបន្លាស់ធានាឥតគិតថ្លៃ (Warranty)</td>
                  <td className={`py-2.5 px-3 ${isDark ? "text-emerald-300" : "text-emerald-700"} font-semibold`}>កាត់ស្តុក (Deduct Stock)</td>
                  <td className={`py-2.5 px-3 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                    បើមាន Replace ឬ Free យ៉ាងហោចមួយ ➔ <strong>ត្រូវបញ្ជូនទៅផ្នែកស្តុកជាមុនសិន</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── 4. STANDARD VISUAL STEP PIPELINE FLOW (For All Other Articles) ──
  return (
    <div className={`my-8 overflow-hidden rounded-2xl border p-5 shadow-xl backdrop-blur-sm sm:p-7 transition-colors ${isDark ? "border-violet-500/20 bg-[#080a14]" : "border-slate-200 bg-white text-slate-800 shadow-lg"}`}>
      <div className={`mb-6 flex flex-col gap-2 border-b ${isDark ? "border-white/10" : "border-slate-200"} pb-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <div className="flex items-center gap-2">
            <span className={`flex h-2.5 w-2.5 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-500"} animate-pulse`} />
            <h4 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"} sm:text-lg`}>
              {isKhmer ? diagram.titleKm : diagram.titleEn}
            </h4>
          </div>
          <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-600"} sm:text-sm`}>
            {isKhmer ? diagram.descriptionKm : diagram.descriptionEn}
          </p>
        </div>
        <span className={`self-start rounded-full border ${isDark ? "border-violet-500/30" : "border-violet-200"} bg-violet-500/10 px-3 py-1 text-[11px] font-semibold ${isDark ? "text-violet-300" : "text-violet-700"}`}>
          {isKhmer ? "គំនូសលំហូរការងារ" : "Process Flow"}
        </span>
      </div>

      {/* Connected Sequential Step Cards with Arrows */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {diagram.nodes.map((node, index) => {
          const skin = isDark
            ? node.color === "emerald"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400"
              : node.color === "cyan"
              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400"
              : node.color === "amber"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:border-amber-400"
              : node.color === "rose"
              ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:border-rose-400"
              : node.color === "sky"
              ? "border-sky-500/40 bg-sky-500/10 text-sky-300 hover:border-sky-400"
              : "border-violet-500/40 bg-violet-500/10 text-violet-300 hover:border-violet-400"
            : node.color === "emerald"
              ? "border-emerald-300 bg-emerald-50/80 text-emerald-950 hover:border-emerald-500 shadow-sm"
              : node.color === "cyan"
              ? "border-cyan-300 bg-cyan-50/80 text-cyan-950 hover:border-cyan-500 shadow-sm"
              : node.color === "amber"
              ? "border-amber-300 bg-amber-50/80 text-amber-950 hover:border-amber-500 shadow-sm"
              : node.color === "rose"
              ? "border-rose-300 bg-rose-50/80 text-rose-950 hover:border-rose-500 shadow-sm"
              : node.color === "sky"
              ? "border-sky-300 bg-sky-50/80 text-sky-950 hover:border-sky-500 shadow-sm"
              : "border-violet-300 bg-violet-50/80 text-violet-950 hover:border-violet-500 shadow-sm";

          const content = (
            <div
              className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 shadow-md ${skin}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold ${isDark ? "bg-black/40 text-white/90" : "bg-white text-slate-800 shadow-xs border border-slate-200"}`}>
                  {index + 1}
                </span>
                {(node.badgeKm || node.badgeEn) && (
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${isDark ? "border-white/10 bg-black/40 text-white/90" : "border-slate-300/80 bg-white text-slate-700 shadow-xs"}`}>
                    {isKhmer ? node.badgeKm : node.badgeEn}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <p className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"} sm:text-[14px] leading-snug`}>
                  {isKhmer ? node.labelKm : node.labelEn}
                </p>
              </div>

              {node.route && (
                <div className={`mt-3 flex items-center justify-between border-t pt-2 text-[11px] ${isDark ? "border-white/5 text-slate-400 group-hover:text-white" : "border-slate-200/80 text-slate-600 font-semibold group-hover:text-slate-950"}`}>
                  <span className="font-mono">{node.route}</span>
                  <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              )}
            </div>
          );

          if (node.route && node.route.startsWith("/")) {
            return (
              <Link key={node.id} href={node.route} className="block cursor-pointer">
                {content}
              </Link>
            );
          }

          return <div key={node.id}>{content}</div>;
        })}
      </div>
    </div>
  );
}
