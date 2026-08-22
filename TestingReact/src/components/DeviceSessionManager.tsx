"use client";

/**
 * @file DeviceSessionManager.tsx
 * @description Real-time Device and Session Management Dashboard.
 * Inspects active mobile companion scanner devices and logged-in user sessions.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Smartphone,
  Laptop,
  Radio,
  CheckCircle2,
  AlertCircle,
  Unlink,
  RefreshCw,
  ShieldCheck,
  QrCode,
  LogOut,
  Clock,
  Globe,
  KeyRound,
  Trash2,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { useI18n } from "@/i18n/LanguageProvider";
import { useCompanionScanner } from "@/context/CompanionScannerContext";
import { clearSession } from "@/services/authSession";
import { useRouter } from "next/navigation";
import QRCodeSvg from "./QRCodeSvg";
import { ModalWrapper } from "./av/ModalWrapper";

interface ScannerDeviceItem {
  sessionId: string;
  createdAt: number;
  phoneConnected: boolean;
  lastScannedCode?: string;
  device?: {
    name: string;
    userAgent?: string;
    ip?: string;
    joinedAt?: number;
    scanCount: number;
    lastActiveAt?: number;
  };
}

interface LoginSessionItem {
  sessionId: string;
  userName: string;
  role: string;
  email?: string;
  deviceDisplay: string;
  browserName: string;
  osName: string;
  ip: string;
  loginTime: number;
  lastActiveTime: number;
}

export default function DeviceSessionManager() {
  const { lang } = useI18n();
  const isKhmer = lang === "km";
  const router = useRouter();

  const {
    sessionId: currentScannerSessionId,
    isPhoneConnected,
    scanCount,
    lastScannedCode,
    openPairingModal,
    disconnectPhone,
  } = useCompanionScanner();

  const [scannerDevices, setScannerDevices] = useState<ScannerDeviceItem[]>([]);
  const [loginSessions, setLoginSessions] = useState<LoginSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentBrowserSessionId, setCurrentBrowserSessionId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      let id = sessionStorage.getItem("browser_login_session_id");
      if (!id) {
        id = "sess-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        sessionStorage.setItem("browser_login_session_id", id);
      }
      setCurrentBrowserSessionId(id);
    }
  }, []);

  // Fetch active scanner sessions from API (skips when tab is in background)
  const fetchScannerDevices = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/scanner/devices");
      if (res.ok) {
        const data = await res.json();
        setScannerDevices(data.devices || []);
      }
    } catch (err) {
      console.warn("Failed to load scanner devices:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch active login sessions from API (multi-browser & multi-device)
  const fetchLoginSessions = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setLoginSessions(data.sessions || []);
      }
    } catch (err) {
      console.warn("Failed to load login sessions:", err);
    }
  }, []);

  useEffect(() => {
    fetchScannerDevices();
    fetchLoginSessions();
    const timer = setInterval(() => {
      fetchScannerDevices();
      fetchLoginSessions();
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchScannerDevices, fetchLoginSessions]);

  // Handle remote device disconnect
  const handleDisconnectDevice = async (sid: string) => {
    try {
      await fetch("/api/scanner/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          type: "terminate",
        }),
      });

      if (sid === currentScannerSessionId) {
        disconnectPhone();
      }

      toast.success(isKhmer ? "បានផ្តាច់ឧបករណ៍ទូរស័ព្ទជោគជ័យ!" : "Phone disconnected!");
      fetchScannerDevices();
    } catch {
      toast.error(isKhmer ? "មិនអាចផ្តាច់ឧបករណ៍បានទេ" : "Failed to disconnect device");
    }
  };

  const handleLogoutCurrentSession = () => {
    disconnectPhone();
    clearSession();
    sessionStorage.removeItem("robot_greeted");
    router.push("/login");
  };

  const formatTimeAgo = (ts?: number) => {
    if (!ts) return isKhmer ? "ទើបតែភ្ជាប់" : "Just now";
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return isKhmer ? `${diffSec} វិនាទីមុន` : `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return isKhmer ? `${diffMin} នាទីមុន` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    return isKhmer ? `${diffHours} ម៉ោងមុន` : `${diffHours}h ago`;
  };

  // Revoke a specific login session
  const handleRevokeLoginSession = async (sid: string) => {
    if (sid === currentBrowserSessionId) {
      handleLogoutCurrentSession();
      return;
    }
    try {
      await fetch(`/api/auth/sessions?sessionId=${sid}`, {
        method: "DELETE",
      });
      toast.success(isKhmer ? "បាន Sign Out ឧបករណ៍នោះជោគជ័យ!" : "Signed out session!");
      fetchLoginSessions();
    } catch {
      toast.error(isKhmer ? "បរាជ័យក្នុងការ Sign Out" : "Failed to sign out session");
    }
  };

  // Revoke all other login sessions
  const handleRevokeAllOtherSessions = async () => {
    try {
      await fetch(
        `/api/auth/sessions?revokeOthers=true&currentSessionId=${currentBrowserSessionId}`,
        {
          method: "DELETE",
        }
      );
      toast.success(isKhmer ? "បាន Sign Out គ្រប់ឧបករណ៍ផ្សេងទៀតជោគជ័យ!" : "Signed out all other sessions!");
      fetchLoginSessions();
    } catch {
      toast.error(isKhmer ? "បរាជ័យក្នុងការ Sign Out" : "Failed to sign out other sessions");
    }
  };

  const activeScannerCount = scannerDevices.filter((d) => d.phoneConnected).length;
  const activeLoginCount = Math.max(loginSessions.length, 1);

  return (
    <div className="space-y-6">
      {/* ── Top Metric KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-ink-secondary">
              {isKhmer ? "ឧបករណ៍ស្កេន Barcode" : "Connected Scanners"}
            </p>
            <p className="text-lg font-bold text-ink flex items-center gap-1.5 mt-0.5">
              <span>{activeScannerCount} {isKhmer ? "ឧបករណ៍" : "Device"}</span>
              {activeScannerCount > 0 ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
              )}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-ink-secondary">
              {isKhmer ? "Session Login គណនី" : "Active Login Sessions"}
            </p>
            <p className="text-lg font-bold text-ink flex items-center gap-1.5 mt-0.5">
              <span>{activeLoginCount} {isKhmer ? "ឧបករណ៍" : "Active"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                Online
              </span>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-ink-secondary">
              {isKhmer ? "កម្រិតសុវត្ថិភាព Session" : "Session Security"}
            </p>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>JWT Encrypted & Guarded</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Mobile Companion Barcode Scanner Devices Table ── */}
      <div className="rounded-2xl border border-subtle bg-surface shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sunken/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                {isKhmer ? "១. ឧបករណ៍ស្កេន Barcode តាមទូរស័ព្ទ (Mobile Companion Scanners)" : "1. Paired Mobile Barcode Scanners"}
              </h3>
              <p className="text-[11px] text-ink-secondary">
                {isKhmer ? "រាយនាមទូរស័ព្ទដៃដែលបាន Scan QR ភ្ជាប់ធ្វើជាកាំភ្លើងស្កេន Barcode ឥតខ្សែ" : "List of mobile phones connected as wireless barcode scanning guns"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchScannerDevices}
              className="p-2 rounded-xl border border-subtle bg-surface hover:bg-cushion text-ink-secondary hover:text-ink transition-colors cursor-pointer text-xs font-semibold inline-flex items-center gap-1.5"
              title="Refresh Devices"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isKhmer ? "ទាញទិន្នន័យថ្មី" : "Refresh"}</span>
            </button>

            <button
              type="button"
              onClick={openPairingModal}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{isKhmer ? "ភ្ជាប់ទូរស័ព្ទថ្មី (Pair Phone)" : "Pair New Phone"}</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-subtle bg-sunken/60 text-ink-secondary font-semibold">
                <th className="py-3 px-4">{isKhmer ? "ឈ្មោះឧបករណ៍ (Device)" : "Device"}</th>
                <th className="py-3 px-4">{isKhmer ? "ស្ថានភាព (Status)" : "Status"}</th>
                <th className="py-3 px-4">{isKhmer ? "Session ID" : "Session ID"}</th>
                <th className="py-3 px-4">{isKhmer ? "ចំនួន Scan" : "Scanned Codes"}</th>
                <th className="py-3 px-4">{isKhmer ? "សកម្មភាពចុងក្រោយ" : "Last Active"}</th>
                <th className="py-3 px-4 text-right">{isKhmer ? "សកម្មភាព (Actions)" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {scannerDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold">{isKhmer ? "មិនទាន់មានទូរស័ព្ទណាភ្ជាប់នៅឡើយទេ" : "No mobile scanners paired yet"}</p>
                    <p className="text-[11px] mt-0.5">{isKhmer ? "ចុចប៊ូតុង «ភ្ជាប់ទូរស័ព្ទថ្មី» ខាងលើដើម្បី Scan QR Code" : "Click 'Pair New Phone' above to scan QR code"}</p>
                  </td>
                </tr>
              ) : (
                scannerDevices.map((item) => {
                  const isCurrent = item.sessionId === currentScannerSessionId;
                  const isConnected = item.phoneConnected;

                  return (
                    <tr key={item.sessionId} className="hover:bg-sunken/30 transition-colors">
                      {/* Device Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isConnected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          }`}>
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-ink flex items-center gap-1.5">
                              <span>{item.device?.name || (isKhmer ? "ទូរស័ព្ទ Smartphone" : "Mobile Phone")}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold">
                                  {isKhmer ? "Tab នេះ" : "This Tab"}
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] text-ink-secondary font-mono">
                              IP: {item.device?.ip || "192.168.0.x"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isConnected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <span>{isKhmer ? "កំពុងភ្ជាប់ 🟢" : "Connected"}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-medium border border-subtle">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>{isKhmer ? "រង់ចាំទូរស័ព្ទ ⚪" : "Standby"}</span>
                          </span>
                        )}
                      </td>

                      {/* Session ID */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-ink-secondary bg-sunken px-2 py-1 rounded-lg">
                          {item.sessionId.substring(0, 14)}...
                        </span>
                      </td>

                      {/* Scan Count */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-ink">
                          {item.device?.scanCount || (isCurrent ? scanCount : 0)} {isKhmer ? "កូដ" : "scans"}
                        </div>
                        {item.lastScannedCode && (
                          <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono truncate max-w-[120px]">
                            ⚡ {item.lastScannedCode}
                          </p>
                        )}
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-4 text-ink-secondary text-[11px]">
                        {formatTimeAgo(item.device?.lastActiveAt || item.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isConnected ? (
                          <button
                            type="button"
                            onClick={() => handleDisconnectDevice(item.sessionId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                            title="Disconnect Phone"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                            <span>{isKhmer ? "ផ្តាច់" : "Disconnect"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={openPairingModal}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-semibold transition-colors cursor-pointer"
                            title="Show QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>{isKhmer ? "បង្ហាញ QR" : "Pair QR"}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 2: Active User Login Sessions Table ── */}
      <div className="rounded-2xl border border-subtle bg-surface shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sunken/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                {isKhmer ? "២. Session គណនីដែលបាន Login (Active Account Login Sessions)" : "2. Active User Login Sessions"}
              </h3>
              <p className="text-[11px] text-ink-secondary">
                {isKhmer ? "រាយនាមឧបករណ៍កុំព្យូទ័រ និង Tablet ដែលបាន Login ចូលគណនីរបស់អ្នក" : "Devices currently authenticated with your user account credentials"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loginSessions.length > 1 && (
              <button
                type="button"
                onClick={handleRevokeAllOtherSessions}
                className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isKhmer ? "Sign Out ឧបករណ៍ផ្សេងទៀត" : "Sign Out Other Devices"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogoutCurrentSession}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isKhmer ? "Sign Out ពីឧបករណ៍នេះ" : "Sign Out This Device"}</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-subtle bg-sunken/60 text-ink-secondary font-semibold">
                <th className="py-3 px-4">{isKhmer ? "ឧបករណ៍ & កម្មវិធីរុករក (Device / Browser)" : "Device / Browser"}</th>
                <th className="py-3 px-4">{isKhmer ? "គណនី (Account)" : "Account"}</th>
                <th className="py-3 px-4">{isKhmer ? "ប្រភេទសុវត្ថិភាព" : "Auth Type"}</th>
                <th className="py-3 px-4">{isKhmer ? "ស្ថានភាព (Status)" : "Status"}</th>
                <th className="py-3 px-4 text-right">{isKhmer ? "សកម្មភាព (Actions)" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loginSessions.length === 0 ? (
                /* Fallback single current device row */
                <tr className="hover:bg-sunken/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-ink flex items-center gap-1.5">
                          <span>Windows PC (Google Chrome)</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                            {isKhmer ? "ឧបករណ៍នេះ (Current)" : "This Device"}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-ink-secondary font-mono">
                          Host: {typeof window !== "undefined" ? window.location.hostname : "localhost"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-ink">User</div>
                    <p className="text-[10.5px] text-ink-secondary">Technician</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold border border-indigo-500/20">
                      <KeyRound className="w-3 h-3" />
                      <span>JWT Bearer (HS256)</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>{isKhmer ? "Active ឥឡូវនេះ" : "Active Now"}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={handleLogoutCurrentSession}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 text-ink-secondary text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{isKhmer ? "Logout" : "Logout"}</span>
                    </button>
                  </td>
                </tr>
              ) : (
                loginSessions.map((session) => {
                  const isCurrent = session.sessionId === currentBrowserSessionId;

                  return (
                    <tr key={session.sessionId} className="hover:bg-sunken/30 transition-colors">
                      {/* Device */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                          }`}>
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-ink flex items-center gap-1.5">
                              <span>{session.deviceDisplay || "Web Browser"}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                                  {isKhmer ? "ឧបករណ៍នេះ (Current)" : "This Device"}
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] text-ink-secondary font-mono">
                              IP: {session.ip || "127.0.0.1"} · {formatTimeAgo(session.lastActiveTime)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Account */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-ink">{session.userName}</div>
                        <p className="text-[10.5px] text-ink-secondary">{session.role}</p>
                      </td>

                      {/* Security Type */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold border border-indigo-500/20">
                          <KeyRound className="w-3 h-3" />
                          <span>JWT Bearer (HS256)</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          <span>{isKhmer ? "Active ឥឡូវនេះ" : "Active Now"}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRevokeLoginSession(session.sessionId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 text-ink-secondary text-xs font-semibold transition-colors cursor-pointer"
                          title={isCurrent ? "Sign out of this browser" : "Remotely sign out this device"}
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>{isCurrent ? (isKhmer ? "Logout" : "Logout") : isKhmer ? "Sign Out" : "Sign Out"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
