/**
 * @file config/navigation.ts
 * @description The application's menu structure — the single source of truth
 * for both the rendered sidebar and the AI assistant's knowledge of it.
 *
 * This used to live as a private `navGroups` const inside `Sidebar.tsx`, which
 * meant nothing else could read it: when the assistant was asked "what menus
 * does my system have" it had no source to consult and answered from the
 * model's own guesswork, naming categories that aren't in the menu at all.
 * Both consumers now read this file, so the answer and the sidebar cannot drift
 * apart — adding a page here is what puts it in front of the user *and* teaches
 * the assistant it exists.
 *
 * Deliberately plain data: no React, no icons, no `"use client"`. The AI route
 * handler imports it server-side, and pulling a component library across that
 * boundary for the sake of a menu list isn't worth it. `Sidebar.tsx` owns the
 * href -> icon mapping locally instead.
 */

import type { TranslationKey } from "@/i18n/translations";

export interface NavItem {
  /** i18n key for the label — resolved at render, and read in both languages by the assistant. */
  nameKey: TranslationKey;
  href: string;
  /**
   * What the page is for, in plain English. Never rendered — this is written
   * for the AI assistant, so it can answer "where do I …" from the real app
   * rather than inferring from the route name.
   */
  purpose: string;
  /** The ticket status this queue lists, for the workflow pages. */
  status?: string;
  /** Status tabs shown across the top of the page, in order. */
  tabs?: string[];
  /**
   * False when the menu links somewhere that has no page yet. The assistant
   * must not send anyone to a dead route, so it reads this flag.
   */
  available?: boolean;
}

export interface NavGroup {
  titleKey: TranslationKey;
  items: NavItem[];
}

/** The dashboard link that sits above the groups. */
export const HOME_ITEM: NavItem = {
  nameKey: "nav.homeDashboard",
  href: "/",
  purpose:
    "Landing dashboard: four stat tiles (Today's Report, Received Item, Waiting Customer, Finished) over a ticket table whose filter follows whichever tile is selected.",
};

/** The footer link. Now a real page — the appearance settings. */
export const SETTINGS_ITEM: NavItem = {
  nameKey: "nav.systemSettings",
  href: "/settings",
  purpose:
    "Appearance settings for this device: theme mode (light, dark, follow the system, or switch automatically by hour with a configurable day/night schedule), accent colour, corner radius, table density, text size and whether entrance animations play. Saved per device in the browser, not to the user's account.",
};

/**
 * Reachable from the global search's "View all in Users & Roles", but
 * intentionally not in the sidebar — listed so the assistant knows it exists.
 */
export const USERS_ITEM: NavItem = {
  nameKey: "nav.usersAndRoles",
  href: "/users",
  purpose:
    "User accounts and their roles. Not in the sidebar — reached from the header search's Users results.",
};

export const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "nav.groupInventory",
    items: [
      {
        nameKey: "nav.receivedItemsInventory",
        href: "/received-inventory",
        purpose:
          "Machine/item registry (the equipment catalogue, not repair jobs). Add, edit and delete item models by name, serial number and item type; export the list to CSV.",
      },
      {
        nameKey: "nav.sparePartInventory",
        href: "/spareparts",
        purpose:
          "Spare-parts catalogue and stock. Add, edit and delete parts; stock in and manual stock out with a reason; view part specs, price, barcode and picture.",
      },
    ],
  },
  {
    titleKey: "nav.groupCustomer",
    items: [
      {
        nameKey: "nav.customerCenter",
        href: "/customers",
        purpose:
          "Customer companies and contacts. Create, edit and delete customers with company name, contact person, phone and address.",
      },
    ],
  },
  {
    titleKey: "nav.groupTechnical",
    items: [
      {
        nameKey: "nav.receivedItems",
        href: "/receive-item",
        purpose:
          "Intake queue — machines just booked in. Send one on to be diagnosed, or open it to edit the intake record.",
        status: "Item Recieved",
      },
      {
        nameKey: "nav.inspectItems",
        href: "/inspect-item",
        purpose:
          "Machines being diagnosed now. 'Accept' opens the inspection dialog to record findings, solution, service type and the spare parts needed.",
        status: "Inspecting",
      },
      {
        nameKey: "nav.inspection",
        href: "/inspection",
        purpose: "Completed diagnoses, with tabs across the later stages of the workflow.",
        status: "Inspection",
        tabs: [
          "Inspection",
          "Awaiting Sparepart",
          "Awaiting Customer Confirm",
          "Sale Confirmed",
          "Sent Spareparts",
        ],
      },
      {
        nameKey: "nav.approveRepairing",
        href: "/approve-repair",
        purpose:
          "Approve a job to start repair. Approving stamps repairDate/repairBy and deducts the attached spare-part stock.",
        status: "Repairing",
        tabs: ["Repairing", "Sent Spareparts", "Inspection", "Sale Confirmed"],
      },
      {
        nameKey: "nav.approveVerify",
        href: "/approve-verify",
        purpose:
          "Final QA. Verify a finished repair to close the job out, print the ticket report, or export the queue to CSV.",
        status: "Finished",
      },
    ],
  },
  {
    titleKey: "nav.groupStock",
    items: [
      {
        nameKey: "nav.technicalRequestSpare",
        href: "/spare-request",
        purpose: "Jobs held waiting on parts — the stock team's queue for issuing spare parts.",
        status: "Awaiting Sparepart",
        tabs: ["Inspection", "Awaiting Sparepart"],
      },
      {
        nameKey: "nav.confirmedSale",
        href: "/confirmed-sale",
        purpose: "Jobs sales has approved, ready for parts to be issued to the technician.",
        status: "Sale Confirmed",
        tabs: ["Awaiting Customer Confirm", "Sale Confirmed", "Sent Spareparts"],
      },
    ],
  },
  {
    titleKey: "nav.groupSale",
    items: [
      {
        nameKey: "nav.setWaitingCustomer",
        href: "/waiting-confirm",
        purpose:
          "Quotes with the customer. Record the decision: approved for repair, rejected, or found unrepairable.",
        status: "Awaiting Customer Confirm",
        tabs: [
          "Item Recieved",
          "Inspection",
          "Awaiting Sparepart",
          "Awaiting Customer Confirm",
          "Sale Confirmed",
          "Sent Spareparts",
        ],
      },
    ],
  },
  {
    titleKey: "nav.groupRejected",
    items: [
      {
        nameKey: "nav.customerRejected",
        href: "/rejected",
        purpose: "Jobs the customer declined to have repaired.",
        status: "Customer Rejected",
      },
      {
        nameKey: "nav.setUnrepairable",
        href: "/unrepairable",
        purpose: "Jobs judged beyond repair.",
        status: "Unrepairable",
      },
    ],
  },
  {
    // Ports of the Blazor app's Pages/Reports screens. Layout for each lives in
    // an .xlsx under public/templates/ — edit those in Excel to change columns,
    // headers or styling. See services/excelTemplate.ts.
    titleKey: "nav.groupReports",
    items: [
      {
        nameKey: "nav.dailyReport",
        href: "/daily-report",
        purpose:
          "Daily repair report: the day's tickets grouped by status, so a supervisor can see what is stuck where. Defaults to today; any date range can be chosen.",
      },
      {
        nameKey: "nav.monthlyReport",
        href: "/monthly-report",
        purpose:
          "Monthly repair report: every ticket in a chosen date range, grouped by company, with per-company subtotals and a Fixed / Customer Rejected / Unrepairable breakdown.",
      },
      {
        nameKey: "nav.customerReport",
        href: "/customer-report",
        purpose:
          "Customer report: tickets grouped by company with contact name and phone, so one customer's activity for the period reads as a single block.",
      },
      {
        nameKey: "nav.engineerReport",
        href: "/engineer-report",
        purpose:
          "Engineer report: tickets grouped by the technician who worked them, with days taken, showing each engineer's workload for the period.",
      },
      {
        nameKey: "nav.repairReport",
        href: "/repair-report",
        purpose:
          "Repair summary: a matrix of engineers against months of the year, counting jobs each engineer handled per month, with a per-engineer total.",
      },
      {
        nameKey: "nav.historyReport",
        href: "/history-report",
        purpose:
          "Machine history: tickets grouped by serial number, so one machine's whole repair history reads top to bottom with the inspection and solution for each visit. Defaults to the current year.",
      },
      {
        nameKey: "nav.sparepartUsage",
        href: "/sparepart-usage",
        purpose:
          "Spare part usage: what was consumed over the period, split by whether it left stock through a service job or a manual stock-out.",
      },
      {
        nameKey: "nav.sparepartHold",
        href: "/sparepart-hold",
        purpose:
          "Spare part hold: parts committed to open jobs but not yet consumed, with effective stock after holds. Describes the present moment, so it takes no date range.",
      },
    ],
  },
];

/** Every routable destination, sidebar or not — what the assistant may offer to open. */
export const ALL_NAV_ITEMS: NavItem[] = [
  HOME_ITEM,
  ...NAV_GROUPS.flatMap((group) => group.items),
  USERS_ITEM,
  SETTINGS_ITEM,
];

/** Resolves a route to its menu entry; used to validate an assistant-proposed destination. */
export function findNavItem(href: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => item.href === href);
}
