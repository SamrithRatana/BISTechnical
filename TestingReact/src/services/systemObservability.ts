/**
 * @file systemObservability.ts
 * @description Centralized Enterprise Observability, Microservices Telemetry & Error Engine.
 * Captures, analyzes root causes, and categorizes system errors across UI & Backend microservices.
 */

export type ServiceId =
  | "web-frontend"
  | "our-technical-api"
  | "our-user-api"
  | "mssql-db"
  | "redis"
  | "telegram"
  | "cloudflare-r2"
  | "nginx-gateway";

export type ErrorSeverity = "CRITICAL" | "ERROR" | "WARNING" | "INFO";

export type ServiceHealthStatus = "healthy" | "degraded" | "error" | "unknown";

export interface SystemErrorLog {
  id: string;
  timestamp: string; // ISO 8601
  serviceId: ServiceId;
  serviceName: string;
  severity: ErrorSeverity;
  statusCode?: number;
  endpoint?: string;
  method?: string;
  message: string;
  rootCauseKm: string;
  rootCauseEn: string;
  actionAdviceKm: string;
  actionAdviceEn: string;
  stackTrace?: string;
  payloadSnippet?: string;
  userContext?: {
    username?: string;
    role?: string;
    ip?: string;
    userAgent?: string;
  };
  resolved?: boolean;
}

export interface ServiceNodeInfo {
  id: ServiceId;
  name: string;
  nameKm: string;
  role: string;
  roleKm: string;
  containerName: string;
  port: number | string;
  status: ServiceHealthStatus;
  latencyMs: number | null;
  errorCount: number;
  warningCount: number;
  memoryMb?: number;
  threads?: number;
  lastChecked: string;
  details?: Record<string, string | number | boolean>;
}

export interface ProcessActivityEvent {
  id: string;
  timestamp: string;
  serviceId: ServiceId;
  type: "MUTATION" | "QUERY" | "AUTH" | "BACKGROUND" | "ERROR";
  descriptionKm: string;
  descriptionEn: string;
  durationMs?: number;
  statusCode?: number;
  user?: string;
}

// In-memory circular buffers (preserves last 250 errors & 200 process events)
const MAX_ERRORS = 250;
const MAX_EVENTS = 200;

const inMemoryErrors: SystemErrorLog[] = [];
const inMemoryEvents: ProcessActivityEvent[] = [];

type ObservabilitySubscriber = () => void;
const subscribers = new Set<ObservabilitySubscriber>();

function notifySubscribers() {
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

/**
 * Translates standard status codes & error signatures into developer-friendly root causes.
 */
export function analyzeRootCause(
  statusCode?: number,
  message: string = "",
  endpoint: string = ""
): {
  rootCauseKm: string;
  rootCauseEn: string;
  actionAdviceKm: string;
  actionAdviceEn: string;
} {
  const lowerMsg = message.toLowerCase();

  if (statusCode === 401 || lowerMsg.includes("unauthorized") || lowerMsg.includes("token expired")) {
    return {
      rootCauseKm: "JWT Token ផុតកំណត់ ឬមិនមានសិទ្ធិផ្ទៀងផ្ទាត់ (Expired / Missing Token)",
      rootCauseEn: "JWT Authentication Token expired or authorization header is missing.",
      actionAdviceKm: "សូមចូលប្រព័ន្ធ (Login) ឡើងវិញ ឬ Refresh JWT Token ក្នុង Browser Session។",
      actionAdviceEn: "Re-authenticate or refresh the JWT token in the browser session.",
    };
  }

  if (statusCode === 403 || lowerMsg.includes("forbidden") || lowerMsg.includes("permission denied")) {
    return {
      rootCauseKm: "មិនមានសិទ្ធិចូលប្រើប្រាស់ Endpoint នេះទេ (RBAC Permission Denied)",
      rootCauseEn: "Role-Based Access Control denied access to this action.",
      actionAdviceKm: "សូមពិនិត្យមើល Permissions របស់ User ក្នុងផ្ទាំងកំណត់តួនាទី (Role & Permissions Matrix)។",
      actionAdviceEn: "Verify user roles and granular permissions in Role & Permission Matrix.",
    };
  }

  if (statusCode === 404 || lowerMsg.includes("not found")) {
    return {
      rootCauseKm: "រកមិនឃើញទិន្នន័យ ឬ Route ក្នុង API ឡើយ (Resource Not Found)",
      rootCauseEn: "The requested record or API route does not exist in the database.",
      actionAdviceKm: "ពិនិត្យមើល ID នៃទិន្នន័យ ឬ URL route ថាតើត្រូវបានលុប ឬផ្លាស់ប្តូរហើយឬនៅ។",
      actionAdviceEn: "Confirm the record ID or route path has not been deleted or relocated.",
    };
  }

  if (statusCode === 409 || lowerMsg.includes("conflict") || lowerMsg.includes("foreign key")) {
    return {
      rootCauseKm: "ទិន្នន័យជាន់គ្នា ឬជាប់ Foreign Key Constraint ក្នុង SQL Server (Data Conflict)",
      rootCauseEn: "State conflict, duplicate lookup key, or Foreign Key constraint violation.",
      actionAdviceKm: "មិនអាចលុប ឬកែប្រែបានទេ ព្រោះមាន Record ផ្សេងកំពុងភ្ជាប់ (Link) ជាមួយទិន្នន័យនេះ។",
      actionAdviceEn: "Check database foreign key relationships and unique constraints before updating.",
    };
  }

  if (statusCode === 429 || lowerMsg.includes("too many requests") || lowerMsg.includes("rate limit")) {
    return {
      rootCauseKm: "បាញ់ Request ញឹកញាប់ពេក ជាប់ Rate Limiter Ceiling (Rate Limit Exceeded)",
      rootCauseEn: "Request rate exceeded the configured RateLimiter partition quota.",
      actionAdviceKm: "រង់ចាំប្រហែល 1 នាទី ឬកែសម្រួល PermitLimit ក្នុង Program.cs RateLimiter។",
      actionAdviceEn: "Wait 1 minute before retrying, or tune RateLimiter PermitLimit in Program.cs.",
    };
  }

  if (
    lowerMsg.includes("connection refused") ||
    lowerMsg.includes("cannot connect") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("failed to fetch") ||
    lowerMsg.includes("network error")
  ) {
    return {
      rootCauseKm: "បណ្តាញដាច់ ឬសេវាកម្មគោលដៅមិនទាន់ Start ឬដួល (Network Connection Refused)",
      rootCauseEn: "Target service container is down, unreachable, or port is not listening.",
      actionAdviceKm: "ពិនិត្យមើលថា Container ដំណើរការឬនៅ (`docker compose ps`) និងពិនិត្យមើល Network `bis-network`។",
      actionAdviceEn: "Check container status using `docker compose ps` and verify `bis-network` connectivity.",
    };
  }

  if (lowerMsg.includes("sql") || lowerMsg.includes("database") || lowerMsg.includes("timeout")) {
    return {
      rootCauseKm: "SQL Server ឆ្លើយតបយឺត ឬជាប់ Lock Connection (Database Query Timeout)",
      rootCauseEn: "SQL Server command timeout exceeded or transient connection drop.",
      actionAdviceKm: "ពិនិត្យមើល Container `mssql-database` ថាមាន CPU Spike ឬ Connection Pool ពេញឬទេ។",
      actionAdviceEn: "Inspect `mssql-database` CPU usage and ensure connection pool is not exhausted.",
    };
  }

  if (
    lowerMsg.includes("abort") ||
    lowerMsg.includes("responseaborted") ||
    lowerMsg.includes("und_err_aborted") ||
    lowerMsg.includes("request aborted") ||
    statusCode === 499
  ) {
    return {
      rootCauseKm: "សំណើត្រូវបានផ្អាក ឬលុបចោលដោយ Browser (Client Aborted / Navigation Cancel)",
      rootCauseEn: "The HTTP request connection was aborted by browser navigation, page reload, or container restart.",
      actionAdviceKm: "នេះជាដំណើរការធម្មតាពេល User ប្តូរទំព័រ ឬ Refresh កំឡុងពេលទិន្នន័យកំពុងផ្ទេរ។ មិនមានបញ្ហាអ្វីដល់ប្រព័ន្ធឡើយ។",
      actionAdviceEn: "Harmless cancellation triggered by browser navigation or restart. No action needed.",
    };
  }

  if (statusCode === 500 || lowerMsg.includes("internal server error")) {
    return {
      rootCauseKm: "កំហុសខាងក្នុងប្រព័ន្ធ API (Unhandled Backend Exception / Server Fault)",
      rootCauseEn: "Unhandled exception occurred inside API command/query handler pipeline.",
      actionAdviceKm: "ពិនិត្យមើល Stack Trace ខាងក្រោម ឬ Log ក្នុង Container (`docker logs our-technical-api`)។",
      actionAdviceEn: "Review the stack trace below or inspect container logs with `docker logs`.",
    };
  }

  return {
    rootCauseKm: "កំហុសទូទៅក្នុងដំណើរការ Request (Generic Operation Fault)",
    rootCauseEn: "An unexpected condition was encountered during operation execution.",
    actionAdviceKm: "សូមពិនិត្យមើល Stack Trace និងទិន្នន័យដែលបានផ្ញើទៅកាន់ API។",
    actionAdviceEn: "Review stack trace and payload details to identify root cause.",
  };
}

/**
 * Logs an error into the observability buffer and triggers subscribers.
 */
export function captureSystemError(payload: {
  serviceId: ServiceId;
  message: string;
  statusCode?: number;
  severity?: ErrorSeverity;
  endpoint?: string;
  method?: string;
  stackTrace?: string;
  payloadSnippet?: string;
  userContext?: {
    username?: string;
    role?: string;
  };
}): SystemErrorLog {
  const serviceNames: Record<ServiceId, string> = {
    "web-frontend": "Next.js Web Frontend",
    "our-technical-api": "Technical Service Core API (.NET 8)",
    "our-user-api": "User Management & Auth API (.NET 8)",
    "mssql-db": "MSSQL Database Engine",
    redis: "Upstash Redis Cache & Queue",
    telegram: "Telegram Bot Dispatcher",
    "cloudflare-r2": "Cloudflare R2 Object Storage",
    "nginx-gateway": "Nginx Proxy Gateway",
  };

  const { rootCauseKm, rootCauseEn, actionAdviceKm, actionAdviceEn } = analyzeRootCause(
    payload.statusCode,
    payload.message,
    payload.endpoint
  );

  const severity: ErrorSeverity =
    payload.severity ||
    (payload.statusCode && payload.statusCode >= 500 ? "CRITICAL" : payload.statusCode === 409 ? "WARNING" : "ERROR");

  const logEntry: SystemErrorLog = {
    id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    serviceId: payload.serviceId,
    serviceName: serviceNames[payload.serviceId] || payload.serviceId,
    severity,
    statusCode: payload.statusCode,
    endpoint: payload.endpoint,
    method: payload.method,
    message: payload.message,
    rootCauseKm,
    rootCauseEn,
    actionAdviceKm,
    actionAdviceEn,
    stackTrace: payload.stackTrace,
    payloadSnippet: payload.payloadSnippet,
    userContext: payload.userContext,
    resolved: false,
  };

  inMemoryErrors.unshift(logEntry);
  if (inMemoryErrors.length > MAX_ERRORS) {
    inMemoryErrors.pop();
  }

  // If in browser environment, sync to server telemetry buffer asynchronously
  if (typeof window !== "undefined") {
    try {
      fetch("/api/telemetry/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: payload.serviceId,
          message: payload.message,
          statusCode: payload.statusCode,
          severity,
          endpoint: payload.endpoint,
          method: payload.method,
          stackTrace: payload.stackTrace,
          payloadSnippet: payload.payloadSnippet,
          userContext: payload.userContext,
        }),
      }).catch(() => {});
    } catch {
      // Fire-and-forget
    }
  }

  // Also record a process event
  recordProcessActivity({
    serviceId: payload.serviceId,
    type: "ERROR",
    descriptionKm: `កំហុសបានកើតឡើង៖ ${payload.message.substring(0, 80)}`,
    descriptionEn: `Error encountered: ${payload.message.substring(0, 80)}`,
    statusCode: payload.statusCode,
    user: payload.userContext?.username,
  });

  notifySubscribers();
  return logEntry;
}

/**
 * Records a real-time process event.
 */
export function recordProcessActivity(payload: {
  serviceId: ServiceId;
  type: "MUTATION" | "QUERY" | "AUTH" | "BACKGROUND" | "ERROR";
  descriptionKm: string;
  descriptionEn: string;
  durationMs?: number;
  statusCode?: number;
  user?: string;
  userContext?: {
    username?: string;
    role?: string;
  };
}): ProcessActivityEvent {
  const event: ProcessActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    serviceId: payload.serviceId,
    type: payload.type,
    descriptionKm: payload.descriptionKm,
    descriptionEn: payload.descriptionEn,
    durationMs: payload.durationMs,
    statusCode: payload.statusCode,
    user: payload.userContext?.username || payload.user,
  };

  inMemoryEvents.unshift(event);
  if (inMemoryEvents.length > MAX_EVENTS) {
    inMemoryEvents.pop();
  }

  // If in browser environment, sync to server telemetry buffer asynchronously
  if (typeof window !== "undefined") {
    try {
      fetch("/api/telemetry/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: payload.serviceId,
          type: payload.type,
          descriptionKm: payload.descriptionKm,
          descriptionEn: payload.descriptionEn,
          durationMs: payload.durationMs,
          statusCode: payload.statusCode,
          user: payload.userContext?.username || payload.user,
        }),
      }).catch(() => {});
    } catch {
      // Fire-and-forget
    }
  }

  notifySubscribers();
  return event;
}

export function getSystemErrors(filter?: {
  serviceId?: ServiceId | "all";
  severity?: ErrorSeverity | "all";
  search?: string;
  limit?: number;
}): SystemErrorLog[] {
  let list = [...inMemoryErrors];

  if (filter?.serviceId && filter.serviceId !== "all") {
    list = list.filter((e) => e.serviceId === filter.serviceId);
  }
  if (filter?.severity && filter.severity !== "all") {
    list = list.filter((e) => e.severity === filter.severity);
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (e) =>
        e.message.toLowerCase().includes(q) ||
        e.rootCauseKm.toLowerCase().includes(q) ||
        e.rootCauseEn.toLowerCase().includes(q) ||
        (e.endpoint && e.endpoint.toLowerCase().includes(q))
    );
  }

  return list.slice(0, filter?.limit || 100);
}

export function getProcessActivities(limit: number = 50): ProcessActivityEvent[] {
  return inMemoryEvents.slice(0, limit);
}

export function clearSystemErrors() {
  inMemoryErrors.length = 0;
  notifySubscribers();
}

export function subscribeObservability(cb: ObservabilitySubscriber): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
