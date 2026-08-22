/**
 * @file lib/loginSessionTracker.ts
 * @description Real-time tracker for authenticated user login sessions across different browsers & devices.
 */

export interface ActiveLoginSession {
  sessionId: string;
  userName: string;
  role: string;
  email?: string;
  deviceDisplay: string;
  browserName: string;
  osName: string;
  ip: string;
  userAgent: string;
  loginTime: number;
  lastActiveTime: number;
  isRevoked?: boolean;
}

// Global session store across Next.js API route invocations
declare global {
  // eslint-disable-next-line no-var
  var __login_sessions__: Map<string, ActiveLoginSession> | undefined;
  // eslint-disable-next-line no-var
  var __login_sessions_cleanup__: NodeJS.Timeout | number | undefined;
}

const loginSessions: Map<string, ActiveLoginSession> =
  globalThis.__login_sessions__ ?? new Map<string, ActiveLoginSession>();
globalThis.__login_sessions__ = loginSessions;

// Auto-cleanup stale sessions inactive for more than 15 minutes
if (typeof setInterval !== "undefined" && !globalThis.__login_sessions_cleanup__) {
  const CLEANUP_INTERVAL = 30 * 1000;
  const MAX_INACTIVE_MS = 15 * 60 * 1000; // 15 minutes

  globalThis.__login_sessions_cleanup__ = setInterval(() => {
    const now = Date.now();
    for (const [id, s] of loginSessions.entries()) {
      if (now - s.lastActiveTime > MAX_INACTIVE_MS || s.isRevoked) {
        loginSessions.delete(id);
      }
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Parse human-readable device name and browser from User-Agent
 */
export function parseDeviceInfo(ua: string): {
  browserName: string;
  osName: string;
  deviceDisplay: string;
} {
  let osName = "Windows PC";
  if (/iPhone/i.test(ua)) osName = "Apple iPhone";
  else if (/iPad/i.test(ua)) osName = "Apple iPad";
  else if (/Android/i.test(ua)) {
    if (/Samsung|SM-|GT-/i.test(ua)) osName = "Samsung Galaxy";
    else if (/Xiaomi|Redmi|POCO/i.test(ua)) osName = "Xiaomi Phone";
    else if (/Huawei|HONOR/i.test(ua)) osName = "Huawei Phone";
    else if (/Pixel/i.test(ua)) osName = "Google Pixel";
    else osName = "Android Smartphone";
  } else if (/Windows NT 10/i.test(ua)) osName = "Windows 11/10 PC";
  else if (/Windows NT 6.3/i.test(ua)) osName = "Windows 8.1 PC";
  else if (/Macintosh|Mac OS X/i.test(ua)) osName = "Apple Mac";
  else if (/Linux/i.test(ua)) osName = "Linux PC";

  let browserName = "Web Browser";
  if (/SamsungBrowser/i.test(ua)) browserName = "Samsung Internet";
  else if (/Edg\/|EdgA\/|EdgiOS\//i.test(ua)) browserName = "Microsoft Edge";
  else if (/CriOS\//i.test(ua)) browserName = "Google Chrome";
  else if (/FxiOS\//i.test(ua)) browserName = "Mozilla Firefox";
  else if (/OPR\/|OPT\/|Opera/i.test(ua)) browserName = "Opera Browser";
  else if (/MiuiBrowser/i.test(ua)) browserName = "Mi Browser";
  else if (/HuaweiBrowser/i.test(ua)) browserName = "Huawei Browser";
  else if (/UCBrowser/i.test(ua)) browserName = "UC Browser";
  else if (/Brave/i.test(ua)) browserName = "Brave Browser";
  else if (/Chrome\//i.test(ua)) browserName = "Google Chrome";
  else if (/Safari\//i.test(ua)) browserName = "Apple Safari";
  else if (/Firefox\//i.test(ua)) browserName = "Mozilla Firefox";

  const deviceDisplay = `${osName} (${browserName})`;

  return { browserName, osName, deviceDisplay };
}

/**
 * Register or update an active login session heartbeat
 */
export function recordLoginHeartbeat(
  sessionId: string,
  userName: string,
  role: string,
  email: string | undefined,
  ua: string,
  ip: string
): ActiveLoginSession {
  const existing = loginSessions.get(sessionId);
  const { browserName, osName, deviceDisplay } = parseDeviceInfo(ua);

  if (existing) {
    existing.userName = userName || existing.userName;
    existing.role = role || existing.role;
    existing.email = email || existing.email;
    existing.lastActiveTime = Date.now();
    existing.ip = ip || existing.ip;
    return existing;
  }

  const newSession: ActiveLoginSession = {
    sessionId,
    userName: userName || "User",
    role: role || "Staff",
    email: email || "",
    deviceDisplay,
    browserName,
    osName,
    ip,
    userAgent: ua,
    loginTime: Date.now(),
    lastActiveTime: Date.now(),
  };

  loginSessions.set(sessionId, newSession);
  return newSession;
}

/**
 * Get all active login sessions
 */
export function getActiveLoginSessions(): ActiveLoginSession[] {
  const now = Date.now();
  const list: ActiveLoginSession[] = [];

  for (const s of loginSessions.values()) {
    // Active if heartbeat within last 15 minutes and not revoked
    if (now - s.lastActiveTime <= 15 * 60 * 1000 && !s.isRevoked) {
      list.push(s);
    }
  }

  // Sort: most recently active first
  return list.sort((a, b) => b.lastActiveTime - a.lastActiveTime);
}

/**
 * Revoke/Logout a session by ID
 */
export function revokeLoginSession(sessionId: string): boolean {
  const session = loginSessions.get(sessionId);
  if (session) {
    session.isRevoked = true;
    setTimeout(() => {
      loginSessions.delete(sessionId);
    }, 1000);
    return true;
  }
  return false;
}

/**
 * Revoke all other sessions except current
 */
export function revokeAllOtherLoginSessions(currentSessionId: string): void {
  for (const [id, s] of loginSessions.entries()) {
    if (id !== currentSessionId) {
      s.isRevoked = true;
      loginSessions.delete(id);
    }
  }
}
