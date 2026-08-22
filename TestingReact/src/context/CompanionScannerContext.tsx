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

export function CompanionScannerProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  const [sessionId, setSessionId] = useState<string>("");
  const [mobileUrl, setMobileUrl] = useState<string>("");
  const [lanIp, setLanIp] = useState<string>("");
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [scanCount, setScanCount] = useState<number>(0);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Web Audio Synthetic High-Tone PC Confirmation Beep
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
    } catch {
      // Audio not permitted yet
    }
  }, []);

  // ── Global Active Element Injector (Virtual Hardware Scanner) ──
  const injectBarcodeIntoActiveInput = useCallback(
    (barcode: string, format?: string) => {
      playPcBeep();
      setLastScannedCode(barcode);
      setScanCount((c) => c + 1);

      // Broadcast custom event for pages / dialogs with specific listeners
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

        // Dispatch synthetic React input & change events
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));

        // Subtle green flash highlight on the active field
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

  // Initialize or restore persistent session ID from localStorage
  const initSession = useCallback(() => {
    let sid = "";
    if (typeof window !== "undefined") {
      sid = localStorage.getItem(STORAGE_SESSION_KEY) || "";
      if (!sid) {
        sid = "scan-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        localStorage.setItem(STORAGE_SESSION_KEY, sid);
      }
    } else {
      sid = "scan-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    }
    setSessionId(sid);
    return sid;
  }, []);

  // Update mobile URL with actual LAN IP (in local dev) or Public Domain (in Production)
  const updateMobileUrl = useCallback(
    (sid: string) => {
      const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const port = typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : "";
      const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";

      // 1. In Production (or custom domain): directly use the current origin with zero latency
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        setMobileUrl(`${protocol}//${hostname}${port}/scanner?session=${sid}`);
        return;
      }

      // 2. In Local Development: resolve primary Wi-Fi LAN IP so phone on same Wi-Fi can connect
      fetch("/api/scanner/network-ip")
        .then((res) => res.json())
        .then((data) => {
          const ip = data?.primaryIp || hostname;
          setLanIp(ip);
          const targetHost =
            (hostname === "localhost" || hostname === "127.0.0.1") && ip !== "127.0.0.1"
              ? ip
              : hostname;
          setMobileUrl(`${protocol}//${targetHost}${port}/scanner?session=${sid}`);
        })
        .catch(() => {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          setMobileUrl(`${origin}/scanner?session=${sid}`);
        });
    },
    []
  );

  // Connect background SSE stream for persistent session
  const connectSSE = useCallback(
    (sid: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (!sid) return;

      const es = new EventSource(`/api/scanner/session?sessionId=${sid}&role=pc`);
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          if (!e.data || e.data.startsWith(":")) return;
          const data = JSON.parse(e.data);

          if (data.type === "phone-joined") {
            setIsPhoneConnected(true);
            toast.success(
              isKhmer ? "📱 ទូរស័ព្ទបានភ្ជាប់ជោគជ័យ! 🟢" : "📱 Phone Connected! 🟢",
              { duration: 3000, id: "phone-connected-toast" }
            );
          } else if (data.type === "barcode-scanned" && data.barcode) {
            injectBarcodeIntoActiveInput(data.barcode, data.format);
          } else if (data.type === "disconnect") {
            setIsPhoneConnected(false);
            toast(
              isKhmer ? "📱 ទូរស័ព្ទបានផ្តាច់ការតភ្ជាប់" : "📱 Phone Disconnected",
              { icon: "⚪", duration: 2500 }
            );
          }
        } catch (err) {
          console.error("SSE parsing error:", err);
        }
      };

      es.onerror = () => {
        // Automatic reconnection is handled by browser EventSource
      };
    },
    [injectBarcodeIntoActiveInput, isKhmer]
  );

  // Start persistent session on mount
  useEffect(() => {
    const sid = initSession();
    updateMobileUrl(sid);
    connectSSE(sid);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [initSession, updateMobileUrl, connectSSE]);

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
    } catch {
      // Ignore
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }

    setIsPhoneConnected(false);
    setLastScannedCode(null);
    setScanCount(0);

    // Fresh session ID for this browser tab
    const newSid = "scan-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_SESSION_KEY, newSid);
    }
    setSessionId(newSid);
    updateMobileUrl(newSid);
    connectSSE(newSid);

    toast.success(isKhmer ? "បានផ្តាច់ទូរស័ព្ទរួចរាល់" : "Phone unlinked");
  }, [sessionId, isKhmer, updateMobileUrl, connectSSE]);

  // Regenerate session ID (Force re-pair)
  const regenerateSession = useCallback(() => {
    disconnectPhone();
  }, [disconnectPhone]);

  const openPairingModal = useCallback(() => {
    setIsPairingModalOpen(true);
  }, []);

  const closePairingModal = useCallback(() => {
    setIsPairingModalOpen(false);
  }, []);

  const contextValue = useMemo(
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
    <CompanionScannerContext.Provider value={contextValue}>
      {children}
    </CompanionScannerContext.Provider>
  );
}

export function useCompanionScanner() {
  const context = useContext(CompanionScannerContext);
  if (!context) {
    throw new Error("useCompanionScanner must be used within CompanionScannerProvider");
  }
  return context;
}
