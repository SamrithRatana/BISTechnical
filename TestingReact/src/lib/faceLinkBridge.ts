import { randomBytes } from "node:crypto";

/**
 * @file lib/faceLinkBridge.ts
 * @description Server-side pairing sessions for "scan the QR, show your face on
 * your phone". Same shape as `scannerBridge`, deliberately separate from it.
 *
 * Why not reuse `scannerBridge`: that one is barcode-shaped, its sessions are
 * tied to a signed-in PC, and its events carry a scanned string. This carries a
 * JWT on the login path, which is a different sensitivity class, and its
 * sessions have to work when nobody is signed in yet.
 *
 * TWO SECRETS, NOT ONE, and the distinction is the whole security story:
 *
 *  - `id` goes in the QR code. Anyone who can see the desktop screen — or a
 *    photo of it — has this.
 *  - `secret` never leaves the desktop that created the session. It is required
 *    to open the event stream.
 *
 * So a bystander who photographs the QR can join as a phone and submit a face,
 * but cannot receive what comes back. On the login path what comes back is a
 * real session token, and handing that to whoever snapped a picture of the
 * screen would undo the entire feature. The scanner bridge does not need this
 * because a barcode is not a credential.
 *
 * Single-process, like `eventBus` and `scannerBridge`: sessions live in module
 * scope. If this app is ever run as more than one Node process, pairing will
 * fail whenever the phone's request lands on a different instance from the
 * desktop's stream — move this to Redis before that happens.
 */

export type FaceLinkMode = "enroll" | "login";

export type FaceLinkEvent =
  | { type: "init"; sessionId: string }
  | { type: "phone-joined"; sessionId: string }
  /** Enrolment finished, or a sign-in completed. `payload` carries the session on the login path. */
  | { type: "done"; sessionId: string; payload?: unknown }
  | { type: "error"; sessionId: string; message: string }
  /**
   * Non-terminal: the phone's attempt was rejected upstream but the session is
   * still live and the phone can retry. Without this the desktop had no way to
   * know anything happened and sat on "waiting" until the QR rotated.
   */
  | { type: "phone-error"; sessionId: string; message: string }
  | { type: "ping"; sessionId: string };

type Listener = (event: FaceLinkEvent & { timestamp: number }) => void;

interface FaceLinkSession {
  id: string;
  secret: string;
  mode: FaceLinkMode;
  userName?: string;
  userId?: string;
  /**
   * The desktop's bearer token, for the enrolment path only.
   *
   * Held here so the phone never receives it: the phone posts descriptors, and
   * THIS server calls the enrolment endpoint on the desktop user's behalf. A
   * design where the phone carried the token would mean a QR code that grants a
   * full session to anyone who scans it.
   */
  bearer?: string;
  createdAt: number;
  phoneJoined: boolean;
  /** Set once, so a session cannot be spent twice. */
  completed: boolean;
  listeners: Set<Listener>;
}

// Global scope attachment to ensure singleton Map across all Next.js Webpack API route chunks
const globalForFaceLink = globalThis as unknown as {
  __faceLinkSessions?: Map<string, FaceLinkSession>;
};

const sessions: Map<string, FaceLinkSession> =
  globalForFaceLink.__faceLinkSessions ?? (globalForFaceLink.__faceLinkSessions = new Map<string, FaceLinkSession>());

/** Pairing is a hands-on operation; anything longer than this is an abandoned session. */
const SESSION_TTL_MS = 5 * 60_000;

function sweep(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) {
      session.listeners.clear();
      sessions.delete(id);
    }
  }
}

export function createFaceLinkSession(
  mode: FaceLinkMode,
  bearer?: string,
  userName?: string,
  userId?: string
): { id: string; secret: string } {
  sweep();

  // 32 bytes each. The id is shown in a QR and the secret gates the stream, so
  // neither may be guessable.
  const id = randomBytes(32).toString("hex");
  const secret = randomBytes(32).toString("hex");

  sessions.set(id, {
    id,
    secret,
    mode,
    userName,
    userId,
    bearer,
    createdAt: Date.now(),
    phoneJoined: false,
    completed: false,
    listeners: new Set(),
  });

  console.log(`[FaceLinkBridge] Created session ${id} for user "${userName || 'anonymous'}" (total active: ${sessions.size})`);
  return { id, secret };
}

/** Looks a session up, treating an expired one as absent. */
export function getFaceLinkSession(id: string): FaceLinkSession | null {
  const session = sessions.get(id);
  if (!session) {
    console.warn(`[FaceLinkBridge] Session ${id} NOT found (total active in globalThis: ${sessions.size})`);
    return null;
  }

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    session.listeners.clear();
    sessions.delete(id);
    console.warn(`[FaceLinkBridge] Session ${id} EXPIRED`);
    return null;
  }

  return session;
}

/** Constant-time-ish check that the caller owns this session. */
export function ownsFaceLinkSession(id: string, secret: string | null): boolean {
  const session = getFaceLinkSession(id);
  if (!session || !secret || secret.length !== session.secret.length) return false;

  let diff = 0;
  for (let i = 0; i < secret.length; i += 1) {
    diff |= secret.charCodeAt(i) ^ session.secret.charCodeAt(i);
  }
  return diff === 0;
}

export function subscribeFaceLink(id: string, listener: Listener): boolean {
  const session = getFaceLinkSession(id);
  if (!session) return false;
  session.listeners.add(listener);
  return true;
}

export function unsubscribeFaceLink(id: string, listener: Listener): void {
  sessions.get(id)?.listeners.delete(listener);
}

export function emitFaceLink(id: string, event: FaceLinkEvent): boolean {
  const session = getFaceLinkSession(id);
  if (!session) return false;

  const payload = { ...event, timestamp: Date.now() };

  // Snapshot first: a listener that unsubscribes while being notified would
  // otherwise mutate the set mid-iteration.
  for (const listener of [...session.listeners]) {
    try {
      listener(payload);
    } catch {
      // One broken stream must not stop the others being told.
    }
  }

  return true;
}

export function markPhoneJoined(id: string): boolean {
  const session = getFaceLinkSession(id);
  if (!session) return false;
  session.phoneJoined = true;
  emitFaceLink(id, { type: "phone-joined", sessionId: id });
  return true;
}

/**
 * Marks a session spent and returns whether the caller was the one to spend it.
 *
 * Returns false on the second call, which is what stops a replayed submit from
 * producing a second sign-in from one pairing.
 */
export function completeFaceLinkSession(id: string): boolean {
  const session = getFaceLinkSession(id);
  if (!session || session.completed) return false;
  session.completed = true;
  return true;
}

export function deleteFaceLinkSession(id: string): void {
  const session = sessions.get(id);
  if (!session) return;
  session.listeners.clear();
  sessions.delete(id);
}
