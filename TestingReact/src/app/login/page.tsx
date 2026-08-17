"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Lock, User, Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import { loginUser } from "@/services/api";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { useI18n } from "@/i18n/LanguageProvider";

export default function LoginPage() {
  const router = useRouter();
  const later = useSafeTimeout();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);
  const { t } = useI18n();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await loginUser(userName, password);
      if (res.isSuccess && res.token) {
        localStorage.setItem("jwt_token", res.token);
        sessionStorage.removeItem("robot_greeted");
        if (res.user) {
          localStorage.setItem("user_info", JSON.stringify(res.user));
        }
        // Trigger split-apart animation before navigating
        setLoginSuccess(true);
        // Lets the split-apart animation play before routing. Cancelled
        // on unmount so a navigation cannot fire from a dead component.
        later(() => {
          router.push("/");
        }, 550);
      } else {
        setErrorMsg(res.message || t("login.failed"));
      }
    } catch (err: any) {
      setErrorMsg(t("login.connectFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-ink flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background ambient lighting.
          Static on purpose. These two both carried `animate-login-glow-pulse`,
          an infinite opacity+scale loop — and a scale on a `blur-3xl` element
          invalidates the blurred raster every frame, so a 384px and a 320px
          Gaussian blur were being recomputed continuously for as long as
          anyone sat on the login screen. Held static they are blurred once and
          cached, and the glow reads exactly the same. */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-info/10 rounded-full blur-3xl pointer-events-none" />

      <div className={`w-full max-w-md bg-ink/80 border border-subtle rounded-3xl shadow-2xl backdrop-blur-xl p-8 space-y-6 relative z-10 ${
        loginSuccess ? "animate-login-split-up" : ""
      }`}>
        {/* Brand Header - Slides in from the left */}
        <div className={`text-center space-y-2 ${
          loginSuccess ? "animate-login-split-left" : "animate-login-slide-left"
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent to-accent-hover flex items-center justify-center text-white mx-auto shadow-lg shadow-accent/25">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">{t("login.brandTitle")}</h1>
          <p className="text-xs text-ink-muted">{t("login.brandSubtitle")}</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-danger-soft/60 border border-danger/80 text-danger-fg text-xs flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form - Slides in from the right */}
        <form onSubmit={handleLogin} className={`space-y-4 ${
          loginSuccess ? "animate-login-split-right" : "animate-login-slide-right"
        }`} style={{ animationDelay: loginSuccess ? "0s" : "0.15s" }}>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted">{t("login.username")}</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-secondary" />
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder={t("login.usernamePlaceholder")}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-ink/80 border border-subtle/80 rounded-xl text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted">{t("login.password")}</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-secondary" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.passwordPlaceholder")}
                className="w-full pl-10 pr-10 py-2.5 text-xs bg-ink/80 border border-subtle/80 rounded-xl text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-muted transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-ink-muted pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-subtle bg-ink text-info focus:ring-0"
              />
              <span>{t("login.rememberMe")}</span>
            </label>
            <span className="text-info hover:underline cursor-pointer">{t("login.forgotPassword")}</span>
          </div>

          <button
            type="submit"
            disabled={isLoading || loginSuccess}
            className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition-all shadow-lg shadow-accent/25 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? t("login.signingIn") : loginSuccess ? "✓" : t("login.signInToPortal")}</span>
          </button>
        </form>

        {/* Demo Credentials Footer - Slides up from below */}
        <div className={`pt-2 text-center border-t border-subtle/80 ${
          loginSuccess ? "animate-login-split-left" : "animate-login-slide-up"
        }`} style={{ animationDelay: loginSuccess ? "0.05s" : "0.3s" }}>
          <p className="text-[11px] text-ink-secondary">
            Demo credentials: <code className="text-info font-mono">admin</code> /{" "}
            <code className="text-info font-mono">admin123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
