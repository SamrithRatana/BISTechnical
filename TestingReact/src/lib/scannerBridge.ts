/**
 * @file lib/scannerBridge.ts
 * @description Real-time in-memory bridge for Mobile Companion Barcode Scanner.
 * Ensures robust, permanent connection between Mobile Phone Scanner and PC Workspace.
 */

export interface ScannerEvent {
  type: "init" | "ping" | "phone-joined" | "barcode-scanned" | "disconnect" | "terminate" | "error";
  sessionId: string;
  barcode?: string;
  format?: string;
  timestamp: number;
}

type Listener = (event: ScannerEvent) => void;

export interface DeviceInfo {
  name: string;
  userAgent?: string;
  ip?: string;
  joinedAt?: number;
  scanCount: number;
  lastActiveAt?: number;
}

interface SessionData {
  sessionId: string;
  ownerUserName?: string;
  ownerUserId?: string;
  createdAt: number;
  lastActiveAt: number;
  listeners: Set<Listener>;
  phoneConnected: boolean;
  pcActive: boolean;
  lastScannedCode?: string;
  device?: DeviceInfo;
}

// Global session store across Next.js API route invocations
declare global {
  // eslint-disable-next-line no-var
  var __scanner_sessions__: Map<string, SessionData> | undefined;
  // eslint-disable-next-line no-var
  var __scanner_cleanup_timer__: NodeJS.Timeout | number | undefined;
}

const sessions: Map<string, SessionData> =
  globalThis.__scanner_sessions__ ?? new Map<string, SessionData>();
globalThis.__scanner_sessions__ = sessions;

// Permanent Pairing Lifetime:
// Sessions remain active permanently until explicitly unlinked by the user
// in "Settings -> Device & Sessions" or upon account logout.

/**
 * Register or keep alive a session created by an authenticated PC
 */
export function registerPcSession(
  sessionId: string,
  ownerUserName?: string,
  ownerUserId?: string
): SessionData {
  let session = sessions.get(sessionId);
  const now = Date.now();
  if (!session) {
    session = {
      sessionId,
      ownerUserName,
      ownerUserId,
      createdAt: now,
      lastActiveAt: now,
      listeners: new Set<Listener>(),
      phoneConnected: false,
      pcActive: true,
    };
    sessions.set(sessionId, session);
  } else {
    session.pcActive = true;
    session.lastActiveAt = now;
    if (ownerUserName) session.ownerUserName = ownerUserName;
    if (ownerUserId) session.ownerUserId = ownerUserId;
  }
  return session;
}

/**
 * Touch / keep-alive a session
 */
export function touchSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActiveAt = Date.now();
    session.pcActive = true;
  }
}

/**
 * Set device info for a connected phone
 */
export function setSessionDevice(sessionId: string, device: DeviceInfo): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.device = device;
    session.phoneConnected = true;
    session.lastActiveAt = Date.now();
  }
}

/**
 * Get an existing active session
 */
export function getActiveSession(sessionId: string): SessionData | null {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  session.lastActiveAt = Date.now();
  return session;
}

/**
 * Subscribe a listener (SSE response stream) to a session
 */
export function subscribeToSession(
  sessionId: string,
  listener: Listener,
  isPc = false,
  ownerUserName?: string,
  ownerUserId?: string
): boolean {
  let session = sessions.get(sessionId);

  if (isPc) {
    session = registerPcSession(sessionId, ownerUserName, ownerUserId);
  } else {
    if (!session) {
      // Auto-register session if phone provides a valid sessionId format
      session = registerPcSession(sessionId, ownerUserName, ownerUserId);
    }
  }

  session.listeners.add(listener);
  session.lastActiveAt = Date.now();
  return true;
}

/**
 * Unsubscribe listener
 */
export function unsubscribeFromSession(sessionId: string, listener: Listener): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.listeners.delete(listener);
  // Do NOT immediately delete session from memory to survive route transitions & tab refreshes
}

/**
 * Emit an event to all subscribers of a session (e.g. PC browser)
 */
export function emitToSession(sessionId: string, event: Omit<ScannerEvent, "timestamp">): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.lastActiveAt = Date.now();

  if (event.type === "phone-joined") {
    session.phoneConnected = true;
    if (!session.device) {
      session.device = {
        name: "Mobile Scanner Device",
        joinedAt: Date.now(),
        scanCount: 0,
        lastActiveAt: Date.now(),
      };
    }
  } else if (event.type === "barcode-scanned" && event.barcode) {
    session.lastScannedCode = event.barcode;
    if (session.device) {
      session.device.scanCount = (session.device.scanCount || 0) + 1;
      session.device.lastActiveAt = Date.now();
    }
  } else if (event.type === "disconnect") {
    session.phoneConnected = false;
  } else if (event.type === "terminate") {
    session.phoneConnected = false;
    session.pcActive = false;
  }

  const payload: ScannerEvent = {
    ...event,
    timestamp: Date.now(),
  };

  for (const listener of session.listeners) {
    try {
      listener(payload);
    } catch {
      // Ignore disconnected listener
    }
  }

  if (event.type === "terminate") {
    sessions.delete(sessionId);
  }

  return true;
}

/**
 * Delete a session explicitly
 */
export function deleteSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.pcActive = false;
    session.phoneConnected = false;
    sessions.delete(sessionId);
  }
}

/**
 * Get all active sessions (or filtered by sessionId)
 */
export function getAllActiveSessions(targetSessionId?: string): Array<{
  sessionId: string;
  ownerUserName?: string;
  phoneConnected: boolean;
  device?: DeviceInfo;
  createdAt: number;
  lastActiveAt: number;
}> {
  const result: any[] = [];
  for (const [id, session] of sessions.entries()) {
    if (targetSessionId && id !== targetSessionId) continue;
    result.push({
      sessionId: session.sessionId,
      ownerUserName: session.ownerUserName,
      phoneConnected: session.phoneConnected,
      device: session.device,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
    });
  }
  return result;
}
