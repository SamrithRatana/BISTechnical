/**
 * @file services/apiWriteResult.ts
 * @description Turns a write response into an `ApiWriteResult` the UI can
 * explain — the TechnicalService API answers failures as RFC 9457
 * ProblemDetails with a stable `code` (`duplicate`, `inUse`, `constraint`)
 * and, for "in use", a `count`. Reading that here means every screen shows
 * "used by 12 spare parts" instead of a generic "failed".
 *
 * Plain function, no React, no fetch: it only reads a `Response` it is handed.
 */

import type { ApiWriteResult } from "./types";
import { captureSystemError } from "./systemObservability";

type FailureCode = Extract<ApiWriteResult, { ok: false }>["code"];

/** The subset of a ProblemDetails body this app reads. */
interface ProblemDetailsLike {
  detail?: unknown;
  code?: unknown;
  count?: unknown;
}

const KNOWN_CODES: ReadonlySet<string> = new Set(["duplicate", "inUse", "constraint"]);

function codeForStatus(status: number, serverCode: string | undefined): FailureCode {
  if (serverCode && KNOWN_CODES.has(serverCode)) return serverCode as FailureCode;
  if (status === 400) return "validation";
  if (status === 404) return "notFound";
  if (status === 409) return "constraint";
  return undefined;
}

/**
 * Reads the outcome of a write. On success, picks up `{ id }` when the body
 * carries one (the taxonomy POSTs answer 201 with the new id; the spare-part
 * POST answers an empty 200).
 */
export async function readWriteResult(res: Response): Promise<ApiWriteResult> {
  let body: ProblemDetailsLike & { id?: unknown; error?: unknown } = {};
  // The legacy `POST/PUT /spareparts` answer a failure as a bare JSON string
  // (`BadRequest<string>`); keep it so the toast has something to say.
  let bareText: string | undefined;
  try {
    const text = await res.text();
    if (text) {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "string") bareText = parsed;
      else if (parsed && typeof parsed === "object") body = parsed as typeof body;
    }
  } catch {
    // A non-JSON body (or none) is fine either way — the status is the verdict.
  }

  if (res.ok) {
    return typeof body.id === "string" ? { ok: true, id: body.id } : { ok: true };
  }

  const serverCode = typeof body.code === "string" ? body.code : undefined;
  // `detail` is ProblemDetails; `error` is what the Next proxy answers when the
  // upstream itself could not be reached (500/504) — a network-class failure.
  const proxyError = typeof body.error === "string" ? body.error : undefined;
  const detail = typeof body.detail === "string" ? body.detail : (bareText ?? proxyError);
  const code = proxyError && res.status >= 500 ? "network" : codeForStatus(res.status, serverCode);

  // Capture write failure into centralized observability engine
  try {
    const url = typeof res.url === "string" ? res.url : "";
    const isUserApi = url.includes("/auth") || url.includes("/users") || url.includes(":5005");
    captureSystemError({
      serviceId: isUserApi ? "our-user-api" : "our-technical-api",
      endpoint: url,
      statusCode: res.status,
      message: detail || `Write operation failed with HTTP ${res.status}`,
      stackTrace: typeof body === "object" ? JSON.stringify(body, null, 2) : undefined,
    });
  } catch {}

  return {
    ok: false,
    status: res.status,
    code,
    detail,
    count: typeof body.count === "number" ? body.count : undefined,
  };
}

/** The result for a request that never got a response (offline, timeout). */
export function networkFailure(endpoint?: string): ApiWriteResult {
  try {
    const isUserApi = endpoint?.includes("/auth") || endpoint?.includes("/users") || endpoint?.includes(":5005");
    captureSystemError({
      serviceId: isUserApi ? "our-user-api" : "our-technical-api",
      endpoint: endpoint || "network-layer",
      statusCode: 0,
      message: "Network connection lost or request timed out",
      severity: "CRITICAL",
    });
  } catch {}
  return { ok: false, status: 0, code: "network" };
}
