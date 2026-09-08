"use client";

/**
 * @file app/login/page.tsx
 * @description The sign-in stage — orchestration only. State, the five-stage
 * pipeline and the per-method auth flows live in hooks; every visual lives in
 * `src/components/login/` (Prismwell: a volumetric light-well — accent triad
 * via `color.ts`, pointer-steered chromatic card rim, translateZ strata with
 * front shards, depth-ring backdrop, prismatic-shear curtain).
 *
 * Like `/download`, this public zone is deliberately NOT on the `--av-*`
 * token system — it keeps its own dark marketing look. Motion collapses to a
 * static composition under reduced-motion / Lite Mode via
 * `useLoginMotionMode`.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { publishBrandLogo } from "@/services/brandLogoStore";
import { fetchGlobalBranding } from "@/services/appSettings";
import { isTokenExpired, readToken } from "@/services/authSession";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuthMethod, type AuthMethod } from "@/components/login/authMethodStore";
import { deriveHolo } from "@/components/login/color";
import { useLoginMotionMode } from "@/components/login/useLoginMotionMode";
import { useLoginTilt } from "@/components/login/useLoginTilt";
import { useLoginPipeline } from "@/components/login/useLoginPipeline";
import { useAuthFlows } from "@/components/login/useAuthFlows";
import CardAtmosphere from "@/components/login/CardAtmosphere";
import CardRim from "@/components/login/CardRim";
import LoginBackdrop from "@/components/login/LoginBackdrop";
import LoginStage from "@/components/login/LoginStage";
import PipelineOverlay from "@/components/login/PipelineOverlay";
import ShowcaseCurtain from "@/components/login/ShowcaseCurtain";
import SignInColumn from "@/components/login/SignInColumn";
import MethodDeck from "@/components/login/MethodDeck";
import { LoginFooter, LoginTopBar, MobileMethodHeader } from "@/components/login/LoginChrome";

export default function LoginPage() {
  const router = useRouter();
  const { prefs, isDark } = useTheme();
  const accentHex = prefs.accentColor || "#10b981";
  // The prism: one accent in, a hue-shifted triad out (see login/color.ts).
  const holo = useMemo(() => deriveHolo(accentHex), [accentHex]);
  const motionMode = useLoginMotionMode();

  // Curtain mode: "signin" (form active) | "method_selector" (choose method)
  const [mode, setMode] = useState<"signin" | "method_selector">("signin");
  const [authMethod, setAuthMethod] = useAuthMethod();

  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const pipeline = useLoginPipeline();
  const flows = useAuthFlows(pipeline);

  // The tilt rig is frozen while a QR or the camera is on screen — a QR
  // rasterized under a 3D transform can stop scanning (download-page rule).
  const qrOrCameraVisible =
    !!flows.faceStage || (mode === "signin" && authMethod === "phone");
  const rig = useLoginTilt(motionMode !== "full" || qrOrCameraVisible);

  // Global branding (logo) — shared store, harmless after unmount.
  useEffect(() => {
    fetchGlobalBranding()
      .then((b) => {
        if (b?.logoUrl) publishBrandLogo(b.logoUrl);
      })
      .catch(() => {});
  }, []);

  // Already holding a valid JWT? Straight to the dashboard.
  useEffect(() => {
    const token = typeof window !== "undefined" ? readToken() : null;
    if (token && !isTokenExpired(token)) {
      router.replace("/");
    }
  }, [router]);

  const openSelector = () => {
    pipeline.setErrorMsg("");
    // Leaving the face stage for the selector must release the camera — the
    // column is only hidden by CSS, so an active FaceCapture would otherwise
    // keep the light on with no UI attached.
    flows.cancelFaceStage();
    setMode("method_selector");
  };

  const handleSelectMethod = (methodId: AuthMethod) => {
    setAuthMethod(methodId);
    pipeline.setErrorMsg("");
    setMode("signin");
  };

  const handlePersona = (user: string, pass: string) => {
    setUserName(user);
    setPassword(pass);
    pipeline.setErrorMsg("");
    setAuthMethod("password");
  };

  const goToDownload = () => router.push("/download");

  return (
    /* `clip` not `hidden`: an overflow-hidden ancestor flattens the 3D rig
       (the download page root uses overflow-x-clip for the same reason). */
    <div className="min-h-screen h-screen w-full bg-[#f1f5f9] dark:bg-[#03060c] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-between lg:justify-center p-1.5 sm:p-2.5 lg:p-3 xl:p-6 relative overflow-x-clip overflow-y-auto font-sans select-none transition-colors duration-300">
      <LoginBackdrop
        mode={motionMode}
        curtainSide={mode === "signin" ? "right" : "left"}
        frozen={qrOrCameraVisible}
        springPx={rig.springPx}
        springPy={rig.springPy}
        holo={holo}
      />

      <PipelineOverlay
        step={pipeline.pipelineStep}
        logs={pipeline.pipelineLogs}
        errorNodeId={pipeline.errorNodeId}
        holo={holo}
      />

      <LoginTopBar />

      <LoginStage mode={motionMode} rig={rig} holo={holo}>
        {/* Rim host: the chromatic underlays sit 1px proud of the card, so
            they live OUTSIDE the card's own overflow clip */}
        <div className="relative rounded-2xl sm:rounded-3xl">
          <CardRim rig={rig} holo={holo} mode={motionMode} frozen={qrOrCameraVisible} flipKey={mode} />
          <div
            className="w-full bg-white dark:bg-gradient-to-b dark:from-[#0c1526] dark:via-[#0a111f] dark:to-[#0b1424] border border-slate-300/80 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl overflow-hidden relative flex flex-col transition-colors duration-300"
            style={{
              boxShadow: isDark
                ? `0 30px 90px -15px rgba(0,0,0,0.9), 0 0 40px ${holo.a}14`
                : "0 25px 65px -12px rgba(15, 23, 42, 0.14), 0 10px 24px -6px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.08)",
            }}
          >
          {/* Faint accent wash so the form side reads lit, not flat */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: isDark
                ? `radial-gradient(circle at 18% -10%, ${holo.a}14, transparent 55%)`
                : `radial-gradient(circle at 18% -10%, ${holo.a}08, transparent 40%)`,
            }}
          />

          {/* Interference lobes, film grain and the rim beam */}
          <CardAtmosphere rig={rig} holo={holo} mode={motionMode} frozen={qrOrCameraVisible} />

          {/* Edge lights: crisp specular top rim, triad bottom rim in dark mode */}
          <div className="pointer-events-none absolute top-0 inset-x-10 h-px bg-gradient-to-r from-transparent via-slate-200/70 dark:via-white/35 to-transparent z-30" />
          <div
            className="pointer-events-none absolute bottom-0 inset-x-16 h-px z-30 hidden dark:block"
            style={{
              background: `linear-gradient(to right, transparent, ${holo.a}59 35%, ${holo.b}47 65%, transparent)`,
            }}
          />

          <MobileMethodHeader
            selectorOpen={mode === "method_selector"}
            /* Opening MUST go through openSelector — it releases an active
               face-capture camera and clears the error banner; the column is
               only hidden by CSS, so a bare setMode would leave the camera
               light on with no UI attached. */
            onToggle={() => (mode === "signin" ? openSelector() : setMode("signin"))}
          />

          {/* Sliding body: two columns under the travelling curtain. The
              perspective is what lets the curtain's rotateY hinge actually
              project — without it the turn renders orthographic (a ~0.4%
              squash, i.e. invisible). */}
          <div className="relative flex-1 flex flex-col lg:flex-row min-h-0 lg:min-h-[390px] xl:min-h-[460px] overflow-hidden [perspective:1200px]">
            {/* Left: active sign-in form */}
            <div
              className={`w-full lg:w-1/2 p-3 sm:p-4 lg:p-4 xl:p-6 flex-col justify-center relative z-10 transition-opacity duration-300 ${
                mode === "method_selector"
                  ? "hidden lg:flex lg:invisible lg:pointer-events-none lg:opacity-0"
                  : "flex lg:visible lg:opacity-100"
              }`}
            >
              <SignInColumn
                authMethod={authMethod}
                motionMode={motionMode}
                holo={holo}
                pipeline={pipeline}
                flows={flows}
                userName={userName}
                password={password}
                showPassword={showPassword}
                onUserNameChange={setUserName}
                onPasswordChange={setPassword}
                onToggleShowPassword={() => setShowPassword((v) => !v)}
                onOpenSelector={openSelector}
                onDownload={goToDownload}
                onPersona={handlePersona}
                onPhoneCancel={() => setAuthMethod("password")}
              />
            </div>

            {/* Right: method selector deck */}
            <div
              className={`w-full lg:w-1/2 p-3 sm:p-4 lg:p-4 xl:p-6 flex-col justify-center relative z-10 transition-opacity duration-300 ${
                mode === "signin"
                  ? "hidden lg:flex lg:invisible lg:pointer-events-none lg:opacity-0"
                  : "flex lg:visible lg:opacity-100"
              }`}
            >
              <MethodDeck
                authMethod={authMethod}
                mode={motionMode}
                holo={holo}
                onSelect={handleSelectMethod}
                onDownload={goToDownload}
                onBackMobile={() => setMode("signin")}
              />
            </div>

            <ShowcaseCurtain
              selectorOpen={mode === "method_selector"}
              mode={motionMode}
              holo={holo}
              onBack={() => setMode("signin")}
            />
          </div>
          </div>
        </div>
      </LoginStage>

      <LoginFooter />
    </div>
  );
}
