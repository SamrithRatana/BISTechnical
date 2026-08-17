/**
 * @file api/ai-search/tools.ts
 * @description The tool surface the AI search assistant works through: what it
 * can look up inside the system, and how a tool call turns into a real backend
 * query.
 *
 * The important shift from the previous design is that the model *reads the
 * data*. It used to only guess a filter object, which the browser then ran — so
 * any answer it gave about counts, spare parts or who did what was written
 * before a single row had been fetched. Here it queries first and answers from
 * what came back, and `present_results` carries both the grounded answer and
 * the filters the table should show.
 *
 * Tool definitions are kept provider-neutral (plain JSON Schema) and converted
 * per provider at the call site: Gemini wants OpenAPI-style declarations with
 * upper-case type names, Anthropic wants `input_schema`.
 */

import {
  MAX_ROWS,
  countTickets,
  getDashboardStats,
  matchUsers,
  searchCustomers,
  searchItems,
  searchSpareParts,
  searchTickets,
  type TicketQuery,
  type UserRecord,
} from "./backend";
import { KNOWLEDGE_TOPICS, describeApplication } from "./knowledge";
import { ALL_NAV_ITEMS } from "@/config/navigation";
import { TRIGGERABLE_ACTION_IDS } from "@/config/actions";

/** Routes the assistant may offer to open — everything in the menu that exists. */
const NAVIGABLE_ROUTES = ALL_NAV_ITEMS.filter((item) => item.available !== false).map((i) => i.href);

/** Backend status names, spelled exactly as the ServiceStatuses table stores
 *  them — including the DB's long-standing "Item Recieved" misspelling, which
 *  every filter matches on literally. */
export const STATUSES = [
  "Item Recieved",
  "Inspecting",
  "Inspection",
  "Awaiting Sparepart",
  "Awaiting Customer Confirm",
  "Sale Confirmed",
  "Sent Spareparts",
  "Repairing",
  "Repair by Third-Party",
  "Finished",
  "Customer Rejected",
  "Unrepairable",
] as const;

/**
 * Which list the UI shows under the answer. `general` means *no* list — the
 * reply is conversational (a greeting, a "what can you do", a general-knowledge
 * question) and pinning an arbitrary ticket search under it would be noise.
 */
export const CATEGORIES = ["tickets", "spareParts", "customers", "items", "users", "general"] as const;
export type Category = (typeof CATEGORIES)[number];

const SERVICE_TYPES = ["Free", "Charge"] as const;
const SERVICE_LOCATIONS = ["Company", "CustomerSite"] as const;

/** Minimal JSON Schema shape — enough for both providers. */
export interface JsonSchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

/** Filters shared by `search_tickets`, `count_tickets` and `present_results`. */
const TICKET_FILTERS: Record<string, JsonSchema> = {
  searchTerm: {
    type: "string",
    description:
      "Free text matched against report number, company name, contact name, item name and serial number. Omit when the question carries no text to match. A staff member's name goes in staffName, never here.",
  },
  status: {
    type: "string",
    enum: [...STATUSES],
    description: "Current workflow status. Omit to search every status.",
  },
  fromDate: { type: "string", description: "Inclusive start of the date window, YYYY-MM-DD." },
  toDate: { type: "string", description: "Inclusive end of the date window, YYYY-MM-DD." },
  serviceType: {
    type: "string",
    enum: [...SERVICE_TYPES],
    description: "'Charge' for paid work, 'Free' for warranty / no-charge work.",
  },
  serviceLocation: {
    type: "string",
    enum: [...SERVICE_LOCATIONS],
    description: "'Company' for workshop repairs, 'CustomerSite' for on-site work.",
  },
  staffName: {
    type: "string",
    description:
      "A staff member's name, when the question is about work a person did. Matched against the user directory and applied against each ticket's process history — not against who created it.",
  },
  dateFilterMode: {
    type: "string",
    enum: ["received", "statusChanged"],
    description:
      "What the date window means. On the default 'received', a window with NO status filters on when the machine came in, while a window combined with a status filters on when that status was set — so 'what came in today' must leave status unset, or it silently becomes 'what reached that stage today'. 'statusChanged' matches the window against the ticket's process history instead, which is a broader match than status-plus-dates; use it for questions about work a named person did, such as 'who confirmed sales this week'. It requires `status` to be set.",
  },
};

export interface ToolDefinition {
  name: string;
  description: string;
  /** Omitted for tools that take no arguments. */
  parameters?: JsonSchema;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_tickets",
    description:
      "Search repair/service tickets and read the matching rows: status, customer, machine, dates, spare parts used, and which staff member performed each workflow step. Use this whenever the question is about repair jobs, report numbers, machines in for service, or what a colleague worked on. Returns the backend's exact total match count alongside a capped sample of rows.",
    parameters: {
      type: "object",
      properties: {
        ...TICKET_FILTERS,
        limit: {
          type: "integer",
          description: `How many rows to read back, 1-${MAX_ROWS}. Ask for a few when you only need examples; ask for more when you must inspect or tally them.`,
        },
      },
    },
  },
  {
    name: "count_tickets",
    description:
      "Count matching tickets across the whole system without reading the rows. Use this for any 'how many' question, and to compare several statuses or date windows cheaply before deciding what to read in full.",
    parameters: { type: "object", properties: TICKET_FILTERS },
  },
  {
    name: "search_spare_parts",
    description:
      "Search the spare-parts catalogue: part name, part number, what it is used for, quantity currently in stock and price. Use this for stock questions.",
    parameters: {
      type: "object",
      properties: {
        searchTerm: {
          type: "string",
          description: "Part name, part number, or what it is used for. Omit to list the catalogue.",
        },
        limit: { type: "integer", description: `Rows to read back, 1-${MAX_ROWS}.` },
      },
    },
  },
  {
    name: "search_customers",
    description: "Search customer companies and contacts: company name, contact person, phone, address.",
    parameters: {
      type: "object",
      properties: {
        searchTerm: { type: "string", description: "Company or contact name. Omit to list customers." },
        limit: { type: "integer", description: `Rows to read back, 1-${MAX_ROWS}.` },
      },
    },
  },
  {
    name: "search_items",
    description:
      "Search the machine/item registry: model name, serial number and item type. This is the equipment catalogue, not the tickets — use search_tickets for repair history.",
    parameters: {
      type: "object",
      properties: {
        searchTerm: { type: "string", description: "Item name or serial number. Omit to list items." },
        limit: { type: "integer", description: `Rows to read back, 1-${MAX_ROWS}.` },
      },
    },
  },
  {
    name: "find_users",
    description:
      "Look up system user accounts by name, username, email or role, and read their assigned roles. Use this for questions about people, accounts, roles and permissions, and to confirm a staff member's exact name before filtering tickets by them.",
    parameters: {
      type: "object",
      properties: {
        searchTerm: {
          type: "string",
          description: "Name, username, email or role fragment. Omit to list every user.",
        },
      },
    },
  },
  {
    name: "get_dashboard_stats",
    description:
      "Read the system-wide dashboard counters (totals per workflow stage) in one call. Use this for 'overall' / 'in total' questions where several stage counts are wanted at once.",
  },
  {
    name: "describe_application",
    description:
      "Read how this application is built: its menus and every page with what that page is for, the full ticket workflow and which status can move where, the features available, the business rules, and the vocabulary staff use. Call this for ANY question about the system itself rather than the records in it — what menus/pages exist, what a screen does, where to do something, what a status means, what the app can do, how the process works. Never answer those from memory: the menu is specific to this installation and guessing produces screens that do not exist. Omit `topic` to read everything at once.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: [...KNOWLEDGE_TOPICS],
          description: "Narrow to one section. Omit to get all of them, which is usually what you want.",
        },
      },
    },
  },
  {
    name: "present_results",
    description:
      "Deliver the final answer and tell the UI which rows to list under it. Call this exactly once, as the last thing you do. The filters you pass here are re-run by the table, so they must be the ones that produced the rows your answer describes.",
    parameters: {
      type: "object",
      properties: {
        answer: {
          type: "string",
          description:
            "The answer itself, in the same language the question was asked in (Khmer question -> Khmer answer). Ground anything about this system in what the tools returned and cite the real figures you read; one to three sentences is right for those, with no preamble. A general question unrelated to the system gets a proper answer at whatever length it deserves. When you performed actions, say what you opened or filled in and what the user still has to press.",
        },
        category: {
          type: "string",
          enum: [...CATEGORIES],
          description:
            "Which list the user should see under the answer. Use 'general' for greetings, capability questions, and anything answered from describe_application — a record list would be noise there.",
        },
        navigateTo: {
          type: "string",
          enum: NAVIGABLE_ROUTES,
          description:
            "The page to OPEN for the user. Setting this navigates them there immediately, so set it only when the question is a request to go somewhere or to do something that happens on a page — 'open the spare parts page', 'បើក page ទទួលម៉ាស៊ីន', 'take me to the rejected jobs', 'I need to stock out a part', 'show me ticket SVC-1024'. Leave it out when they only asked a question and expect an answer where they are ('how many machines came in today', 'what does Awaiting Sparepart mean', 'what menus do I have') — navigating away from an answer they wanted to read is a bug, not a convenience. Use the exact route from describe_application, and never a page marked unavailable. When they named a specific record to open, also set searchTerm so the page opens with that record already filtered.",
        },
        actions: {
          type: "array",
          description:
            "The things to DO for the user, performed in the order you list them. Each is an action id from describe_application whose canTrigger is true. Use this whenever they asked you to do something rather than tell them something: 'print the report for SVC-1024', 'stock out 3 toner', 'add a spare part called X', 'collapse the menu', 'switch to Khmer', 'show me the Awaiting Sparepart tab'. Several steps in one instruction means several entries here. For an action that targets a record, set navigateTo to the page that owns it and searchTerm to the record, or the page will not have it loaded. Leave the whole field out when the user only asked a question.",
          items: {
            type: "object",
            description: "One step to perform.",
            properties: {
              id: {
                type: "string",
                enum: TRIGGERABLE_ACTION_IDS,
                description: "The action id, exactly as describe_application lists it.",
              },
              recordRef: {
                type: "string",
                description:
                  "Which record it acts on — a ticket's report number, a part or machine name, a serial number, a customer's company name. Omit for actions that don't need one.",
              },
              values: {
                type: "array",
                description:
                  "The values this action needs, as \"field=value\" strings — for example [\"quantity=3\", \"reason=office use\"] or [\"query=Canon\"]. Use the field names exactly as describe_application lists them under this action. REQUIRED whenever the action has fields and the user supplied any content for them: ui.search without query searches for nothing, ui.tab without tab switches nowhere, and customer.create without values opens an empty form. Only include what the user actually specified; leave fields they didn't mention for them. This fills a form in — it does not save it, and your answer must not claim otherwise.",
                items: { type: "string" },
              },
            },
            required: ["id"],
          },
        },
        ...TICKET_FILTERS,
      },
      required: ["answer", "category"],
    },
  },
];

// ---------------------------------------------------------------------------
// Provider conversion
// ---------------------------------------------------------------------------

/**
 * Gemini's `parameters` is an OpenAPI 3.0 Schema whose `type` is a proto enum,
 * so it must be upper-cased (`"string"` -> `"STRING"`). Lower-case types are
 * accepted inconsistently and fail closed — the model simply never calls the
 * tool, which looks exactly like the model choosing not to search.
 */
function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: schema.type.toUpperCase() };
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  if (schema.required?.length) out.required = schema.required;
  return out;
}

export function geminiFunctionDeclarations(): Record<string, unknown>[] {
  return TOOL_DEFINITIONS.map((tool) => {
    const decl: Record<string, unknown> = { name: tool.name, description: tool.description };
    // A parameterless tool must omit `parameters` entirely — an empty OBJECT
    // schema is rejected as an invalid function declaration.
    if (tool.parameters) decl.parameters = toGeminiSchema(tool.parameters);
    return decl;
  });
}

export function anthropicTools() {
  return TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: (tool.parameters ?? { type: "object", properties: {} }) as never,
  }));
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface ToolContext {
  authorization: string | null;
  /**
   * Lazy so a greeting doesn't pay for the whole user directory. Memoised by
   * the caller, and cached again in `backend.ts`, so repeated calls are free.
   */
  getUsers: () => Promise<UserRecord[]>;
  signal?: AbortSignal;
  /**
   * The filters of every ticket lookup that actually ran, appended in order.
   *
   * The route reconciles these against what the model later states in
   * `present_results`, because the two are independent objects and the UI
   * labels the second one "Understood as". Recorded as the real argument
   * object rather than reconstructed afterwards, and shared across model
   * attempts so a fallback inherits what its predecessor already looked up.
   */
  executedTicketQueries?: TicketFilterInput[];
}

export interface TicketFilterInput {
  searchTerm?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  serviceType?: string;
  serviceLocation?: string;
  staffName?: string;
  dateFilterMode?: "received" | "statusChanged";
  limit?: number;
}

/**
 * Turns the model's filter shape into a backend query.
 *
 * Two translations matter here and are easy to get wrong by hand:
 * - a staff name becomes `userIds` (a process-history match) rather than a
 *   `searchTerm`, because the ticket text doesn't contain who worked on it;
 * - `dateFilterMode: "statusChanged"` becomes `useProcessDateFiltering`, which
 *   the backend only honours together with `statusesForProcessFiltering`.
 */
export function toTicketQuery(
  input: TicketFilterInput,
  users: UserRecord[]
): { query: TicketQuery; matched: UserRecord[] } {
  const matched = input.staffName ? matchUsers(users, input.staffName) : [];
  const byProcessDate =
    input.dateFilterMode === "statusChanged" &&
    Boolean(input.status) &&
    Boolean(input.fromDate || input.toDate);

  return {
    matched,
    query: {
      searchTerm: input.searchTerm || undefined,
      // A staff or process-date filter spans the whole workflow, so the
      // ticket's *current* status must stay open — the status is applied to
      // the history match instead.
      status: matched.length > 0 || byProcessDate ? undefined : input.status || undefined,
      fromDate: input.fromDate || undefined,
      toDate: input.toDate || undefined,
      serviceType: input.serviceType || undefined,
      serviceLocation: input.serviceLocation || undefined,
      userIds: matched.length > 0 ? matched.map((u) => u.id) : undefined,
      userFilterStatuses: matched.length > 0 && input.status ? [input.status] : undefined,
      useProcessDateFiltering: byProcessDate,
      statusesForProcessFiltering: byProcessDate && input.status ? [input.status] : undefined,
      pageSize: input.limit,
    },
  };
}

/**
 * Runs one tool call. Never throws — a failure comes back to the model as a
 * tool result so it can adapt or say what it couldn't reach, rather than
 * aborting the whole search.
 */
export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  try {
    const term = typeof input.searchTerm === "string" ? input.searchTerm.trim() : "";
    const limit =
      typeof input.limit === "number" ? Math.min(Math.max(input.limit, 1), MAX_ROWS) : MAX_ROWS;

    switch (name) {
      case "search_tickets": {
        const users = await ctx.getUsers();
        ctx.executedTicketQueries?.push(input as TicketFilterInput);
        const { query, matched } = toTicketQuery(input as TicketFilterInput, users);
        const result = await searchTickets(query, ctx.authorization, users, ctx.signal);
        if (input.staffName && matched.length === 0) {
          return {
            ...result,
            note: `No user directory entry matches "${String(input.staffName)}", so no staff filter was applied. Call find_users to check the spelling.`,
          };
        }
        if (matched.length > 1) {
          return {
            ...result,
            note: `"${String(input.staffName)}" matched ${matched.length} users (${matched
              .map((u) => u.fullName)
              .join(", ")}); all were included.`,
          };
        }
        return result;
      }

      case "count_tickets": {
        ctx.executedTicketQueries?.push(input as TicketFilterInput);
        const { query, matched } = toTicketQuery(input as TicketFilterInput, await ctx.getUsers());
        const count = await countTickets(query, ctx.authorization, ctx.signal);
        return input.staffName && matched.length === 0
          ? { count, note: `No user matches "${String(input.staffName)}"; the count ignores the staff filter.` }
          : { count };
      }

      case "search_spare_parts":
        return await searchSpareParts(term, limit, ctx.authorization, ctx.signal);

      case "search_customers":
        return await searchCustomers(term, limit, ctx.authorization, ctx.signal);

      case "search_items":
        return await searchItems(term, limit, ctx.authorization, ctx.signal);

      case "find_users": {
        const users = await ctx.getUsers();
        const needle = term.toLowerCase();
        const hits = needle
          ? users.filter((u) =>
              [u.fullName, u.userName, u.email, u.roles.join(" ")]
                .join(" ")
                .toLowerCase()
                .includes(needle)
            )
          : users;
        return {
          totalCount: hits.length,
          users: hits.slice(0, MAX_ROWS).map((u) => ({
            name: u.fullName,
            userName: u.userName,
            email: u.email,
            roles: u.roles,
          })),
        };
      }

      case "get_dashboard_stats":
        return await getDashboardStats(ctx.authorization, ctx.signal);

      // Static, local, and never fails — it reads the app's own config rather
      // than a backend, so it costs nothing and needs no auth.
      case "describe_application":
        return describeApplication(typeof input.topic === "string" ? input.topic : undefined);

      default:
        return { error: `Unknown tool "${name}".` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[ai-search] tool ${name} failed:`, message);
    return { error: `Lookup failed: ${message}. Tell the user this part of the system was unreachable.` };
  }
}
