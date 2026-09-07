/**
 * @file api/ai-search/backend.ts
 * @description Read-only access to the BIS backends from *inside* the Next.js
 * server, for the AI search route.
 *
 * Why this exists rather than reusing `services/api.ts`: that module is the
 * browser client and every call in it is a relative `/api/proxy/...` URL, which
 * has no meaning in a route handler. These functions hit the same backend
 * services the proxy forwards to, with the same query parameters, so a row the
 * AI reads here is the same row the table renders.
 *
 * Everything is read-only by design — the AI answers questions, it never
 * mutates a ticket. The caller's `Authorization` header is forwarded verbatim,
 * so the AI can only ever see what that user could already see.
 *
 * Rows are returned *compacted*: only the fields worth reasoning about, with
 * empty values dropped. A ticket row is ~40 fields on the wire and ~10 that
 * matter to a question; sending all 40 for 100 rows is what turns one search
 * into a large bill.
 */

const TECHNICAL_API_BASE =
  process.env.NEXT_PUBLIC_TECHNICAL_API_URL || "https://techapi.camprotec.com.kh";
const CUSTOMER_API_BASE =
  process.env.NEXT_PUBLIC_CUSTOMER_API_URL || "https://customerapi.camprotec.com.kh";
const JWT_API_BASE =
  process.env.NEXT_PUBLIC_JWT_API_URL || "https://user.camprotec.com.kh";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "1.0";

/** Per-tool row cap. Enough to reason over, small enough to stay affordable. */
export const MAX_ROWS = 40;

type Row = Record<string, unknown>;

export interface UserRecord {
  id: string;
  userName: string;
  fullName: string;
  email: string;
  roles: string[];
}

/** Reads a value under any of the casings the backends actually return. */
function pick(row: Row, ...keys: string[]): unknown {
  for (const key of keys) {
    const v = row[key] ?? row[key.charAt(0).toUpperCase() + key.slice(1)];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function str(row: Row, ...keys: string[]): string | undefined {
  const v = pick(row, ...keys);
  return v === undefined ? undefined : String(v);
}

function num(row: Row, ...keys: string[]): number | undefined {
  const v = pick(row, ...keys);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Drops undefined/empty entries so the model never reads `"field": ""`. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

/** Dates arrive as full ISO timestamps; only the day is ever relevant here. */
function day(row: Row, ...keys: string[]): string | undefined {
  const v = str(row, ...keys);
  return v ? v.slice(0, 10) : undefined;
}

export function parseJwtUser(authorization: string | null): { id?: string; userName?: string; email?: string } | null {
  if (!authorization || !authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    const id = (payload.id ?? payload.sub ?? payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]) as string | undefined;
    const userName = (payload.userName ?? payload.unique_name ?? payload.name ?? payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"]) as string | undefined;
    const email = (payload.email ?? payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]) as string | undefined;
    return { id, userName, email };
  } catch {
    return null;
  }
}

async function getJson(
  base: string,
  path: string,
  params: URLSearchParams,
  authorization: string | null,
  signal?: AbortSignal
): Promise<Row> {
  if (!params.has("api-version")) params.set("api-version", API_VERSION);

  // The caller's own token, and nothing else. There used to be a fallback here
  // that logged in as a hardcoded `admin` account whenever the caller had no
  // token or the backend answered 401 — which meant an unauthenticated request
  // to /api/ai-search was answered from admin-scoped rows, and the "the AI can
  // only see what that user could see" guarantee at the top of this file was
  // not true. The route now rejects unauthenticated callers outright, so a
  // missing token is a bug upstream rather than something to paper over.
  if (!authorization) throw new Error(`${path} not read: no caller credentials`);

  const res = await fetch(`${base}/api/${path}?${params.toString()}`, {
    headers: { Accept: "application/json", Authorization: authorization },
    cache: "no-store",
    signal,
  });

  // Surfaced verbatim so `runTool` can hand the model "this lookup failed"
  // rather than an empty result set, which reads as "there is nothing there".
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as Row;
}

/**
 * Unwraps the several envelope shapes these backends use for a page of rows.
 *
 * `totalKnown` says whether the envelope really carried a total or whether the
 * count fell back to "how many rows are on this page". The two are not
 * interchangeable: for a paged read the fallback is a reasonable display value,
 * but for a count it is a fabrication — see `countTickets`.
 */
function unwrap(data: Row): { rows: Row[]; totalCount: number; totalKnown: boolean } {
  const rows = (data.items ??
    data.Items ??
    data.data ??
    data.Data ??
    (Array.isArray(data) ? data : [])) as Row[];
  const list = Array.isArray(rows) ? rows : [];
  const reported = data.totalCount ?? data.TotalCount;
  const parsed = Number(reported);
  const totalKnown = reported !== undefined && reported !== null && Number.isFinite(parsed);
  return { rows: list, totalCount: totalKnown ? parsed : list.length, totalKnown };
}

// ---------------------------------------------------------------------------
// Users — needed both as an answerable category and to resolve the staff GUIDs
// on every ticket into names a question can actually refer to.
// ---------------------------------------------------------------------------

let userCache: { at: number; users: UserRecord[] } | null = null;
const USER_CACHE_MS = 5 * 60 * 1000;

export async function loadUsers(
  authorization: string | null,
  signal?: AbortSignal
): Promise<UserRecord[]> {
  if (userCache && Date.now() - userCache.at < USER_CACHE_MS) return userCache.users;

  const users: UserRecord[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const params = new URLSearchParams({ page: String(page), pageSize: "100" });
      const data = await getJson(JWT_API_BASE, "UserManagement", params, authorization, signal);
      const { rows } = unwrap(data);
      if (rows.length === 0) break;

      for (const raw of rows) {
        const id = str(raw, "id") ?? "";
        if (!id) continue;
        const first = str(raw, "firstName") ?? "";
        const last = str(raw, "lastName") ?? "";
        const userName = str(raw, "userName") ?? "";
        users.push({
          id,
          userName,
          fullName: `${first} ${last}`.trim() || userName,
          email: str(raw, "email") ?? "",
          roles: (pick(raw, "roles") as string[] | undefined) ?? [],
        });
      }

      const pagination = (data.Pagination ?? data.pagination) as Row | undefined;
      if (!pagination?.HasNext && !pagination?.hasNext) break;
    }
  } catch (err) {
    console.warn("[ai-search] user directory unavailable:", err);
    return userCache?.users ?? [];
  }

  userCache = { at: Date.now(), users };
  return users;
}

/**
 * Resolves a free-text person reference ("Y Sophy", "sophy", "ysophy") to
 * directory entries. Returns every match rather than the first, so an ambiguous
 * name surfaces as ambiguity to the model instead of silently picking one.
 */
export function matchUsers(users: UserRecord[], term: string): UserRecord[] {
  const needle = term.toLowerCase().trim();
  if (!needle) return [];
  return users.filter((u) => {
    const haystacks = [u.fullName, u.userName, u.email].map((s) => s.toLowerCase()).filter(Boolean);
    return haystacks.some((h) => h.includes(needle) || needle.includes(h));
  });
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export interface TicketQuery {
  searchTerm?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  serviceType?: string;
  serviceLocation?: string;
  /** Staff GUIDs — matched against the ticket's process history, not createdBy. */
  userIds?: string[];
  /** Restricts the staff match to the statuses those users acted on. */
  userFilterStatuses?: string[];
  /**
   * Makes fromDate/toDate filter on *when the status was set* rather than on
   * the receive date — "who finished something today" vs "what came in today".
   */
  useProcessDateFiltering?: boolean;
  statusesForProcessFiltering?: string[];
  pageSize?: number;
}

export function buildTicketParams(q: TicketQuery, pageNumber = 1): URLSearchParams {
  const params = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(Math.min(q.pageSize ?? MAX_ROWS, 100)),
    sortBy: "reportNo",
    sortDescending: "true",
  });
  if (q.status && q.status !== "All") params.set("status", q.status);
  if (q.searchTerm) params.set("searchTerm", q.searchTerm);
  if (q.fromDate) params.set("fromDate", q.fromDate);
  if (q.toDate) params.set("toDate", q.toDate);
  if (q.serviceType) params.set("serviceType", q.serviceType);
  if (q.serviceLocation) params.set("serviceLocation", q.serviceLocation);
  if (q.useProcessDateFiltering) params.set("useProcessDateFiltering", "true");
  for (const s of q.statusesForProcessFiltering ?? []) params.append("statusesForProcessFiltering", s);
  for (const u of q.userIds ?? []) params.append("userIds", u);
  for (const s of q.userFilterStatuses ?? []) params.append("userFilterStatuses", s);
  return params;
}

/** Maps the ticket's staff GUIDs to names, keeping only the stages that ran. */
function attributions(row: Row, byId: Map<string, UserRecord>): Record<string, string> {
  const stages: Array<[string, string[]]> = [
    ["received", ["createBy", "userId"]],
    ["inspected", ["inspectBy", "inspectingBy"]],
    ["awaitingSparepart", ["setAwaitingSparepartBy"]],
    ["awaitingCustomerConfirm", ["setAwaitingCustomerConfirmBy"]],
    ["saleConfirmed", ["setSaleConfirmedBy"]],
    ["sentSpareparts", ["setSentSparepartsBy"]],
    ["repaired", ["repairBy"]],
    ["thirdPartyRepair", ["thirdPartyRepairBy"]],
    ["verified", ["verifiedBy"]],
    ["customerRejected", ["setCustomerRejectedBy"]],
    ["unrepairable", ["setUnrepairableBy"]],
  ];

  const out: Record<string, string> = {};
  for (const [stage, keys] of stages) {
    const guid = str(row, ...keys);
    if (!guid || guid === "00000000-0000-0000-0000-000000000000") continue;
    const user = byId.get(guid.toLowerCase());
    if (user) out[stage] = user.fullName || user.userName;
  }
  return out;
}

function compactTicket(row: Row, byId: Map<string, UserRecord>) {
  const spareParts = ((pick(row, "sparepartItems", "sparePartItems") as Row[] | undefined) ?? []).map(
    (sp) =>
      compact({
        name: str(sp, "itemName", "description"),
        quantity: num(sp, "quantity"),
        condition: str(sp, "condition"),
      })
  );

  return compact({
    reportNo: str(row, "reportNo"),
    status: str(row, "status"),
    company: str(row, "companyName"),
    contact: str(row, "contactName"),
    phone: str(row, "phoneNumber"),
    item: str(row, "itemName"),
    serialNumber: str(row, "serialNumber"),
    serviceType: str(row, "serviceType"),
    serviceLocation: str(row, "serviceLocation"),
    priority: str(row, "servicePriority"),
    receivedDate: day(row, "serviceDate"),
    inspectDate: day(row, "inspectDate"),
    saleConfirmedDate: day(row, "saleConfirmedDate"),
    repairDate: day(row, "repairDate"),
    finishedDate: day(row, "finishedDate"),
    daysTaken: num(row, "daysTaken"),
    customerRequest: str(row, "customerRequest"),
    inspection: str(row, "inspection"),
    solution: str(row, "solution"),
    sparePartsUsed: spareParts.length > 0 ? spareParts : undefined,
    handledBy: Object.keys(attributions(row, byId)).length > 0 ? attributions(row, byId) : undefined,
  });
}

export async function searchTickets(
  query: TicketQuery,
  authorization: string | null,
  users: UserRecord[],
  signal?: AbortSignal
) {
  const data = await getJson(
    TECHNICAL_API_BASE,
    "technicalservices/search",
    buildTicketParams(query),
    authorization,
    signal
  );
  const { rows, totalCount } = unwrap(data);
  const byId = new Map(users.map((u) => [u.id.toLowerCase(), u]));
  return {
    totalCount,
    returned: rows.length,
    tickets: rows.map((r) => compactTicket(r, byId)),
  };
}

/**
 * Counts matches without transferring them — `pageSize: 1` still returns the
 * backend's real `totalCount`. This is how "how many …?" gets an exact answer
 * over the whole table instead of over one page of rows.
 */
export async function countTickets(
  query: TicketQuery,
  authorization: string | null,
  signal?: AbortSignal
) {
  const data = await getJson(
    TECHNICAL_API_BASE,
    "technicalservices/search",
    buildTicketParams({ ...query, pageSize: 1 }),
    authorization,
    signal
  );
  const { totalCount, totalKnown } = unwrap(data);

  // This request deliberately asks for a single row, so `unwrap`'s fallback —
  // the number of rows on the page — is 1 no matter what the real total is.
  // Returning it would answer "there is 1 ticket" for a filter matching
  // hundreds, stated with exactly the confidence of a real count and with no
  // way for the reader to tell the difference. A failed lookup reaches the
  // model as an error instead, which it reports as the system being
  // unreachable.
  if (!totalKnown) {
    throw new Error(
      "technicalservices/search returned no totalCount — refusing to report a page size as a count"
    );
  }
  return totalCount;
}

// ---------------------------------------------------------------------------
// Spare parts / customers / items
// ---------------------------------------------------------------------------

export async function searchSpareParts(
  searchTerm: string,
  pageSize: number,
  authorization: string | null,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(Math.min(pageSize || MAX_ROWS, 100)),
  });
  if (searchTerm) params.set("searchTerm", searchTerm);

  const data = await getJson(
    TECHNICAL_API_BASE,
    searchTerm ? "spareparts/search" : "spareparts",
    params,
    authorization,
    signal
  );
  const { rows, totalCount } = unwrap(data);
  return {
    totalCount,
    returned: rows.length,
    spareParts: rows.map((r) =>
      compact({
        itemName: str(r, "itemName"),
        partNumber: str(r, "serialNumber", "partNumber"),
        useFor: str(r, "useFor"),
        inStock: num(r, "quantity"),
        price: num(r, "defaultPrice"),
        description: str(r, "description"),
      })
    ),
  };
}

export async function searchCustomers(
  searchTerm: string,
  pageSize: number,
  authorization: string | null,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(Math.min(pageSize || MAX_ROWS, 100)),
  });
  if (searchTerm) params.set("searchTerm", searchTerm);

  const data = await getJson(CUSTOMER_API_BASE, "Customer", params, authorization, signal);
  const { rows, totalCount } = unwrap(data);
  return {
    totalCount,
    returned: rows.length,
    customers: rows.map((r) =>
      compact({
        company: str(r, "companyName", "name"),
        contact: str(r, "contactName"),
        phone: str(r, "phoneNumber"),
        address: str(r, "address"),
        customerType: str(r, "customerType"),
      })
    ),
  };
}

export async function searchItems(
  searchTerm: string,
  pageSize: number,
  authorization: string | null,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(Math.min(pageSize || MAX_ROWS, 100)),
  });
  if (searchTerm) params.set("searchTerm", searchTerm);

  const data = await getJson(
    TECHNICAL_API_BASE,
    searchTerm ? "items/search" : "items",
    params,
    authorization,
    signal
  );
  const { rows, totalCount } = unwrap(data);
  return {
    totalCount,
    returned: rows.length,
    items: rows.map((r) =>
      compact({
        itemName: str(r, "itemName"),
        serialNumber: str(r, "serialNumber"),
        itemType: str(r, "itemType"),
      })
    ),
  };
}

export async function getDashboardStats(authorization: string | null, signal?: AbortSignal) {
  const data = await getJson(
    TECHNICAL_API_BASE,
    "technicalservices/dashboard-stats",
    new URLSearchParams(),
    authorization,
    signal
  );
  return data;
}

export interface SparepartTransactionQueryInput {
  searchTerm?: string;
  direction?: "In" | "Out" | "All";
  source?: "Service" | "Manual" | "Adjustment" | "All";
  fromDate?: string;
  toDate?: string;
  pageSize?: number;
}

export async function querySparepartTransactions(
  q: SparepartTransactionQueryInput,
  authorization: string | null,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(Math.min(q.pageSize || MAX_ROWS, 100)),
  });
  if (q.searchTerm) params.set("searchTerm", q.searchTerm);
  if (q.direction && q.direction !== "All") params.set("direction", q.direction);
  if (q.source && q.source !== "All") params.set("source", q.source);
  if (q.fromDate) params.set("fromDate", q.fromDate);
  if (q.toDate) params.set("toDate", q.toDate);

  const data = await getJson(
    TECHNICAL_API_BASE,
    "spareparts/transactions",
    params,
    authorization,
    signal
  );
  const { rows, totalCount } = unwrap(data);
  return {
    totalCount,
    returned: rows.length,
    transactions: rows.map((r) =>
      compact({
        date: day(r, "timestamp"),
        itemName: str(r, "itemName"),
        serialNumber: str(r, "serialNumber"),
        quantity: num(r, "quantity"),
        quantityChange: num(r, "quantityChange"),
        direction: str(r, "direction"),
        source: str(r, "source"),
        operationType: str(r, "operationType"),
        balanceBefore: num(r, "balanceBefore"),
        balanceAfter: num(r, "balanceAfter"),
        reportNo: str(r, "reportNo"),
        company: str(r, "companyName"),
        serviceStatus: str(r, "serviceStatus"),
        reason: str(r, "reason"),
      })
    ),
  };
}

export interface SparepartUsageQueryInput {
  searchTerm?: string;
  fromDate?: string;
  toDate?: string;
  condition?: string;
  serviceType?: string;
  sourceFilter?: "Service" | "Manual" | "All";
  pageSize?: number;
}

export async function querySparepartUsage(
  q: SparepartUsageQueryInput,
  authorization: string | null,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(Math.min(q.pageSize || MAX_ROWS, 100)),
  });
  if (q.searchTerm) params.set("searchTerm", q.searchTerm);
  if (q.fromDate) params.set("fromDate", q.fromDate);
  if (q.toDate) params.set("toDate", q.toDate);
  if (q.condition) params.set("condition", q.condition);
  if (q.serviceType) params.set("serviceType", q.serviceType);
  if (q.sourceFilter && q.sourceFilter !== "All") params.set("sourceFilter", q.sourceFilter);

  const data = await getJson(
    TECHNICAL_API_BASE,
    "spareparts/usage",
    params,
    authorization,
    signal
  );
  const { rows, totalCount } = unwrap(data);
  return {
    totalCount,
    returned: rows.length,
    usageSummary: rows.map((r) =>
      compact({
        itemName: str(r, "itemName"),
        partNumber: str(r, "serialNumber", "partNumber"),
        totalUsedQuantity: num(r, "totalQuantity", "quantity"),
        totalCost: num(r, "totalCost", "totalAmount"),
      })
    ),
  };
}

