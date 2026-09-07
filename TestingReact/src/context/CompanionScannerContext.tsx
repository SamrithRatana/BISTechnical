"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import toast from "react-hot-toast";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/LanguageProvider";

interface CompanionScannerContextType {
  sessionId: string;
  mobileUrl: string;
  lanIp: string;
  isPhoneConnected: boolean;
  scanCount: number;
  lastScannedCode: string | null;
  isPairingModalOpen: boolean;
  openPairingModal: () => void;
  closePairingModal: () => void;
  disconnectPhone: () => Promise<void>;
  regenerateSession: () => void;
}

const CompanionScannerContext = createContext<CompanionScannerContextType | null>(null);

const STORAGE_SESSION_KEY = "bis_companion_scanner_session";
const SCANNER_CHANNEL_NAME = "bis_companion_scanner_bus";
const SCANNER_LEADER_KEY = "bis_scanner_leader_tab_id";
const SCANNER_HEARTBEAT_KEY = "bis_scanner_leader_heartbeat";
const TAB_ID = "scan_tab_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = localStorage.getItem(STORAGE_SESSION_KEY) || "";
    if (!sid) {
      sid = "scan-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem(STORAGE_SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "scan-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  }
}

export function CompanionScannerProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const isKhmer = lang === "km";
  const pathname = usePathname();
  const inWorkspace = pathname !== "/login" && pathname !== "/scanner";

  const [sessionId, setSessionId] = useState<string>(() => getOrCreateSessionId());
  const [mobileUrl, setMobileUrl] = useState<string>("");
  const [lanIp, setLanIp] = useState<string>("");
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [scanCount, setScanCount] = useState<number>(0);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isLeaderRef = useRef<boolean>(false);

  const playPcBeep = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1950, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }, []);

  const injectBarcodeIntoActiveInput = useCallback(
    (barcode: string, format?: string) => {
      playPcBeep();
      setLastScannedCode(barcode);
      setScanCount((c) => c + 1);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("companion-barcode-scanned", {
            detail: { barcode, format: format || "CODE_128" },
          })
        );
      }

      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement &&
        activeEl.type !== "hidden" &&
        activeEl.type !== "submit" &&
        activeEl.type !== "button" &&
        activeEl.type !== "checkbox" &&
        activeEl.type !== "radio";
      const isTextarea = activeEl instanceof HTMLTextAreaElement;

      if (isInput || isTextarea) {
        const target = activeEl as HTMLInputElement | HTMLTextAreaElement;
        const proto = isInput ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const valueSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

        if (valueSetter) {
          valueSetter.call(target, barcode);
        } else {
          target.value = barcode;
        }

        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));

        target.classList.add("ring-2", "ring-cyan-400", "transition-all");
        setTimeout(() => {
          target.classList.remove("ring-2", "ring-cyan-400");
        }, 1200);

        toast.success(
          isKhmer
            ? `⚡ បានបំពេញកូដ៖ ${barcode} ចូលទៅក្នុងប្រអប់!`
            : `⚡ Injected ${barcode} into active input!`,
          { duration: 2500, id: `scan-${barcode}` }
        );
      } else {
        toast.success(
          isKhmer
            ? `⚡ ស្កេនបានកូដ៖ ${barcode}`
            : `⚡ Scanned: ${barcode}`,
          { duration: 2500, id: `scan-${barcode}` }
        );
      }
    },
    [isKhmer, playPcBeep]
  );

  function getStoredUserInfo(): { userName?: string; userId?: string } {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("user_info");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        userName: (parsed.userName || parsed.UserName || "") as string,
        userId: (parsed.id || parsed.userId || parsed.Id || "") as string,
      };
    } catch {
      return {};
    }
  }

  const updateMobileUrl = useCallback(
    (sid: string) => {
      if (typeof window === "undefined") return;
      const protocol = window.location.protocol;
      const port = window.location.port ? `:${window.location.port}` : "";
      const hostname = window.location.hostname;
      const { userName } = getStoredUserInfo();
      const userQuery = userName ? `&user=${encodeURIComponent(userName)}` : "";

      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        setMobileUrl(`${protocol}//${hostname}${port}/scanner?session=${sid}${userQuery}`);
        return;
      }

      fetch("/api/scanner/network-ip")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const resolvedIp = data?.primaryIp || data?.ip;
          if (resolvedIp && resolvedIp !== "127.0.0.1") {
            setLanIp(resolvedIp);
            setMobileUrl(`http://${resolvedIp}${port}/scanner?session=${sid}${userQuery}`);
          } else {
            setMobileUrl(`${protocol}//${hostname}${port}/scanner?session=${sid}${userQuery}`);
          }
        })
        .catch(() => {
          setMobileUrl(`${protocol}//${hostname}${port}/scanner?session=${sid}${userQuery}`);
        });
    },
    []
  );

  // Connect SSE only when required (deferred after page load complete)
  const connectSSE = useCallback(
    (sid: string) => {
      if (typeof window === "undefined") return;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (document.readyState !== "complete") {
        window.addEventListener("load", () => connectSSE(sid), { once: true });
        return;
      }

      const { userName, userId } = getStoredUserInfo();
      const userQuery = userName
        ? `&userName=${encodeURIComponent(userName)}&userId=${encodeURIComponent(userId || "")}`
        : "";

    const safeBroadcast = (msg: unknown) => {
      try {
        broadcastChannelRef.current?.postMessage(msg);
      } catch {}
    };

    try {
      const es = new EventSource(`/api/scanner/session?sessionId=${sid}&role=pc${userQuery}`);
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          if (!e.data || e.data.startsWith(":")) return;
          const data = JSON.parse(e.data);

          if (data.type === "phone-joined") {
            setIsPhoneConnected(true);
            safeBroadcast({ type: "PHONE_JOINED" });
            toast.success(
              isKhmer ? "📱 ទូរស័ព្ទបានភ្ជាប់ជោគជ័យ! 🟢" : "📱 Phone Connected! 🟢",
              { duration: 3000, id: "phone-connected-toast" }
            );
          } else if (data.type === "barcode-scanned" && data.barcode) {
            injectBarcodeIntoActiveInput(data.barcode, data.format);
            safeBroadcast({
              type: "BARCODE_SCANNED",
              barcode: data.barcode,
              format: data.format,
            });
          } else if (data.type === "disconnect") {
            setIsPhoneConnected(false);
            safeBroadcast({ type: "PHONE_DISCONNECTED" });
            toast(
              isKhmer ? "📱 ទូរស័ព្ទបានផ្តាច់ការតភ្ជាប់" : "📱 Phone Disconnected",
              { icon: "⚪", duration: 2500 }
            );
          }
        } catch (err) {
          console.error("SSE parsing error:", err);
        }
      };

        es.onerror = () => {};
      } catch {}
    },
    [injectBarcodeIntoActiveInput, isKhmer]
  );

  // Cross-Tab Broadcast Channel
  useEffect(() => {
    if (!inWorkspace || typeof window === "undefined") return;

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(SCANNER_CHANNEL_NAME);
      broadcastChannelRef.current = bc;

      bc.onmessage = (e) => {
        const data = e.data;
        if (!data) return;

        if (data.type === "PHONE_JOINED") {
          setIsPhoneConnected(true);
        } else if (data.type === "PHONE_DISCONNECTED") {
          setIsPhoneConnected(false);
        } else if (data.type === "BARCODE_SCANNED" && data.barcode) {
          injectBarcodeIntoActiveInput(data.barcode, data.format);
        } else if (data.type === "SCANNER_LEADER_RESIGNED" && !isLeaderRef.current) {
          checkLeadership();
        }
      };
    } catch {}

    function checkLeadership() {
      const now = Date.now();
      const currentLeader = localStorage.getItem(SCANNER_LEADER_KEY);
      const lastHeartbeat = Number(localStorage.getItem(SCANNER_HEARTBEAT_KEY)) || 0;

      if (!currentLeader || currentLeader === TAB_ID || now - lastHeartbeat > 3500) {
        isLeaderRef.current = true;
        localStorage.setItem(SCANNER_LEADER_KEY, TAB_ID);
        localStorage.setItem(SCANNER_HEARTBEAT_KEY, now.toString());

        // Always keep background SSE active so phone scans are received even when modal is closed
        const sid = sessionId || getOrCreateSessionId();
        connectSSE(sid);
      }
    }

    checkLeadership();

    const interval = setInterval(() => {
      const now = Date.now();
      if (isLeaderRef.current) {
        localStorage.setItem(SCANNER_HEARTBEAT_KEY, now.toString());
        localStorage.setItem(SCANNER_LEADER_KEY, TAB_ID);
      } else {
        const lastHeartbeat = Number(localStorage.getItem(SCANNER_HEARTBEAT_KEY)) || 0;
        if (now - lastHeartbeat > 3500) {
          checkLeadership();
        }
      }
    }, 1500);

    const onUnload = () => {
      if (isLeaderRef.current) {
        localStorage.removeItem(SCANNER_LEADER_KEY);
        localStorage.removeItem(SCANNER_HEARTBEAT_KEY);
        bc?.postMessage({ type: "SCANNER_LEADER_RESIGNED" });
      }
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onUnload);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      bc?.close();
    };
  }, [inWorkspace, sessionId, isPairingModalOpen, isPhoneConnected, connectSSE, injectBarcodeIntoActiveInput]);

  // When pairing modal opens or when in workspace
  useEffect(() => {
    if (!inWorkspace) return;
    const sid = sessionId || getOrCreateSessionId();
    updateMobileUrl(sid);
    if (isLeaderRef.current && !eventSourceRef.current) {
      connectSSE(sid);
    }
  }, [isPairingModalOpen, inWorkspace, sessionId, connectSSE, updateMobileUrl]);

  // Disconnect phone and terminate remote session
  const disconnectPhone = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch("/api/scanner/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          type: "terminate",
        }),
        keepalive: true,
      });
    } catch {}

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }

    setIsPhoneConnected(false);
    try {
      broadcastChannelRef.current?.postMessage({ type: "PHONE_DISCONNECTED" });
    } catch {}
  }, [sessionId]);

  const regenerateSession = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
    const newSid = getOrCreateSessionId();
    setSessionId(newSid);
    setIsPhoneConnected(false);
    updateMobileUrl(newSid);
    if (isLeaderRef.current) {
      connectSSE(newSid);
    }
    toast.success(
      isKhmer ? "🔄 បានបង្កើត QR Code & Session ថ្មី!" : "🔄 New Session Generated!",
      { duration: 2500 }
    );
  }, [updateMobileUrl, connectSSE, isKhmer]);

  const openPairingModal = useCallback(() => {
    updateMobileUrl(sessionId);
    setIsPairingModalOpen(true);
  }, [sessionId, updateMobileUrl]);

  const closePairingModal = useCallback(() => {
    setIsPairingModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      sessionId,
      mobileUrl,
      lanIp,
      isPhoneConnected,
      scanCount,
      lastScannedCode,
      isPairingModalOpen,
      openPairingModal,
      closePairingModal,
      disconnectPhone,
      regenerateSession,
    }),
    [
      sessionId,
      mobileUrl,
      lanIp,
      isPhoneConnected,
      scanCount,
      lastScannedCode,
      isPairingModalOpen,
      openPairingModal,
      closePairingModal,
      disconnectPhone,
      regenerateSession,
    ]
  );

  return (
    <CompanionScannerContext.Provider value={value}>
      {children}
    </CompanionScannerContext.Provider>
  );
}

export function useCompanionScanner() {
  const context = useContext(CompanionScannerContext);
  if (!context) {
    throw new Error("useCompanionScanner must be used within a CompanionScannerProvider");
  }
  return context;
}
