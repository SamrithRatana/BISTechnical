"use client";

import React, { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  Camera,
  Flashlight,
  FlashlightOff,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Sparkles,
  RefreshCw,
  Smartphone,
  Laptop,
  Radio,
  Zap,
  UploadCloud,
  Image as ImageIcon,
  Check,
  HelpCircle,
  X,
  Video,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";

function ScannerContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || searchParams.get("sessionId") || "";

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLiveStreamSupported, setIsLiveStreamSupported] = useState<boolean>(true);
  const [activeMode, setActiveMode] = useState<"live" | "photo">("live");
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<Array<{ code: string; time: string }>>([]);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isTerminated, setIsTerminated] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>("");
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const isScanningRef = useRef<boolean>(true);
  const lastCodeTimeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  // Web Audio Synthetic High-Pitch Confirmation Beep
  const playBeep = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1850, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio not permitted yet
    }
  }, []);

  // Notify PC that phone has joined this session and listen for termination
  useEffect(() => {
    if (!sessionId) return;

    fetch("/api/scanner/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        type: "join",
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          setIsJoined(true);
        } else if (res.status === 410 || res.status === 404) {
          // Session does not exist on PC or was terminated!
          setIsTerminated(true);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to join session:", err);
      });

    // Listen for PC logout / session termination
    const es = new EventSource(`/api/scanner/session?sessionId=${sessionId}`);
    es.onmessage = (e) => {
      try {
        if (!e.data || e.data.startsWith(":")) return;
        const data = JSON.parse(e.data);
        if (data.type === "terminate") {
          setIsTerminated(true);
          // Stop camera stream immediately
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
        }
      } catch {}
    };

    es.onerror = () => {
      // Check if session has been closed on PC
      fetch(`/api/scanner/session?sessionId=${sessionId}`)
        .then((res) => {
          if (res.status === 410 || res.status === 404) {
            setIsTerminated(true);
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
            }
          }
        })
        .catch(() => {});
    };

    return () => {
      es.close();
    };
  }, [sessionId]);

  // Handle scanned barcode with double confirmation and transmission
  const handleBarcodeDetected = useCallback(
    async (rawCode: string, formatName?: string) => {
      const clean = rawCode.trim();
      if (!clean) return;

      const now = Date.now();
      // Debounce repeat identical scans within 1.5 seconds
      if (lastCodeTimeRef.current.code === clean && now - lastCodeTimeRef.current.time < 1500) {
        return;
      }
      lastCodeTimeRef.current = { code: clean, time: now };

      // Haptic Vibration & Beep
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40]);
      }
      playBeep();

      setLastScanned(clean);
      setScanHistory((prev) => [
        { code: clean, time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 9),
      ]);

      if (!sessionId) return;

      setIsSending(true);
      try {
        const res = await fetch("/api/scanner/emit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            type: "scan",
            barcode: clean,
            format: formatName || "CODE_128",
          }),
        });

        if (res.status === 410 || res.status === 404) {
          setIsTerminated(true);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
        }
      } catch (err) {
        console.error("Transmit error:", err);
      } finally {
        setTimeout(() => setIsSending(false), 300);
      }
    },
    [sessionId, playBeep]
  );

  // ── Decode Barcode from Photo File (Works in HTTP without SSL and Snapshot Mode) ──
  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
      const imgUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = imgUrl;

      img.onload = async () => {
        let detected = false;

        // 1. Try Native BarcodeDetector if available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const NativeBarcodeDetector = (window as any).BarcodeDetector;
        if (NativeBarcodeDetector) {
          try {
            const detector = new NativeBarcodeDetector({
              formats: [
                "code_128",
                "code_39",
                "ean_13",
                "ean_8",
                "qr_code",
                "data_matrix",
                "itf",
                "upc_a",
                "upc_e",
              ],
            });
            const barcodes = await detector.detect(img);
            if (barcodes?.length && barcodes[0]?.rawValue) {
              handleBarcodeDetected(barcodes[0].rawValue, barcodes[0].format);
              detected = true;
            }
          } catch (err) {
            console.warn("Native file decode failed:", err);
          }
        }

        // 2. Fallback to ZXing
        if (!detected) {
          try {
            const reader = new BrowserMultiFormatReader();
            const result = await reader.decodeFromImageUrl(imgUrl);
            if (result) {
              handleBarcodeDetected(result.getText(), result.getBarcodeFormat().toString());
              detected = true;
            }
          } catch (err) {
            console.warn("ZXing file decode failed:", err);
          }
        }

        URL.revokeObjectURL(imgUrl);
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
        setIsProcessingImage(false);

        if (!detected) {
          alert("មិនអាចចាប់ Barcode លើរូបភាពនេះបានទេ សូមសាកល្បងថតឱ្យជិត និងច្បាស់ជាងនេះបន្តិច");
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(imgUrl);
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
        setIsProcessingImage(false);
      };
    } catch (err) {
      console.error("File processing error:", err);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      setIsProcessingImage(false);
    }
  };

  // Initialize Live Video Stream (when in Live mode and supported)
  useEffect(() => {
    if (activeMode !== "live") {
      // Release camera stream when user switches to Photo Mode
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let active = true;
    isScanningRef.current = true;

    async function initCamera() {
      // Check if getUserMedia is available in current browser context (requires HTTPS or Localhost)
      if (!navigator?.mediaDevices?.getUserMedia) {
        setIsLiveStreamSupported(false);
        setActiveMode("photo");
        setHasPermission(true);
        return;
      }

      try {
        setErrorMsg(null);
        setIsLiveStreamSupported(true);

        // Request back camera with graceful fallback
        const stream = await (async () => {
          try {
            return await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch {
            try {
              return await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false,
              });
            } catch {
              try {
                return await navigator.mediaDevices.getUserMedia({
                  video: { facingMode: "user" },
                  audio: false,
                });
              } catch {
                return await navigator.mediaDevices.getUserMedia({
                  video: true,
                  audio: false,
                });
              }
            }
          }
        })();

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        videoTrackRef.current = videoTrack;

        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities?.() || {}) as { torch?: boolean };
          if (capabilities.torch) {
            setTorchSupported(true);
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setHasPermission(true);

        // Native BarcodeDetector Loop
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const NativeBarcodeDetector = (window as any).BarcodeDetector;
        if (NativeBarcodeDetector) {
          try {
            const detector = new NativeBarcodeDetector({
              formats: [
                "code_128",
                "code_39",
                "ean_13",
                "ean_8",
                "qr_code",
                "data_matrix",
                "itf",
                "upc_a",
                "upc_e",
              ],
            });

            const scanNativeLoop = async () => {
              if (!active || !isScanningRef.current) return;
              if (videoRef.current && videoRef.current.readyState >= 2) {
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0) {
                    const first = barcodes[0];
                    if (first.rawValue) {
                      handleBarcodeDetected(first.rawValue, first.format);
                    }
                  }
                } catch {
                  // Frame dropped
                }
              }
              if (active) {
                requestAnimationFrame(scanNativeLoop);
              }
            };

            requestAnimationFrame(scanNativeLoop);
            return;
          } catch (nativeErr) {
            console.warn("Native BarcodeDetector fallback to ZXing:", nativeErr);
          }
        }

        // Fallback: ZXing Multi-Format Reader
        const reader = new BrowserMultiFormatReader();
        zxingReaderRef.current = reader;

        if (videoRef.current) {
          reader.decodeFromVideoElement(videoRef.current, (result) => {
            if (!active || !isScanningRef.current) return;
            if (result) {
              handleBarcodeDetected(result.getText(), result.getBarcodeFormat().toString());
            }
          });
        }
      } catch (err: unknown) {
        if (!active) return;
        console.warn("Live stream init failed, falling back to snapshot mode:", err);
        setIsLiveStreamSupported(false);
        setActiveMode("photo");
        setHasPermission(true);
      }
    }

    initCamera();

    // ── Zero Memory Leak Cleanup ──
    return () => {
      active = false;
      isScanningRef.current = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          streamRef.current?.removeTrack(track);
        });
        streamRef.current = null;
      }
      videoTrackRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (zxingReaderRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (zxingReaderRef.current as any).reset?.();
        } catch {
          // Ignore
        }
        zxingReaderRef.current = null;
      }
    };
  }, [activeMode, handleBarcodeDetected]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!videoTrackRef.current) return;
    try {
      const next = !torchOn;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (videoTrackRef.current as any).applyConstraints({
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch (err) {
      console.warn("Torch failed:", err);
    }
  };

  if (isTerminated) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4 animate-pulse">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-white mb-1.5">
          PC Session បានបញ្ចប់ (Session Disconnected)
        </h2>
        <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
          កុំព្យូទ័រ PC បាន Logout ឬបានផ្តាច់ការតភ្ជាប់ទូរស័ព្ទនេះរួចរាល់ហើយ។ សូម Scan QR Code ថ្មីនៅលើ PC ដើម្បីភ្ជាប់ឡើងវិញ។
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/30 active:scale-95 transition-all"
        >
          ភ្ជាប់សារជាថ្មី (Reconnect)
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col justify-between select-none overflow-hidden touch-none">
      {/* Hidden File Inputs for Direct Camera & Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileCapture}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileCapture}
        className="hidden"
      />

      {/* ── Top Bar ── */}
      <div className="z-30 flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Companion Scanner</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              {sessionId ? (
                isJoined ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    ភ្ជាប់ជាមួយ PC រួចរាល់
                  </span>
                ) : (
                  <span className="text-amber-400">កំពុងភ្ជាប់...</span>
                )
              ) : (
                <span className="text-rose-400">គ្មាន Session ID</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode Switcher / Help Button */}
          {isLiveStreamSupported && (
            <button
              type="button"
              onClick={() => setActiveMode(activeMode === "live" ? "photo" : "live")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 ${
                activeMode === "photo"
                  ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/30"
                  : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25"
              }`}
              title={activeMode === "live" ? "ប្តូរទៅ Mode ថតរូប (Photo Mode)" : "ត្រឡប់ទៅ Live Video"}
            >
              {activeMode === "live" ? (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  <span>Photo Mode</span>
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span>Live Video</span>
                </>
              )}
            </button>
          )}

          {/* Help Info Button */}
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="p-2 rounded-xl bg-white/10 border border-white/15 text-slate-300 hover:text-white active:scale-95 transition-all"
            aria-label="Help"
            title="ជំនួយ (Help)"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          {/* Flashlight Button */}
          {torchSupported && isLiveStreamSupported && activeMode === "live" && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${
                torchOn
                  ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/30"
                  : "bg-white/10 text-slate-300 border-white/15"
              }`}
              aria-label="Toggle Torch"
            >
              {torchOn ? <Flashlight className="w-3.5 h-3.5" /> : <FlashlightOff className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Main Viewport Area ── */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden p-4">
        {/* Mode 1: Live Video Stream */}
        {activeMode === "live" && isLiveStreamSupported ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Viewfinder Overlay Box */}
            <div className="relative z-10 w-[78vw] max-w-[320px] aspect-4/3 rounded-3xl border-2 border-cyan-400/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] flex flex-col justify-between p-3 pointer-events-none">
              {/* Laser Scan Line Animation */}
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-scan-laser pointer-events-none" />

              {/* Viewfinder Corners */}
              <div className="flex justify-between items-start">
                <span className="w-5 h-5 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl" />
                <span className="w-5 h-5 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl" />
              </div>
              <div className="flex justify-between items-end">
                <span className="w-5 h-5 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl" />
                <span className="w-5 h-5 border-b-4 border-r-4 border-cyan-400 rounded-br-xl" />
              </div>
            </div>

            {/* Small Floating Hint to switch to Photo Mode */}
            <button
              type="button"
              onClick={() => setActiveMode("photo")}
              className="absolute bottom-4 z-20 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-cyan-300 text-[11px] font-semibold flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Barcode រលុប/ពិបាកស្កេន? ចុចប្រើ Photo Mode 📸</span>
            </button>
          </>
        ) : (
          /* Mode 2: Instant Photo Camera Snapshot Mode */
          <div className="relative z-10 w-full max-w-sm flex flex-col items-center justify-center text-center p-5 rounded-3xl bg-slate-900/90 border border-white/15 backdrop-blur-xl shadow-2xl space-y-3.5">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Camera className="w-7 h-7" />
            </div>

            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
                <span>Photo Capture Scanner</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-bold">
                  Snap Mode
                </span>
              </h2>
              <p className="text-[11.5px] text-slate-400 leading-relaxed">
                ថតរូប Barcode ដោយផ្ទាល់ ឬជ្រើសរូបភាពពី Album ក្នុងទូរស័ព្ទ
              </p>
            </div>

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessingImage}
                className="py-3 px-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/30 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-5 h-5" />
                <span>{isProcessingImage ? "កំពុងអាន..." : "ថតរូប Camera 📸"}</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isProcessingImage}
                className="py-3 px-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/15 font-bold text-xs flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <ImageIcon className="w-5 h-5 text-cyan-400" />
                <span>រូបភាព Album 🖼️</span>
              </button>
            </div>

            {/* Back to Live Mode Button */}
            {isLiveStreamSupported && (
              <button
                type="button"
                onClick={() => setActiveMode("live")}
                className="w-full py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Video className="w-3.5 h-3.5" />
                <span>ត្រឡប់ទៅ Live Scanner (Live Mode)</span>
              </button>
            )}

            {/* Simulation / Manual Input Test */}
            <div className="w-full pt-2.5 border-t border-white/10 space-y-1.5">
              <p className="text-[10.5px] font-semibold text-slate-400 text-left flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>ឬបញ្ចូលកូដដោយដៃ (Manual Input):</span>
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="ឧ. RM2-5405-000CN"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-white/10 border border-white/15 rounded-xl text-white outline-none focus:border-cyan-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && manualCode.trim()) {
                      handleBarcodeDetected(manualCode.trim(), "MANUAL_TEST");
                      setManualCode("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (manualCode.trim()) {
                      handleBarcodeDetected(manualCode.trim(), "MANUAL_TEST");
                      setManualCode("");
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
                >
                  Send ⚡
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transmission Flash Pill */}
        {isSending && (
          <div className="absolute top-6 z-20 px-4 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/50 flex items-center gap-1.5 animate-bounce">
            <Zap className="w-3.5 h-3.5" />
            <span>បានបាញ់ចូល PC! ⚡</span>
          </div>
        )}
      </div>

      {/* ── Bottom Scanned Panel ── */}
      <div className="z-30 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 p-3.5 space-y-2.5 shrink-0">
        {/* Latest Scanned Result */}
        {lastScanned ? (
          <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9.5px] text-slate-400 font-semibold uppercase tracking-wider">
                  កូដចុងក្រោយដែលបាន Scan
                </p>
                <p className="text-xs font-mono font-bold text-cyan-300 truncate">
                  {lastScanned}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 text-[10.5px] font-mono text-slate-300 shrink-0">
              <Laptop className="w-3 h-3 text-cyan-400" />
              <span>Synced</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-0.5">
            <p className="text-[11.5px] font-semibold text-slate-300 flex items-center justify-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              {activeMode === "live"
                ? "តម្រង់ Camera លើ Barcode គ្រឿងបន្លាស់"
                : "ចុចប៊ូតុងខាងលើដើម្បីថតរូបស្កេន Barcode"}
            </p>
          </div>
        )}

        {/* Scan History Chips */}
        {scanHistory.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {scanHistory.slice(1, 5).map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 shrink-0"
              >
                <span>{item.code}</span>
                <span className="text-[8.5px] text-slate-500">{item.time}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Help & Instructions Modal ── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/15 p-5 space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">របៀបប្រើប្រាស់ Scanner (Help)</h3>
                  <p className="text-[10px] text-slate-400">គន្លឹះស្កេន Barcode ឱ្យបានលឿន និងត្រឹមត្រូវ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-xl bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <Video className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-[11px]">១. Live Stream Mode (ស្កេនផ្ទាល់)</p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    តម្រង់កាមេរ៉ាចំ Barcode វានឹងស្កេនស្វ័យប្រវត្តិកម្រិត &lt; 10ms។
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <Camera className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-[11px]">២. Photo Capture Mode (ថតរូប)</p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    ប្រើពេល Barcode រលុប រហែក ឬក្នុងទីងងឹត។ ចុចថតរូបឱ្យជិតច្បាស់ ប្រព័ន្ធនឹងអានកូដជូនភ្លាមៗ។
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-[11px]">៣. វាយបញ្ចូលកូដដោយដៃ (Manual Input)</p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    វាយលេខកូដក្នុងប្រអប់ Manual Test រួចចុច Send ដើម្បីបាញ់ចូល PC។
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              យល់ព្រម (Got it)
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scanLaser {
          0% {
            top: 6%;
            opacity: 0.2;
          }
          50% {
            top: 92%;
            opacity: 1;
          }
          100% {
            top: 6%;
            opacity: 0.2;
          }
        }
        .animate-scan-laser {
          animation: scanLaser 2.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function MobileScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-slate-950 text-white flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-3 border-cyan-400 border-t-transparent animate-spin" />
            <p className="text-xs font-semibold text-slate-400">កំពុងដំណើរការ Scanner...</p>
          </div>
        </div>
      }
    >
      <ScannerContent />
    </Suspense>
  );
}
