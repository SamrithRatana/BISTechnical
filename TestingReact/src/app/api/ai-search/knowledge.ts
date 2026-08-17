/**
 * @file api/ai-search/knowledge.ts
 * @description What the assistant knows about the application *itself* — its
 * menus, screens, workflow, features, rules and vocabulary.
 *
 * The data tools in `backend.ts` answer questions about records: how many
 * tickets, which spare parts, whose job. They cannot answer "what menus do I
 * have", "where do I stock out a part", "what does Sale Confirmed mean" or
 * "what can this system do" — there is no table to query for any of that. Asked
 * one of those, the model previously fell back on its own guesswork and named
 * screens the app does not have, which is exactly the failure this file closes:
 * the system prompt forbids answering from memory, so it needs a source to read.
 *
 * The menu section is derived from `@/config/navigation`, the same config the
 * sidebar renders, so a page added to the menu is described here automatically.
 * The rest is maintained by hand and should be updated alongside behaviour
 * changes — it is documentation the model reads at runtime, so a stale entry
 * becomes a confidently wrong answer.
 */

import { NAV_GROUPS, SETTINGS_ITEM, USERS_ITEM, HOME_ITEM, type NavItem } from "@/config/navigation";
import { APP_ACTIONS } from "@/config/actions";
import { translations } from "@/i18n/translations";

export const KNOWLEDGE_TOPICS = [
  "overview",
  "menus",
  "actions",
  "workflow",
  "features",
  "rules",
  "glossary",
] as const;
export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

/** Menu labels are shown to staff in both languages, so both are reported. */
function describeItem(item: NavItem) {
  return {
    label: translations.en[item.nameKey],
    labelKhmer: translations.km[item.nameKey],
    route: item.href,
    purpose: item.purpose,
    ...(item.status ? { showsTicketsWithStatus: item.status } : {}),
    ...(item.tabs ? { statusTabs: item.tabs } : {}),
    ...(item.available === false ? { available: false } : {}),
  };
}

function menus() {
  return {
    note: "The left sidebar. Groups are listed in the order they appear. Labels are given in English and Khmer because the UI runs in both.",
    dashboard: describeItem(HOME_ITEM),
    groups: NAV_GROUPS.map((group) => ({
      groupLabel: translations.en[group.titleKey],
      groupLabelKhmer: translations.km[group.titleKey],
      items: group.items.map(describeItem),
    })),
    footer: describeItem(SETTINGS_ITEM),
    notInSidebar: [describeItem(USERS_ITEM)],
  };
}

/**
 * What the app can *do*, as opposed to what pages it has. Derived from the same
 * registry the components register against, so an action listed here is an
 * action that really exists — and `canTrigger` says whether the assistant can
 * perform it or only point the user at it.
 */
function actions() {
  return {
    note: "Everything the UI can do. canTrigger true means you can perform it yourself by listing its id in `actions`; false means it exists but you can only tell the user where to find it. 'ui' actions change only what is on screen (which menu is open, the theme, the language, a tab, a search box) and are always safe. 'open' actions open a dialog and change nothing. 'write' actions open a dialog that can change data — the user still confirms; you never complete one for them.",
    formFillingNote:
      "An action with a `fields` list opens a form, and you may pass values for those fields to have them typed in. That is all it does: the form opens filled in and waits. Nothing is saved, nothing is deleted, and no record changes until the user presses the button themselves — always say what is still left for them to do.",
    combiningNote:
      "Actions run in the order you list them, so a multi-step instruction is one `actions` array, not several replies.",
    items: APP_ACTIONS.map((a) => ({
      id: a.id,
      label: a.label,
      labelKhmer: a.labelKhmer,
      kind: a.kind,
      does: a.description,
      ...(a.route
        ? { page: a.route }
        : a.needsRecord
          ? { page: "the queue page holding the record" }
          : { page: "works on whatever page the user is on" }),
      ...(a.needsRecord ? { needsRecord: a.recordType ?? true } : {}),
      ...(a.fields
        ? {
            fields: a.fields.map((f) => ({
              name: f.name,
              label: f.label,
              type: f.type,
              ...(f.options ? { options: f.options } : {}),
              holds: f.description,
            })),
          }
        : {}),
      canTrigger: a.wired,
    })),
  };
}

const OVERVIEW = {
  name: "CAMPROTEC Service Maintenance Application",
  brand: "Service & Repair — Management v2",
  what: "A repair-workshop system that tracks a customer's machine from intake, through diagnosis, spare-part supply and customer approval, to repair and final verification.",
  whoUsesIt:
    "Reception books machines in; technicians diagnose and repair; the stock team issues spare parts; sales quotes the customer and records their decision; a verifier signs off finished work.",
  languages:
    "The whole UI is English and Khmer, toggled from the header. Khmer wording follows the legacy Blazor app so the terminology matches what staff already read.",
  shape:
    "A Next.js front end talking to an ASP.NET Core API (TechnicalService.API) over SQL Server, plus separate customer and user-management APIs.",
};

const WORKFLOW = {
  note: "The ticket lifecycle. A ticket appears on exactly one queue page — the one matching its current status. 'Item Recieved' is spelled that way in the database and every filter matches it literally. Each stage's khmerLabel is only how that status is written in the Khmer UI — use it when answering in Khmer, and ignore it entirely when answering in English; it is not a reason to reply in Khmer.",
  stages: [
    {
      status: "Item Recieved",
      khmerLabel: "ម៉ាស៊ីនចូល",
      meaning: "The machine has been booked in at reception.",
      page: "/receive-item",
      canMoveTo: [{ to: "Inspecting", action: "Send to inspect" }],
    },
    {
      status: "Inspecting",
      khmerLabel: "កំពុងវិនិច្ឆ័យ",
      meaning: "A technician is diagnosing the machine now.",
      page: "/inspect-item",
      note: "'Accept' opens the inspection dialog: findings, solution, service type and the spare parts required.",
      canMoveTo: [
        { to: "Inspection", action: "Inspection done" },
        { to: "Awaiting Sparepart", action: "Send to stock" },
        { to: "Awaiting Customer Confirm", action: "Send to sales" },
      ],
    },
    {
      status: "Inspection",
      khmerLabel: "វិនិច្ឆ័យរួច",
      meaning: "Diagnosis is complete and recorded.",
      page: "/inspection",
      canMoveTo: [
        { to: "Inspecting", action: "Re-inspect" },
        { to: "Awaiting Sparepart", action: "Send to stock" },
        { to: "Awaiting Customer Confirm", action: "Send to sales" },
      ],
    },
    {
      status: "Awaiting Sparepart",
      khmerLabel: "រង់ចាំគ្រឿងបន្លាស់",
      meaning: "The job is held waiting on parts.",
      page: "/spare-request",
      canMoveTo: [
        { to: "Awaiting Customer Confirm", action: "Send to sales" },
        { to: "Sent Spareparts", action: "Send spares to technician (free)" },
      ],
    },
    {
      status: "Awaiting Customer Confirm",
      khmerLabel: "រង់ចាំអតិថិជន",
      meaning: "The quote is with the customer, waiting on their decision.",
      page: "/waiting-confirm",
      canMoveTo: [
        { to: "Sale Confirmed", action: "Repairable — customer approved" },
        { to: "Customer Rejected", action: "Customer declined" },
        { to: "Unrepairable", action: "Cannot be repaired" },
      ],
    },
    {
      status: "Sale Confirmed",
      khmerLabel: "ផ្នែកលក់យល់ព្រម",
      meaning: "Sales approved the repair; parts can be issued.",
      page: "/confirmed-sale",
      canMoveTo: [{ to: "Sent Spareparts", action: "Send spares to technician" }],
    },
    {
      status: "Sent Spareparts",
      khmerLabel: "ផ្ញើគ្រឿងបន្លាស់",
      meaning: "Parts have been issued to the technician.",
      page: "/approve-repair",
      canMoveTo: [
        { to: "Finished", action: "Repair done" },
        { to: "Repair by Third-Party", action: "Send to an outside workshop" },
        { to: "Unrepairable", action: "Cannot be repaired" },
        { to: "Inspecting", action: "Adjust spares again" },
        { to: "Inspection", action: "Back to inspection" },
        { to: "Sale Confirmed", action: "Back to sale confirmed" },
      ],
    },
    {
      status: "Repairing",
      khmerLabel: "កំពុងជួសជុល",
      meaning: "The repair is under way.",
      page: "/approve-repair",
      note: "Reached through the Approve Repairing dialog, not the inline status dropdown. Approving stamps repairDate/repairBy and deducts the attached spare-part stock.",
      canMoveTo: [
        { to: "Finished", action: "Repair done" },
        { to: "Repair by Third-Party", action: "Send to an outside workshop" },
        { to: "Unrepairable", action: "Cannot be repaired" },
      ],
    },
    {
      status: "Repair by Third-Party",
      khmerLabel: "ជាងខាងក្រៅ",
      meaning: "The work has been outsourced.",
      page: "/approve-repair",
    },
    {
      status: "Finished",
      khmerLabel: "ជួសជុលរួច",
      meaning: "Repaired, and awaiting or holding final verification.",
      page: "/approve-verify",
      note: "'Verify' closes the job out, stamping finishedDate and verifiedBy.",
    },
    {
      status: "Customer Rejected",
      khmerLabel: "ភ្ញៀវបដិសេធ",
      meaning: "The customer declined the repair. Terminal.",
      page: "/rejected",
    },
    {
      status: "Unrepairable",
      khmerLabel: "ជួសជុលមិនបាន",
      meaning: "Judged beyond repair. Terminal.",
      page: "/unrepairable",
    },
  ],
};

const FEATURES = [
  {
    name: "Header search",
    what: "Searches tickets, spare parts, customers, items and users at once, from any page. Results are grouped behind category tabs; picking one opens the page that owns that record with its search box pre-filled. Tickets load more as you scroll.",
  },
  {
    name: "Ask AI",
    what: "The violet toggle in the search box, and the floating button. Ask in English or Khmer. It answers questions about the records (querying the system first, then answering from what it read), about the application itself, and general questions unrelated to work. It also operates the interface on request: opening pages and dialogs, collapsing the menu, switching theme, language or tab, searching a page, and filling a form in from dictation. It never saves, edits or deletes — it sets the screen up and the user presses the button.",
  },
  {
    name: "Live updates",
    what: "Queue pages refresh themselves when someone else changes a ticket, over a server-sent event stream — no manual reload.",
  },
  {
    name: "Inspection dialog",
    what: "On Inspect Items. Records findings, solution and service type, and builds the spare-parts list: search the catalogue, add parts with quantity and condition (Fix, Replace or Free), and open any part's spec sheet.",
  },
  {
    name: "Spare-part stock",
    what: "On SparePart Items Inventory. Stock In raises quantity; Stock Out records a manual issue with a reason. Parts used on a job are deducted automatically when the repair is approved.",
  },
  {
    name: "Print ticket report",
    what: "A print preview of the repair ticket, laid out as the printed A4 report the workshop already uses.",
  },
  {
    name: "CSV export",
    what: "Exports the current page of rows. Available on Inspect Items, Approve Verify and Received Items Inventory.",
  },
  {
    name: "Language toggle",
    what: "Switches the whole UI between English and Khmer from the header; the choice is remembered and applies across tabs.",
  },
  { name: "Dark mode", what: "Light/dark toggle in the header, remembered between visits." },
  {
    name: "Dashboard tiles",
    what: "Four counters on the home page — Today's Report, Received Item, Waiting Customer, Finished. Clicking one filters the table beneath it.",
  },
];

const RULES = [
  "Approve Repairing is blocked when a 'Sale Confirmed' ticket still has spare parts attached — those must go through stock processing first.",
  "Approve Repairing is blocked for a 'Charge' ticket still sitting in 'Inspection' — sales must confirm it before repair can start.",
  "Approving a repair deducts the attached spare parts from stock. There is no automatic way to put them back short of editing the job.",
  "A ticket shows on exactly one queue page, the one matching its current status — so a job you cannot find has usually moved on to the next stage.",
  "Deleting a spare part from an inspection returns its quantity to stock automatically.",
  "The database spells the intake status 'Item Recieved'. That misspelling is the real stored value and every filter matches it literally.",
  "Service priority ids are not ordered by severity: Low is 1, Normal is 2, High is 3.",
];

const GLOSSARY = [
  { term: "Ticket / service / repair job", means: "One machine booked in for repair. Its reference is the Report No." },
  { term: "Report No", means: "The human-facing reference for a ticket, e.g. on the printed report." },
  { term: "Serial Number", means: "The machine's own serial, used to trace its repair history across visits." },
  { term: "Service Type", means: "'Charge' for paid work, 'Free' for warranty or no-charge work." },
  { term: "Service Priority", means: "Low, Normal or High." },
  { term: "Service Location", means: "Workshop repair versus on-site work at the customer's premises." },
  { term: "Item", means: "A machine in the equipment registry — model name, serial number and type. Not a repair job." },
  { term: "Spare part", means: "A catalogue part with stock on hand, a price, and what it is used for." },
  { term: "Condition", means: "How a part is used on a job: Fix, Replace or Free." },
  { term: "Inspection", means: "The technician's findings. 'Solution' is what they propose to do about it." },
  { term: "Hold status", means: "A spare-part line reserved against a job but not yet issued." },
];

/**
 * Returns the assistant's knowledge of the application. With no topic it
 * returns everything — the whole set is static text with no backend round trip,
 * so one call can answer any question about the app, and narrowing costs the
 * model an extra round trip to discover it guessed the wrong section.
 */
export function describeApplication(topic?: string) {
  const sections: Record<KnowledgeTopic, unknown> = {
    overview: OVERVIEW,
    menus: menus(),
    actions: actions(),
    workflow: WORKFLOW,
    features: FEATURES,
    rules: RULES,
    glossary: GLOSSARY,
  };

  if (topic && (KNOWLEDGE_TOPICS as readonly string[]).includes(topic)) {
    return { topic, [topic]: sections[topic as KnowledgeTopic] };
  }
  return sections;
}
