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
  CheckCircle2,
  Unlink,
  RefreshCw,
  ShieldCheck,
  QrCode,
  LogOut,
  KeyRound,
  Trash2,
  ScanFace,
  Camera,
} from "lucide-react";
import toast from "react-hot-toast";
import { useI18n } from "@/i18n/LanguageProvider";
import { useCompanionScanner } from "@/context/CompanionScannerContext";
import { clearSession } from "@/services/authSession";
import { useRouter } from "next/navigation";
import {
  listFaceDevices,
  revokeFaceDevice,
  getFaceStatus,
  enrollFace,
  toggleFaceTwoFactor,
  type FaceDevice,
  type FaceStatus,
} from "@/services/faceAuth";
import FaceLinkQr from "./FaceLinkQr";
import FaceCapture from "./FaceCapture";
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
    scanCount,
    openPairingModal,
    disconnectPhone,
  } = useCompanionScanner();

  const [scannerDevices, setScannerDevices] = useState<ScannerDeviceItem[]>([]);
  const [loginSessions, setLoginSessions] = useState<LoginSessionItem[]>([]);
  const [faceDevices, setFaceDevices] = useState<FaceDevice[]>([]);
  const [faceStatus, setFaceStatus] = useState<FaceStatus | null>(null);
  const [isFacePairModalOpen, setIsFacePairModalOpen] = useState<boolean>(false);
  const [isPcFaceModalOpen, setIsPcFaceModalOpen] = useState<boolean>(false);
  const [savingFace, setSavingFace] = useState<boolean>(false);
  const [toggling2fa, setToggling2fa] = useState<boolean>(false);
  const [currentBrowserSessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      let id = sessionStorage.getItem("browser_login_session_id");
      if (!id) {
        id = "sess-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        sessionStorage.setItem("browser_login_session_id", id);
      }
      return id;
    } catch {
      return "sess-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    }
  });
  const [now, setNow] = useState<number>(() => Date.now());

  // Read current logged-in username for strict session isolation
  const [currentUserName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const u = localStorage.getItem("user_info");
      if (!u) return "";
      const p = JSON.parse(u);
      return String(p.userName || p.UserName || "").trim();
    } catch {
      return "";
    }
  });

  // Fetch paired face authentication devices & enrollment status
  const fetchFaceDevices = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const [devices, status] = await Promise.all([
        listFaceDevices().catch(() => [] as FaceDevice[]),
        getFaceStatus().catch(() => null),
      ]);
      setFaceDevices(devices || []);
      if (status) setFaceStatus(status);
    } catch (err) {
      console.warn("Failed to load face devices:", err);
    }
  }, []);

  // Fetch active scanner sessions from API (strictly scoped to this user's PC session)
  const fetchScannerDevices = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const url = currentScannerSessionId
        ? `/api/scanner/devices?sessionId=${encodeURIComponent(currentScannerSessionId)}`
        : `/api/scanner/devices`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setScannerDevices(data.devices || []);
      }
    } catch (err) {
      console.warn("Failed to load scanner devices:", err);
    }
  }, [currentScannerSessionId]);

  // Fetch active login sessions from API (strictly scoped to current user's account)
  const fetchLoginSessions = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const url = currentUserName
        ? `/api/auth/sessions?userName=${encodeURIComponent(currentUserName)}`
        : `/api/auth/sessions`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLoginSessions(data.sessions || []);
      }
    } catch (err) {
      console.warn("Failed to load login sessions:", err);
    }
  }, [currentUserName]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchScannerDevices();
      void fetchLoginSessions();
      void fetchFaceDevices();
    });
    const timer = setInterval(() => {
      setNow(Date.now());
      void fetchScannerDevices();
      void fetchLoginSessions();
      void fetchFaceDevices();
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchScannerDevices, fetchLoginSessions, fetchFaceDevices]);

  // Handle 2FA Toggle for Face Authentication
  const handleToggle2FA = async () => {
    if (!faceStatus?.enrolled) {
      toast.error(isKhmer ? "សូមចុះឈ្មោះស្កេនមុខជាមុនសិន មុននឹងបើក 2FA" : "Please set up your face scan first before enabling 2FA");
      return;
    }
    const next = !faceStatus.twoFactorEnabled;
    setToggling2fa(true);
    try {
      await toggleFaceTwoFactor(next);
      setFaceStatus((prev) => (prev ? { ...prev, twoFactorEnabled: next } : null));
      toast.success(
        next
          ? (isKhmer ? "បានបើក Two-Factor Face Login" : "Two-Factor Face Authentication is enabled")
          : (isKhmer ? "បានបិទ Two-Factor Face Login" : "Two-Factor Face Authentication is disabled")
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update 2FA setting");
    } finally {
      setToggling2fa(false);
    }
  };

  // Handle PC Camera Face Enrollment Complete
  const handlePcFaceCaptured = async (descriptors: number[][]) => {
    setSavingFace(true);
    try {
      const count = await enrollFace(descriptors);
      setFaceStatus((prev) => ({
        enrolled: true,
        twoFactorEnabled: true,
        sampleCount: count,
        requiredSamples: prev?.requiredSamples ?? 3,
        enrolledAt: new Date().toISOString(),
      }));
      setIsPcFaceModalOpen(false);
      toast.success(isKhmer ? "បានចុះឈ្មោះស្កេនមុខលើ PC ជោគជ័យ!" : "Face enrolled successfully on PC!");
      fetchFaceDevices();
    } catch {
      toast.error(isKhmer ? "មិនអាចរក្សាទុកទិន្នន័យមុខបានទេ" : "Could not save face data");
    } finally {
      setSavingFace(false);
    }
  };

  // Handle unpairing a face verification device
  const handleUnpairFaceDevice = async (id: number, name: string) => {
    try {
      await revokeFaceDevice(id);
      toast.success(isKhmer ? `បានផ្តាច់ទូរស័ព្ទ ${name} ជោគជ័យ!` : `Unpaired ${name} successfully!`);
      fetchFaceDevices();
    } catch {
      toast.error(isKhmer ? "មិនអាចផ្តាច់ទូរស័ព្ទស្កែនមុខបានទេ" : "Failed to unpair phone");
    }
  };

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
    const diffSec = Math.floor((now - ts) / 1000);
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
      const url = currentUserName
        ? `/api/auth/sessions?revokeOthers=true&currentSessionId=${encodeURIComponent(currentBrowserSessionId)}&userName=${encodeURIComponent(currentUserName)}`
        : `/api/auth/sessions?revokeOthers=true&currentSessionId=${encodeURIComponent(currentBrowserSessionId)}`;
      await fetch(url, {
        method: "DELETE",
      });
      toast.success(isKhmer ? "បាន Sign Out គ្រប់ឧបករណ៍ផ្សេងទៀតជោគជ័យ!" : "Signed out all other sessions!");
      fetchLoginSessions();
    } catch {
      toast.error(isKhmer ? "បរាជ័យក្នុងការ Sign Out" : "Failed to sign out other sessions");
    }
  };

  const activeScannerCount = scannerDevices.filter((d) => d.phoneConnected).length;
  const activeFaceCount = faceDevices.length;
  const activeLoginCount = Math.max(loginSessions.length, 1);

  const formatIsoDate = (iso?: string | null) => {
    if (!iso) return isKhmer ? "មិនទាន់ប្រើ" : "Never";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return isKhmer ? "មិនទាន់ប្រើ" : "Never";
      return d.toLocaleDateString(isKhmer ? "km-KH" : "en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isKhmer ? "មិនទាន់ប្រើ" : "Never";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Metric KPI Boxes ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 rounded-2xl bg-surface border border-subtle shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10.5px] font-semibold text-ink-secondary">
              {isKhmer ? "ឧបករណ៍ស្កេន Barcode" : "Connected Scanners"}
            </p>
            <p className="text-base sm:text-lg font-bold text-ink flex items-center gap-1.5 mt-0.5">
              <span>{activeScannerCount} {isKhmer ? "ឧបករណ៍" : "Device"}</span>
              {activeScannerCount > 0 ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
              )}
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-surface border border-subtle shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <ScanFace className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10.5px] font-semibold text-ink-secondary">
              {isKhmer ? "ទូរស័ព្ទស្កែនមុខ Login" : "Face Login Phones"}
            </p>
            <p className="text-base sm:text-lg font-bold text-ink flex items-center gap-1.5 mt-0.5">
              <span>{activeFaceCount} {isKhmer ? "ឧបករណ៍" : "Device"}</span>
              {activeFaceCount > 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold">
                  {isKhmer ? "ភ្ជាប់រួច" : "Paired"}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
              )}
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-surface border border-subtle shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10.5px] font-semibold text-ink-secondary">
              {isKhmer ? "Session Login គណនី" : "Active Login Sessions"}
            </p>
            <p className="text-base sm:text-lg font-bold text-ink flex items-center gap-1.5 mt-0.5">
              <span>{activeLoginCount} {isKhmer ? "ឧបករណ៍" : "Active"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                Online
              </span>
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-surface border border-subtle shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10.5px] font-semibold text-ink-secondary">
              {isKhmer ? "កម្រិតសុវត្ថិភាព Session" : "Session Security"}
            </p>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>JWT & Biometrics</span>
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
              <span>{isKhmer ? "ភ្ជាប់ទូរស័ព្ទស្កេនថ្មី" : "Pair New Scanner"}</span>
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
                    <p className="text-[11px] mt-0.5">{isKhmer ? "ចុចប៊ូតុង «ភ្ជាប់ទូរស័ព្ទស្កេនថ្មី» ខាងលើដើម្បី Scan QR Code" : "Click 'Pair New Scanner' above to scan QR code"}</p>
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

      {/* ── SECTION 2: Paired Face Authentication Devices Table (UserFaceDevices) ── */}
      <div className="rounded-2xl border border-subtle bg-surface shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sunken/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <ScanFace className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2 flex-wrap">
                <span>{isKhmer ? "២. ឧបករណ៍ទូរស័ព្ទ & PC ភ្ជាប់ស្កែនមុខ (Face Authentication Devices)" : "2. Paired Face Authentication Devices"}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 font-semibold">
                  security.UserFaceDevices
                </span>
                {faceStatus?.enrolled ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    {isKhmer ? "បានចុះឈ្មោះមុខរួចរាល់ ✓" : "Face Enrolled ✓"}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500">
                    {isKhmer ? "មិនទាន់ចុះឈ្មោះមុខ" : "Not Enrolled"}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-ink-secondary">
                {isKhmer ? "រាយនាមទូរស័ព្ទ និង PC ដែលបានភ្ជាប់សម្រាប់ស្កែនមុខ Login ជាមួយគណនីរបស់អ្នក" : "List of mobile phones and PCs paired for biometric face authentication login"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 2FA Toggle Switch */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-subtle">
              <span className="text-xs font-semibold text-ink">
                2FA Face:
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={faceStatus?.twoFactorEnabled ?? false}
                disabled={toggling2fa}
                onClick={handleToggle2FA}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  faceStatus?.twoFactorEnabled ? "bg-accent" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    faceStatus?.twoFactorEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent-soft text-accent">
                {faceStatus?.twoFactorEnabled ? (isKhmer ? "បើក" : "ON") : (isKhmer ? "បិទ" : "OFF")}
              </span>
            </div>

            {/* Set up Face with PC Button */}
            <button
              type="button"
              onClick={() => setIsPcFaceModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 hover:bg-accent-hover"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isKhmer ? "ចុះឈ្មោះមុខលើ PC" : "Set up Face with PC"}</span>
            </button>

            {/* Pair New Face Phone Button */}
            <button
              type="button"
              onClick={() => setIsFacePairModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{isKhmer ? "ភ្ជាប់ទូរស័ព្ទស្កែនមុខថ្មី" : "Pair New Face Phone"}</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchFaceDevices}
              className="p-2 rounded-xl border border-subtle bg-surface hover:bg-cushion text-ink-secondary hover:text-ink transition-colors cursor-pointer text-xs font-semibold inline-flex items-center gap-1.5"
              title="Refresh Face Devices"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-subtle bg-sunken/60 text-ink-secondary font-semibold">
                <th className="py-3 px-4">{isKhmer ? "ឈ្មោះឧបករណ៍ (Device / Model)" : "Device / Model"}</th>
                <th className="py-3 px-4">{isKhmer ? "ប្រភេទសុវត្ថិភាព (Security)" : "Security Type"}</th>
                <th className="py-3 px-4">{isKhmer ? "ស្ថានភាព (Status)" : "Status"}</th>
                <th className="py-3 px-4">{isKhmer ? "ថ្ងៃភ្ជាប់ដំបូង (Linked Date)" : "Linked Date"}</th>
                <th className="py-3 px-4">{isKhmer ? "ស្កែន Login ចុងក្រោយ" : "Last Face Login"}</th>
                <th className="py-3 px-4 text-right">{isKhmer ? "សកម្មភាព (Actions)" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {faceDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    <ScanFace className="w-8 h-8 mx-auto mb-2 opacity-40 text-violet-500" />
                    <p className="font-semibold text-ink">{isKhmer ? "មិនទាន់មានទូរស័ព្ទណាបានភ្ជាប់សម្រាប់ស្កែនមុខ Login នៅឡើយទេ" : "No face verification phones paired yet"}</p>
                    <p className="text-[11px] mt-0.5 text-ink-secondary">{isKhmer ? "ចុចប៊ូតុង «ភ្ជាប់ទូរស័ព្ទស្កែនមុខថ្មី» ខាងលើដើម្បី Scan QR Code ចុះឈ្មោះមុខលើទូរស័ព្ទ" : "Click 'Pair New Face Phone' above to scan QR code and link your phone"}</p>
                  </td>
                </tr>
              ) : (
                faceDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-sunken/30 transition-colors">
                    {/* Device Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-ink flex items-center gap-1.5">
                            <span>{device.deviceName || (isKhmer ? "ទូរស័ព្ទដៃ Smartphone" : "Mobile Phone")}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 font-bold">
                              ID: #{device.id}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-ink-secondary">
                            Token: SHA-256 Hashed (Encrypted)
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Biometric Type */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold border border-indigo-500/20">
                        <ScanFace className="w-3.5 h-3.5" />
                        <span>128-float Face Descriptor</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span>{isKhmer ? "សកម្ម & ភ្ជាប់រួច 🟢" : "Active & Paired"}</span>
                      </span>
                    </td>

                    {/* Created At */}
                    <td className="py-3.5 px-4 text-ink-secondary text-[11px] font-medium">
                      {formatIsoDate(device.createdAt)}
                    </td>

                    {/* Last Used At */}
                    <td className="py-3.5 px-4 text-ink text-[11px] font-semibold">
                      {formatIsoDate(device.lastUsedAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleUnpairFaceDevice(device.id, device.deviceName)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                        title="Unpair Face Device"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isKhmer ? "ផ្តាច់ (Unpair)" : "Unpair"}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 3: Active User Login Sessions Table ── */}
      <div className="rounded-2xl border border-subtle bg-surface shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sunken/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                {isKhmer ? "៣. Session គណនីដែលបាន Login (Active Account Login Sessions)" : "3. Active User Login Sessions"}
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

      {/* ── Face Pairing QR Modal ── */}
      <ModalWrapper
        open={isFacePairModalOpen}
        onClose={() => setIsFacePairModalOpen(false)}
        maxWidth="max-w-md"
        placement="center"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-subtle pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <ScanFace className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">
                  {isKhmer ? "ភ្ជាប់ទូរស័ព្ទស្កែនមុខ (Face Authentication Link)" : "Pair Phone for Face Login"}
                </h2>
                <p className="text-xs text-ink-secondary">
                  {isKhmer ? "Scan QR Code ខាងក្រោមដើម្បីចុះឈ្មោះ និងភ្ជាប់ទូរស័ព្ទជាមួយគណនីរបស់អ្នក" : "Scan the QR code below on your phone to link biometric face credentials"}
                </p>
              </div>
            </div>
          </div>

          <FaceLinkQr
            mode="enroll"
            onDone={() => {
              setIsFacePairModalOpen(false);
              fetchFaceDevices();
              toast.success(isKhmer ? "បានភ្ជាប់ទូរស័ព្ទស្កែនមុខជោគជ័យ!" : "Phone paired for face login successfully!");
            }}
            onCancel={() => setIsFacePairModalOpen(false)}
          />
        </div>
      </ModalWrapper>

      {/* ── PC Face Enrolment Modal (Camera Scan) ── */}
      <ModalWrapper
        open={isPcFaceModalOpen}
        onClose={() => setIsPcFaceModalOpen(false)}
        maxWidth="max-w-lg"
        placement="center"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-subtle pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">
                  {isKhmer ? "ចុះឈ្មោះស្កេនមុខលើកុំព្យូទ័រ (PC Face Enrolment)" : "Enroll Face via PC Camera"}
                </h2>
                <p className="text-xs text-ink-secondary">
                  {isKhmer ? "សូមមើលចំកាមេរ៉ា និងងាកបន្តិចបន្តួចដើម្បីចុះឈ្មោះទិន្នន័យមុខ" : "Follow on-screen guidance to capture 3D facial biometrics"}
                </p>
              </div>
            </div>
          </div>

          <FaceCapture
            mode="enroll"
            onComplete={handlePcFaceCaptured}
            onCancel={() => setIsPcFaceModalOpen(false)}
            busy={savingFace}
          />
        </div>
      </ModalWrapper>
    </div>
  );
}
