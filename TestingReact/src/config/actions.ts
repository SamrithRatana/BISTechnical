/**
 * @file config/actions.ts
 * @description Every action a user can take in the UI, in one place.
 *
 * Two consumers read this, for the same reason `navigation.ts` exists: the AI
 * assistant needs to know what the application can *do* (not just what pages it
 * has), and the components that actually perform those actions need a stable id
 * to register against. Keeping both on one list means the assistant can never
 * offer an action the UI doesn't have, or miss one it does.
 *
 * `wired` is the honest part. Capabilities in this app live in component-local
 * state — printing is `useState` inside `ServiceTable`, stock-out is
 * `activeModal` inside the spare-parts page, the sidebar's width is `useState`
 * in `PageWrapper` — so each one has to be lifted onto the action bus before
 * anything outside that component can trigger it. Actions not yet lifted are
 * still listed, because the assistant should be able to tell a user where an
 * action is even when it can't press the button for them.
 *
 * `fields` is what turns "open the dialog" into "fill it in for me". An action
 * that opens a form declares the fields that form has, so the assistant can
 * pass values for them and the dialog opens with the work already typed. It
 * stops exactly there: a field list is not a submit button, and every write in
 * this app stays behind the user's own save or confirm click.
 *
 * Deliberately plain data: no React, no imports beyond types, so the AI route
 * handler can read it server-side.
 */

/** What invoking the action does, which decides how much care it needs. */
export type ActionKind =
  /** Opens a dialog, panel or preview. Changes nothing. */
  | "open"
  /** Writes to the system. Never triggered by the assistant on its own. */
  | "write"
  /**
   * Changes the interface only — which menu is expanded, which theme is on,
   * what is typed in a search box. Touches no record, so it is always safe.
   */
  | "ui";

/** A form field the assistant may fill when it opens an action's dialog. */
export interface ActionField {
  /** The key to pass in `values`. */
  name: string;
  label: string;
  type: "text" | "number" | "date" | "enum" | "boolean";
  /** The accepted values, for `enum` fields. */
  options?: string[];
  /** What the field holds, written for the assistant to read. */
  description: string;
}

export interface AppAction {
  /** Stable id the assistant names and the handling component registers. */
  id: string;
  label: string;
  labelKhmer: string;
  /**
   * The page that owns this action. Omitted for ticket actions, which live on
   * whichever queue page currently holds the ticket — the assistant resolves
   * that from the ticket's status — and for the shell actions that work
   * everywhere.
   */
  route?: string;
  kind: ActionKind;
  /** True when the action targets one record rather than the page as a whole. */
  needsRecord: boolean;
  recordType?: "ticket" | "sparePart" | "customer" | "item";
  /** What it does, written for the assistant to read. */
  description: string;
  /**
   * The form this action opens, when it opens one. Values passed for these
   * fields are typed into the form; nothing is saved.
   */
  fields?: ActionField[];
  /**
   * False when the owning component hasn't been put on the action bus yet: the
   * action exists in the UI, but the assistant can only point the user at it.
   */
  wired: boolean;
}

// ---------------------------------------------------------------------------
// Shared field sets
// ---------------------------------------------------------------------------

/** The ticket intake form, shared by creating a ticket and editing one. */
const TICKET_FIELDS: ActionField[] = [
  {
    name: "companyName",
    label: "Customer / company",
    type: "text",
    description: "The customer company the machine belongs to.",
  },
  {
    name: "contactName",
    label: "Contact person",
    type: "text",
    description: "Who to contact at that company.",
  },
  { name: "phoneNumber", label: "Phone", type: "text", description: "Contact phone number." },
  { name: "address", label: "Address", type: "text", description: "Customer address." },
  {
    name: "itemName",
    label: "Machine / item",
    type: "text",
    description: "The machine model brought in for repair.",
  },
  {
    name: "serialNumber",
    label: "Serial number",
    type: "text",
    description: "The machine's serial number.",
  },
  {
    name: "customerRequest",
    label: "Customer request",
    type: "text",
    description: "The fault as the customer described it, or what they asked for.",
  },
  {
    name: "servicePriority",
    label: "Priority",
    type: "enum",
    options: ["Low", "Normal", "High"],
    description: "How urgent the job is. Defaults to Normal.",
  },
  {
    name: "serviceLocation",
    label: "Location",
    type: "enum",
    options: ["CompanyService", "OnSite"],
    description: "'CompanyService' for a workshop repair, 'OnSite' for work at the customer's premises.",
  },
  {
    name: "serviceDate",
    label: "Service date",
    type: "date",
    description: "When the machine was booked in, YYYY-MM-DD.",
  },
  {
    name: "hasContract",
    label: "Under contract",
    type: "boolean",
    description: "Whether the machine is covered by a service contract.",
  },
  {
    name: "isThirdPartyRepair",
    label: "Third-party repair",
    type: "boolean",
    description: "Whether the work is being sent to an outside workshop.",
  },
];

/** The spare-part catalogue form, shared by adding a part and editing one. */
const SPARE_PART_FIELDS: ActionField[] = [
  { name: "itemName", label: "Part name", type: "text", description: "The part's name." },
  {
    name: "serialNumber",
    label: "Part number",
    type: "text",
    description: "The part number / catalogue reference.",
  },
  {
    name: "useFor",
    label: "Used for",
    type: "text",
    description: "Which machines or models the part fits.",
  },
  { name: "description", label: "Description", type: "text", description: "Free-text notes about the part." },
  {
    name: "quantity",
    label: "Quantity",
    type: "number",
    description: "Quantity on hand to record for a new part.",
  },
  { name: "defaultPrice", label: "Price", type: "number", description: "Unit price." },
];

/** The customer record form. */
const CUSTOMER_FIELDS: ActionField[] = [
  { name: "companyName", label: "Company", type: "text", description: "Company name." },
  { name: "contactName", label: "Contact person", type: "text", description: "Main contact's name." },
  { name: "phoneNumber", label: "Phone", type: "text", description: "Contact phone number." },
  { name: "address", label: "Address", type: "text", description: "Company address." },
  {
    name: "customerType",
    label: "Customer type",
    type: "enum",
    options: ["Corporate", "Individual"],
    description: "Whether the customer is a company or a private individual.",
  },
];

/** The machine-registry form. */
const ITEM_FIELDS: ActionField[] = [
  { name: "itemName", label: "Item name", type: "text", description: "The machine's model name." },
  { name: "serialNumber", label: "Serial number", type: "text", description: "The machine's serial number." },
  {
    name: "itemType",
    label: "Item type",
    type: "enum",
    options: ["Printer", "Computer", "Laptop", "Scanner", "Server", "Other"],
    description: "What kind of machine it is.",
  },
];

export const APP_ACTIONS: AppAction[] = [
  // ── Tickets (ServiceTable — shared by every queue page) ──────────────────
  {
    id: "ticket.view",
    label: "View ticket details",
    labelKhmer: "មើលព័ត៌មានលម្អិត",
    kind: "open",
    needsRecord: true,
    recordType: "ticket",
    description:
      "Opens the ticket's detail view: customer, machine, the full status timeline of who did what and when, and the spare parts attached to it.",
    wired: true,
  },
  {
    id: "ticket.print",
    label: "Print ticket report",
    labelKhmer: "បោះពុម្ពរបាយការណ៍",
    kind: "open",
    needsRecord: true,
    recordType: "ticket",
    description:
      "Opens the printable A4 repair-ticket report for one job, ready to send to a printer. This is the report the workshop already uses on paper.",
    wired: true,
  },
  {
    id: "ticket.create",
    label: "New ticket",
    labelKhmer: "បង្កើតសំបុត្រថ្មី",
    kind: "open",
    needsRecord: false,
    description:
      "Opens the blank intake form for booking a machine in. Fill any of its fields with values; the user still presses Save.",
    fields: TICKET_FIELDS,
    wired: true,
  },
  {
    id: "ticket.edit",
    label: "Edit ticket",
    labelKhmer: "កែសម្រួលសំបុត្រ",
    kind: "open",
    needsRecord: true,
    recordType: "ticket",
    description:
      "Opens the ticket in edit mode — service date, customer, machine, priority, location and contract flags. Values you pass are typed into the form; nothing changes until the user saves.",
    fields: TICKET_FIELDS,
    wired: true,
  },
  {
    id: "ticket.delete",
    label: "Delete ticket",
    labelKhmer: "លុបសំបុត្រ",
    kind: "write",
    needsRecord: true,
    recordType: "ticket",
    description:
      "Opens the delete confirmation for a ticket. The user must confirm; nothing is deleted by opening it.",
    wired: true,
  },
  {
    id: "ticket.approveRepair",
    label: "Approve repairing",
    labelKhmer: "អនុម័តជួសជុល",
    route: "/approve-repair",
    kind: "write",
    needsRecord: true,
    recordType: "ticket",
    description:
      "Opens the Approve Repairing confirmation. Approving stamps repairDate/repairBy and deducts the attached spare parts from stock, so it is blocked for a 'Sale Confirmed' ticket that still has parts attached, and for a 'Charge' ticket still in Inspection.",
    wired: true,
  },
  {
    id: "ticket.inspect",
    label: "Record inspection",
    labelKhmer: "កត់ត្រាការវិនិច្ឆ័យ",
    route: "/inspect-item",
    kind: "open",
    needsRecord: true,
    recordType: "ticket",
    description:
      "Opens the inspection dialog for a machine being diagnosed: findings, solution, service type, and the spare-parts list. This is the 'Accept' button on Inspect Items. Findings and solution can be filled in for the technician to review and save.",
    fields: [
      {
        name: "inspection",
        label: "Inspection findings",
        type: "text",
        description: "What the technician found wrong with the machine.",
      },
      {
        name: "solution",
        label: "Solution",
        type: "text",
        description: "What they propose to do about it.",
      },
      {
        name: "serviceType",
        label: "Service type",
        type: "enum",
        options: ["Free", "Charge"],
        description: "'Charge' for paid work, 'Free' for warranty or no-charge work.",
      },
    ],
    wired: true,
  },
  {
    id: "ticket.verify",
    label: "Verify finished repair",
    labelKhmer: "ផ្ទៀងផ្ទាត់ការជួសជុល",
    route: "/approve-verify",
    kind: "write",
    needsRecord: true,
    recordType: "ticket",
    description:
      "Signs off a finished repair, closing the job out. Writes immediately with no confirmation dialog, so the assistant never triggers it — it only points the user at the page.",
    wired: false,
  },

  // ── Spare parts ───────────────────────────────────────────────────────────
  {
    id: "sparePart.create",
    label: "Add spare part",
    labelKhmer: "បន្ថែមគ្រឿងបន្លាស់",
    route: "/spareparts",
    kind: "open",
    needsRecord: false,
    description:
      "Opens the blank form for adding a new part to the spare-parts catalogue, optionally with the details already typed in.",
    fields: SPARE_PART_FIELDS,
    wired: true,
  },
  {
    id: "sparePart.edit",
    label: "Edit spare part",
    labelKhmer: "កែសម្រួលគ្រឿងបន្លាស់",
    route: "/spareparts",
    kind: "open",
    needsRecord: true,
    recordType: "sparePart",
    description:
      "Opens one catalogue part for editing — name, part number, use-for, price, picture. Pass only the fields to change; the rest keep the part's current values.",
    fields: SPARE_PART_FIELDS,
    wired: true,
  },
  {
    id: "sparePart.stockIn",
    label: "Stock in",
    labelKhmer: "បញ្ចូលស្តុក",
    route: "/spareparts",
    kind: "write",
    needsRecord: true,
    recordType: "sparePart",
    description:
      "Opens the Stock In dialog for a part, to raise its quantity on hand. The quantity can be filled in; the user confirms.",
    fields: [
      { name: "quantity", label: "Quantity", type: "number", description: "How many units to add to stock." },
    ],
    wired: true,
  },
  {
    id: "sparePart.stockOut",
    label: "Stock out",
    labelKhmer: "ដកស្តុក",
    route: "/spareparts",
    kind: "write",
    needsRecord: true,
    recordType: "sparePart",
    description:
      "Opens the manual Stock Out dialog for a part, to issue stock outside a repair job. Quantity and reason can be filled in; the user confirms.",
    fields: [
      { name: "quantity", label: "Quantity", type: "number", description: "How many units to issue." },
      { name: "reason", label: "Reason", type: "text", description: "Why the stock is being issued." },
    ],
    wired: true,
  },
  {
    id: "sparePart.delete",
    label: "Delete spare part",
    labelKhmer: "លុបគ្រឿងបន្លាស់",
    route: "/spareparts",
    kind: "write",
    needsRecord: true,
    recordType: "sparePart",
    description: "Opens the delete confirmation for a catalogue part.",
    wired: true,
  },

  // ── Customers ─────────────────────────────────────────────────────────────
  {
    id: "customer.create",
    label: "Add customer",
    labelKhmer: "បន្ថែមអតិថិជន",
    route: "/customers",
    kind: "open",
    needsRecord: false,
    description:
      "Opens the blank form for adding a customer — company, contact, phone, address — optionally already filled in.",
    fields: CUSTOMER_FIELDS,
    wired: true,
  },
  {
    id: "customer.edit",
    label: "Edit customer",
    labelKhmer: "កែសម្រួលអតិថិជន",
    route: "/customers",
    kind: "open",
    needsRecord: true,
    recordType: "customer",
    description:
      "Opens one customer for editing. Pass only the fields to change; the rest keep their current values.",
    fields: CUSTOMER_FIELDS,
    wired: true,
  },
  {
    id: "customer.delete",
    label: "Delete customer",
    labelKhmer: "លុបអតិថិជន",
    route: "/customers",
    kind: "write",
    needsRecord: true,
    recordType: "customer",
    description: "Opens the delete confirmation for a customer record.",
    wired: true,
  },

  // ── Machines / item registry ──────────────────────────────────────────────
  {
    id: "item.create",
    label: "Add machine",
    labelKhmer: "បន្ថែមម៉ាស៊ីន",
    route: "/received-inventory",
    kind: "open",
    needsRecord: false,
    description:
      "Opens the blank form for adding a machine to the registry — name, serial number, type — optionally already filled in.",
    fields: ITEM_FIELDS,
    wired: true,
  },
  {
    id: "item.edit",
    label: "Edit machine",
    labelKhmer: "កែសម្រួលម៉ាស៊ីន",
    route: "/received-inventory",
    kind: "open",
    needsRecord: true,
    recordType: "item",
    description:
      "Opens one registered machine for editing. Pass only the fields to change.",
    fields: ITEM_FIELDS,
    wired: true,
  },
  {
    id: "item.delete",
    label: "Delete machine",
    labelKhmer: "លុបម៉ាស៊ីន",
    route: "/received-inventory",
    kind: "write",
    needsRecord: true,
    recordType: "item",
    description: "Opens the delete confirmation for a registered machine.",
    wired: true,
  },

  // ── Exports ───────────────────────────────────────────────────────────────
  {
    id: "export.csv",
    label: "Export to CSV",
    labelKhmer: "នាំចេញជា CSV",
    kind: "open",
    needsRecord: false,
    description:
      "Downloads the rows currently on screen as a CSV file. Available on the ticket queues, Inspect Items, Approve Verify and Received Items Inventory.",
    wired: true,
  },

  // ── The interface itself ──────────────────────────────────────────────────
  //
  // These change nothing but what the user is looking at, so they are always
  // safe to perform and work on whatever page they are already on.
  {
    id: "ui.sidebar.collapse",
    label: "Collapse the menu",
    labelKhmer: "បង្រួមម៉ឺនុយ",
    kind: "ui",
    needsRecord: false,
    description: "Shrinks the left sidebar to icons only, widening the page.",
    wired: true,
  },
  {
    id: "ui.sidebar.expand",
    label: "Expand the menu",
    labelKhmer: "ពង្រីកម៉ឺនុយ",
    kind: "ui",
    needsRecord: false,
    description: "Opens the left sidebar back to its full width, showing the menu labels.",
    wired: true,
  },
  {
    id: "ui.sidebar.toggle",
    label: "Toggle the menu",
    labelKhmer: "បិទ/បើកម៉ឺនុយ",
    kind: "ui",
    needsRecord: false,
    description: "Flips the sidebar between collapsed and expanded. Use the explicit collapse/expand when the user said which one they want.",
    wired: true,
  },
  {
    id: "ui.language.english",
    label: "Switch to English",
    labelKhmer: "ប្ដូរទៅភាសាអង់គ្លេស",
    kind: "ui",
    needsRecord: false,
    description: "Puts the whole interface into English.",
    wired: true,
  },
  {
    id: "ui.language.khmer",
    label: "Switch to Khmer",
    labelKhmer: "ប្ដូរទៅភាសាខ្មែរ",
    kind: "ui",
    needsRecord: false,
    description: "Puts the whole interface into Khmer.",
    wired: true,
  },
  {
    id: "ui.refresh",
    label: "Refresh the page data",
    labelKhmer: "ផ្ទុកទិន្នន័យឡើងវិញ",
    kind: "ui",
    needsRecord: false,
    description: "Re-reads the current page's rows from the server.",
    wired: true,
  },
  {
    id: "ui.search",
    label: "Search on this page",
    labelKhmer: "ស្វែងរកក្នុងទំព័រនេះ",
    kind: "ui",
    needsRecord: false,
    description:
      "Types a term into the search box of the page the user is on and filters its table by it. Use this to narrow a list in place, rather than navigating.",
    fields: [
      { name: "query", label: "Search term", type: "text", description: "What to type into the page's search box. Pass an empty string to clear it." },
    ],
    wired: true,
  },
  {
    id: "ui.globalSearch",
    label: "Open the header search",
    labelKhmer: "បើកការស្វែងរករួម",
    kind: "ui",
    needsRecord: false,
    description:
      "Opens the header's global search box with a term typed in, showing its live results across tickets, spare parts, customers, machines and users. The user picks a result themselves.",
    fields: [
      { name: "query", label: "Search term", type: "text", description: "What to type into the global search box." },
    ],
    wired: true,
  },
  {
    id: "ui.tab",
    label: "Switch queue tab",
    labelKhmer: "ប្ដូរផ្ទាំង",
    kind: "ui",
    needsRecord: false,
    description:
      "Switches the status tab strip on a queue page — the pills above the table. Pass the exact status the tab is for.",
    fields: [
      {
        name: "tab",
        label: "Tab",
        type: "text",
        description: "The workflow status the tab shows, e.g. 'Awaiting Sparepart'. Must be one of the statusTabs listed for that page in the menus section.",
      },
    ],
    wired: true,
  },
  {
    id: "ui.pageSize",
    label: "Change rows per page",
    labelKhmer: "ប្ដូរចំនួនជួរ",
    kind: "ui",
    needsRecord: false,
    description: "Sets how many rows the current table loads at a time.",
    fields: [
      { name: "size", label: "Rows", type: "number", description: "Rows per page: 10, 25, 50 or 100." },
    ],
    wired: true,
  },
  {
    id: "ui.dialog.close",
    label: "Close the open dialog",
    labelKhmer: "បិទប្រអប់ដែលកំពុងបើក",
    kind: "ui",
    needsRecord: false,
    description:
      "Closes whatever dialog, modal or preview is currently open on the page — the same thing its Cancel or X button does. This is what to use for 'close the dialog', 'cancel that form', 'បិទ', or when the user says they are done with a form you opened. Nothing is saved: closing discards whatever was typed, exactly as pressing Cancel would.",
    wired: true,
  },
  {
    id: "ui.assistant.close",
    label: "Close the assistant panel",
    labelKhmer: "បិទផ្ទាំងជំនួយ",
    kind: "ui",
    needsRecord: false,
    // The description is emphatic about what this is NOT because it used to be
    // the only action in the registry with "close" in it. Asked to close a
    // *dialog*, the model matched this one instead and hid the chat panel while
    // the dialog stayed open — the user's request appeared to do the opposite of
    // what they asked. `ui.dialog.close` above is the correct target now, and
    // this entry has to point at it clearly enough that the model stops
    // reaching for the wrong one.
    description:
      "Closes THIS CHAT PANEL only — the assistant sidebar you are talking through. It does not close dialogs, modals, forms or previews on the page; use ui.dialog.close for those. Only use this when the user specifically asks you to hide the chat, or to get out of the way so they can see the page.",
    wired: true,
  },
];

/** Actions the assistant may actually trigger — the rest it can only describe. */
export const TRIGGERABLE_ACTION_IDS = APP_ACTIONS.filter((a) => a.wired).map((a) => a.id);

export function findAction(id: string): AppAction | undefined {
  return APP_ACTIONS.find((a) => a.id === id);
}

/**
 * Keeps only the values that name a real field on this action, so a model that
 * invents a field name can't smuggle arbitrary keys into a form's state.
 * Returns undefined rather than an empty object when nothing survives, which is
 * what handlers check to mean "no prefill".
 */
export function sanitizeActionValues(
  action: AppAction,
  values: Record<string, unknown> | undefined
): Record<string, string> | undefined {
  if (!values || !action.fields) return undefined;
  const allowed = new Set(action.fields.map((f) => f.name));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    if (value === null || value === undefined) continue;
    out[key] = String(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
