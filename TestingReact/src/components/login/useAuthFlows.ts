"use client";

/**
 * @file components/login/useAuthFlows.ts
 * @description The per-method authentication handlers, each feeding the same
 * five-stage pipeline: password (which may branch into the face second
 * factor), face capture verification, passkey assertion, and the phone-QR
 * result. Logic ported unchanged from the v1 page.
 */

import { useState } from "react";
import { faceLoginStart, faceLoginVerify, FaceVerifyError } from "@/services/faceAuth";
import type { LoginResponse } from "@/services/types";
import { loginWithPasskey } from "@/services/webauthn";
import { PasskeyError } from "@/lib/webauthn";
import { useI18n } from "@/i18n/LanguageProvider";
import type { LoginPipeline } from "./useLoginPipeline";

export interface FaceStage {
  faceToken: string;
  attemptsLeft: number;
}

export interface AuthFlows {
  faceStage: FaceStage | null;
  faceError: string;
  faceBusy: boolean;
  passkeyBusy: boolean;
  handleLogin: (e: React.FormEvent, userName: string, password: string) => Promise<void>;
  handleFaceCaptured: (descriptors: number[][]) => Promise<void>;
  handlePasskeyLogin: (userName: string) => Promise<void>;
  handlePhoneLoginDone: (payload: unknown) => void;
  cancelFaceStage: () => void;
}

export function useAuthFlows(pipeline: LoginPipeline): AuthFlows {
  const { lang, t } = useI18n();
  const { runLoginPipeline, setErrorMsg } = pipeline;

  const [faceStage, setFaceStage] = useState<FaceStage | null>(null);
  const [faceError, setFaceError] = useState<string>("");
  const [faceBusy, setFaceBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const handleLogin = async (e: React.FormEvent, userName: string, password: string) => {
    e.preventDefault();
    setErrorMsg("");
    setFaceError("");

    await runLoginPipeline(async () => {
      const start = await faceLoginStart(userName, password);

      if (start.kind === "failed") {
        return {
          isSuccess: false,
          message: start.message || t("login.failed"),
        };
      }

      if (start.kind === "faceRequired") {
        setFaceStage({ faceToken: start.faceToken, attemptsLeft: start.attemptsLeft });
        return {
          isSuccess: false,
          isFaceChallenge: true,
          message: "",
        } as LoginResponse & { isFaceChallenge: boolean };
      }

      return start.session;
    });
  };

  const handleFaceCaptured = async (descriptors: number[][]) => {
    if (!faceStage || descriptors.length === 0) return;

    setFaceBusy(true);
    setFaceError("");

    try {
      const session = await faceLoginVerify(faceStage.faceToken, descriptors[0]);
      setFaceStage(null);
      await runLoginPipeline(() => Promise.resolve(session));
    } catch (err) {
      if (err instanceof FaceVerifyError && !err.expired && err.attemptsLeft && err.attemptsLeft > 0) {
        setFaceStage({ ...faceStage, attemptsLeft: err.attemptsLeft });
        setFaceError(t("face.notRecognised"));
        return;
      }

      setFaceStage(null);
      setErrorMsg(
        err instanceof FaceVerifyError && err.expired ? t("face.expired") : t("face.notRecognised")
      );
    } finally {
      setFaceBusy(false);
    }
  };

  const handlePasskeyLogin = (userName: string) => {
    setPasskeyBusy(true);
    return runLoginPipeline(async () => {
      try {
        return await loginWithPasskey(userName);
      } catch (err) {
        const code = err instanceof PasskeyError ? err.code : "failed";
        const message =
          code === "cancelled"
            ? t("passkey.cancelled")
            : code === "unsupported"
              ? t("passkey.unsupported")
              : t("passkey.failed");
        return { isSuccess: false, message };
      }
    }).finally(() => setPasskeyBusy(false));
  };

  const handlePhoneLoginDone = (payload: unknown) => {
    const raw = (payload || {}) as Record<string, unknown>;
    const token =
      typeof raw.token === "string" ? raw.token : typeof raw.Token === "string" ? raw.Token : "";
    const refreshToken =
      typeof raw.refreshToken === "string"
        ? raw.refreshToken
        : typeof raw.RefreshToken === "string"
          ? raw.RefreshToken
          : undefined;
    const rawUser = (raw.user || raw.User) as Record<string, unknown> | undefined;
    const user = rawUser
      ? {
          id: String(rawUser.id || rawUser.Id || ""),
          userName: String(rawUser.userName || rawUser.UserName || ""),
          email: String(rawUser.email || rawUser.Email || ""),
          firstName: String(rawUser.firstName || rawUser.FirstName || ""),
          lastName: String(rawUser.lastName || rawUser.LastName || ""),
          roles: Array.isArray(rawUser.roles)
            ? (rawUser.roles as string[])
            : Array.isArray(rawUser.Roles)
              ? (rawUser.Roles as string[])
              : ["User"],
        }
      : undefined;

    if (!token) {
      void runLoginPipeline(() =>
        Promise.resolve({
          isSuccess: false,
          message:
            typeof raw.message === "string"
              ? raw.message
              : lang === "km"
                ? "លេខផ្ទៀងផ្ទាត់មិនត្រឹមត្រូវ ឬសំណើត្រូវបានបដិសេធ (Match Number Mismatch / Denied)"
                : "Incorrect matching number selected or sign-in request was denied.",
        })
      );
      return;
    }

    void runLoginPipeline(() =>
      Promise.resolve({
        isSuccess: true,
        token: token,
        refreshToken: refreshToken,
        user: user,
      })
    );
  };

  const cancelFaceStage = () => {
    setFaceStage(null);
    setFaceError("");
  };

  return {
    faceStage,
    faceError,
    faceBusy,
    passkeyBusy,
    handleLogin,
    handleFaceCaptured,
    handlePasskeyLogin,
    handlePhoneLoginDone,
    cancelFaceStage,
  };
}
