/**
 * @file lib/scannerBridge.ts
 * @description Real-time in-memory bridge for Mobile Companion Barcode Scanner.
 * Strictly enforces that only sessions actively initiated by an authenticated PC are valid.
 * Old or terminated sessions are immediately rejected.
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
  createdAt: number;
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

// Auto-cleanup stale sessions older than 10 minutes every 30 seconds
if (typeof setInterval !== "undefined" && !globalThis.__scanner_cleanup_timer__) {
  const CLEANUP_INTERVAL = 30 * 1000;
  const MAX_AGE = 10 * 60 * 1000; // 10 minutes

  globalThis.__scanner_cleanup_timer__ = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (now - session.createdAt > MAX_AGE || !session.pcActive) {
        sessions.delete(id);
      }
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Register a new session created by an authenticated PC
 */
export function registerPcSession(sessionId: string): SessionData {
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      sessionId,
      createdAt: Date.now(),
      listeners: new Set<Listener>(),
      phoneConnected: false,
      pcActive: true,
    };
    sessions.set(sessionId, session);
  } else {
    session.pcActive = true;
  }
  return session;
}

/**
 * Get an existing active session (only if PC created it and is active)
 */
export function getActiveSession(sessionId: string): SessionData | null {
  const session = sessions.get(sessionId);
  if (!session || !session.pcActive) {
    return null;
  }
  return session;
}

/**
 * Subscribe a listener (e.g. SSE response stream) to a session
 */
export function subscribeToSession(sessionId: string, listener: Listener, isPc = false): boolean {
  let session = sessions.get(sessionId);

  if (isPc) {
    session = registerPcSession(sessionId);
  } else {
    if (!session || !session.pcActive) {
      return false; // Phone cannot create ghost sessions!
    }
  }

  session.listeners.add(listener);
  return true;
}

/**
 * Unsubscribe listener
 */
export function unsubscribeFromSession(sessionId: string, listener: Listener): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.listeners.delete(listener);
  if (session.listeners.size === 0 && !session.phoneConnected) {
    sessions.delete(sessionId);
  }
}

/**
 * Emit an event to all subscribers of a session (e.g. PC browser)
 */
export function emitToSession(sessionId: string, event: Omit<ScannerEvent, "timestamp">): boolean {
  const session = sessions.get(sessionId);
  if (!session || !session.pcActive) return false;

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
  } else if (event.type === "disconnect" || event.type === "terminate") {
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
      // Ignore disconnected listeners
    }
  }

  // If session is terminated, clean up immediately from memory
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
 * Update device metadata for a session
 */
export function setSessionDevice(sessionId: string, info: Partial<DeviceInfo>): boolean {
  const session = sessions.get(sessionId);
  if (!session || !session.pcActive) return false;

  session.device = {
    name: info.name || session.device?.name || "Mobile Scanner",
    userAgent: info.userAgent || session.device?.userAgent,
    ip: info.ip || session.device?.ip,
    joinedAt: session.device?.joinedAt || Date.now(),
    scanCount: session.device?.scanCount || 0,
    lastActiveAt: Date.now(),
    ...info,
  };
  return true;
}

/**
 * Get all active scanner sessions and their devices
 * Only returns sessions that have an active phone connected!
 */
export function getAllActiveSessions(): Array<{
  sessionId: string;
  createdAt: number;
  phoneConnected: boolean;
  lastScannedCode?: string;
  device?: DeviceInfo;
}> {
  const list: Array<{
    sessionId: string;
    createdAt: number;
    phoneConnected: boolean;
    lastScannedCode?: string;
    device?: DeviceInfo;
  }> = [];

  for (const [id, s] of sessions.entries()) {
    // Only return devices that are actively connected and joined to a live PC
    if (s.pcActive && s.phoneConnected && s.device) {
      list.push({
        sessionId: id,
        createdAt: s.createdAt,
        phoneConnected: s.phoneConnected,
        lastScannedCode: s.lastScannedCode,
        device: s.device,
      });
    }
  }

  return list;
}
