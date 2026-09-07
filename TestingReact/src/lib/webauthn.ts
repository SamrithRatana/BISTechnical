/**
 * @file lib/webauthn.ts
 * @description The browser half of passkey sign-in: base64url plumbing, the two
 * `navigator.credentials` ceremonies, and turning a `DOMException` into a code
 * the UI can translate.
 *
 * WHY THE ENCODING WORK EXISTS. WebAuthn is the rare browser API that speaks in
 * `ArrayBuffer`s, while JSON has no way to carry one. Every implementation
 * therefore agrees to base64**url** — not plain base64 — at the wire, and both
 * ends have to convert. `atob` cannot be handed a base64url string directly: it
 * rejects the `-` and `_` that replace `+` and `/`, and the missing `=` padding.
 * That failure is intermittent by nature, because whether a given challenge
 * contains those characters is chance, which makes it exactly the kind of bug
 * that passes a demo and fails in production. `authSession.ts` documents having
 * been bitten by the same thing decoding JWTs.
 *
 * This module holds NO user-visible strings. It throws {@link PasskeyError} with
 * a stable `code`, and the calling component maps that code to an i18n key —
 * otherwise the error text for a feature that has to work in Khmer would be
 * fixed English coming out of a library.
 */

/** Why a passkey ceremony did not complete. Maps 1:1 to a `passkey.*` i18n key. */
export type PasskeyErrorCode =
  /** No WebAuthn in this browser at all. */
  | "unsupported"
  /** The person dismissed the prompt, or it timed out. Not a failure worth alarming about. */
  | "cancelled"
  /** This authenticator already holds a credential for this account. */
  | "alreadyRegistered"
  /** Anything else - a real failure. */
  | "failed";

export class PasskeyError extends Error {
  readonly code: PasskeyErrorCode;

  constructor(code: PasskeyErrorCode, message: string) {
    super(message);
    this.name = "PasskeyError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

/** base64url string -> bytes. Restores the `+`/`/` alphabet and the padding `atob` requires. */
function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** bytes -> base64url string, padding stripped. */
function bytesToBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  // Chunked rather than String.fromCharCode(...bytes): an attestation object is
  // several hundred bytes today, but spreading a large array into arguments is
  // how this pattern turns into a stack overflow the day something bigger
  // arrives.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Capability
// ---------------------------------------------------------------------------

/** True when this browser has WebAuthn at all. False on http:// pages other than localhost. */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials
  );
}

/**
 * True when the device has a built-in authenticator that can do user
 * verification - Face ID, Windows Hello, an Android biometric.
 *
 * Used only to decide how prominent the button is. It is deliberately NOT a
 * gate: a desktop with no built-in authenticator can still sign in perfectly
 * well by scanning the QR code with a phone, and hiding the button there would
 * remove the flow this feature was chosen for.
 */
export async function hasPlatformAuthenticator(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Ceremonies
// ---------------------------------------------------------------------------

/**
 * Transports the .NET `AuthenticatorTransport` enum can actually parse
 * (verified against Fido2NetLib 4.0.1, not assumed).
 *
 * The browser's `getTransports()` is free to report a value newer than the
 * server library knows, and an unrecognised entry makes the whole attestation
 * fail to deserialise - so a brand-new browser would break enrolment for a
 * field that is only ever a display hint. Unknown values are dropped here
 * instead.
 */
const KNOWN_TRANSPORTS = new Set(["usb", "nfc", "ble", "smart-card", "hybrid", "internal"]);

type ServerOptions = Record<string, unknown>;

interface Descriptor {
  id: string;
  type?: string;
  transports?: string[];
}

/** Runs the enrolment ceremony and returns the JSON `WebAuthnController.Register` expects. */
export async function createPasskey(options: ServerOptions): Promise<Record<string, unknown>> {
  if (!isPasskeySupported()) {
    throw new PasskeyError("unsupported", "WebAuthn is not available in this browser.");
  }

  const user = options.user as { id: string; name: string; displayName: string };
  const exclude = (options.excludeCredentials as Descriptor[] | undefined) ?? [];

  // Spread first, override the binary fields: anything the spec adds later
  // passes through untouched instead of being silently dropped by an explicit
  // field list.
  const publicKey = {
    ...options,
    challenge: base64UrlToBytes(options.challenge as string),
    user: { ...user, id: base64UrlToBytes(user.id) },
    excludeCredentials: exclude.map((c) => ({ ...c, id: base64UrlToBytes(c.id) })),
  } as unknown as PublicKeyCredentialCreationOptions;

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  } catch (err) {
    throw toPasskeyError(err);
  }

  if (!credential) {
    throw new PasskeyError("cancelled", "No credential was created.");
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  const reported =
    typeof response.getTransports === "function" ? response.getTransports() : [];
  const transports = reported.filter((t) => KNOWN_TRANSPORTS.has(t));

  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    extensions: credential.getClientExtensionResults(),
    response: {
      attestationObject: bytesToBase64Url(response.attestationObject),
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      transports,
    },
  };
}

/** Runs the login ceremony and returns the JSON `WebAuthnController.Login` expects. */
export async function getPasskeyAssertion(options: ServerOptions): Promise<Record<string, unknown>> {
  if (!isPasskeySupported()) {
    throw new PasskeyError("unsupported", "WebAuthn is not available in this browser.");
  }

  const allow = (options.allowCredentials as Descriptor[] | undefined) ?? [];

  const publicKey = {
    ...options,
    challenge: base64UrlToBytes(options.challenge as string),
    // An empty list is meaningful, not missing: it tells the browser to offer
    // whichever discoverable passkeys the device holds, which is the flow that
    // lets someone sign in without typing a username first.
    allowCredentials: allow.map((c) => ({ ...c, id: base64UrlToBytes(c.id) })),
  } as unknown as PublicKeyCredentialRequestOptions;

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  } catch (err) {
    throw toPasskeyError(err);
  }

  if (!credential) {
    throw new PasskeyError("cancelled", "No assertion was returned.");
  }

  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    extensions: credential.getClientExtensionResults(),
    response: {
      authenticatorData: bytesToBase64Url(response.authenticatorData),
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      signature: bytesToBase64Url(response.signature),
      userHandle: response.userHandle ? bytesToBase64Url(response.userHandle) : null,
    },
  };
}

/**
 * Maps the browser's exception onto a code the UI can translate.
 *
 * `NotAllowedError` covers both "the person pressed cancel" and "the prompt
 * timed out", and the spec deliberately does not distinguish them - telling a
 * site which one happened would leak information about the user. Both are
 * treated as `cancelled`, which is right: neither is an error to alarm anyone
 * about.
 *
 * `SecurityError` almost always means the Relying Party ID does not match the
 * page's origin - i.e. `WebAuthn:ServerDomain` in the API's appsettings is
 * wrong for wherever the app is being served from. It is folded into `failed`
 * for the user, and left in the console message for whoever is debugging it,
 * because it is a deployment fault rather than anything the user did.
 */
function toPasskeyError(err: unknown): PasskeyError {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "AbortError") {
      return new PasskeyError("cancelled", err.message);
    }
    if (err.name === "InvalidStateError") {
      return new PasskeyError("alreadyRegistered", err.message);
    }
    if (err.name === "NotSupportedError") {
      return new PasskeyError("unsupported", err.message);
    }
    return new PasskeyError("failed", `${err.name}: ${err.message}`);
  }
  return new PasskeyError("failed", err instanceof Error ? err.message : String(err));
}

/**
 * A default label for the device being enrolled, so a passkey list does not read
 * as four identical rows.
 *
 * Deliberately NOT translated: it is built from product names ("Chrome",
 * "Windows"), the same reason the dictionary leaves the brand block
 * untranslated. It is only a default - the user can type over it.
 */
export function describeThisDevice(): string {
  if (typeof navigator === "undefined") return "Passkey";

  const ua = navigator.userAgent;

  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";

  // Order matters: Edge's UA contains "Chrome", and Chrome's contains "Safari".
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";

  if (browser && os) return `${browser} on ${os}`;
  return browser || os || "Passkey";
}
