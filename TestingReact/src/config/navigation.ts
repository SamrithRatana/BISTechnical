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

export interface NavSubGroup {
  /** i18n key for the sub-group title. */
  titleKey: TranslationKey;
  /** Optional icon name for this subcategory. */
  iconName?: string;
  /** Optional purpose description for AI assistant context. */
  purpose?: string;
  items: NavItem[];
}

export interface NavGroup {
  titleKey: TranslationKey;
  items?: NavItem[];
  subGroups?: NavSubGroup[];
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
    // Structured 5-category reporting ecosystem
    titleKey: "nav.groupReports",
    subGroups: [
      {
        titleKey: "nav.subgroupOperations",
        iconName: "Wrench",
        purpose: "Core everyday repair and operational reports.",
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
            nameKey: "nav.monthlyTechnicalMatrix",
            href: "/monthly-technical-matrix",
            purpose:
              "Monthly technical department performance and forecast matrix: full 12-month KPI table with auto-calculated database figures, editable manual metrics, and forecast summary notes.",
          },
          {
            nameKey: "nav.pendingRepairs",
            href: "/pending-repairs",
            purpose:
              "Active backlog and work-in-progress report: all incomplete tickets currently in progress or waiting, with aging days taken, bottleneck status and assigned technician.",
          },
          {
            nameKey: "nav.completedRepairs",
            href: "/completed-repairs",
            purpose:
              "Completed repair report: tickets finished within a chosen date range, filtered by finished date, with turnaround time, solution and spare parts used.",
          },
          {
            nameKey: "nav.stageReport",
            href: "/stage-report",
            purpose:
              "Stage activity report: service tickets filtered by specific process milestone dates (Inspection, Await Confirm, Repairing, Finished), tracking throughput for each workflow stage.",
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
            nameKey: "nav.thirdPartyRepairs",
            href: "/third-party-repairs",
            purpose:
              "Third-party outsourced repairs: tickets sent to external vendor workshops with days out and return status.",
          },
          {
            nameKey: "nav.locationReport",
            href: "/location-report",
            purpose:
              "Service location report: on-site technician visits to customer premises compared to in-house workshop repairs.",
          },
        ],
      },
      {
        titleKey: "nav.subgroupDiagnostics",
        iconName: "AlertCircle",
        purpose: "Quality assurance, common symptoms, diagnostics, and scrap equipment analysis.",
        items: [
          {
            nameKey: "nav.faultsReport",
            href: "/faults-report",
            purpose:
              "Common faults & diagnostics report: common machine errors, inspection diagnoses, and applied solutions grouped by model.",
          },
          {
            nameKey: "nav.rejectedReport",
            href: "/rejected-report",
            purpose:
              "Rejected & scrap report: tickets marked as Customer Rejected or Unrepairable with inspection diagnosis and customer requests.",
          },
        ],
      },
      {
        titleKey: "nav.subgroupEngineerKpi",
        iconName: "Award",
        purpose: "Technician KPI scorecard, MTTR turnaround, and engineer workload distribution.",
        items: [
          {
            nameKey: "nav.engineerKpi",
            href: "/engineer-kpi-report",
            purpose:
              "Technician KPI & Performance Scorecard: objective metrics per engineer including completed jobs, MTTR, fix success rate %, active WIP load, and ranking grade.",
          },
          {
            nameKey: "nav.engineerReport",
            href: "/engineer-report",
            purpose:
              "Engineer report: tickets grouped by the technician who worked them, with days taken, showing each engineer's workload for the period.",
          },
        ],
      },
      {
        titleKey: "nav.subgroupSalesCrm",
        iconName: "TrendingUp",
        purpose: "Sales follow-up, quote win/loss rate, replacement machine leads, contract renewals, and top accounts.",
        items: [
          {
            nameKey: "nav.salesFollowup",
            href: "/sales-followup",
            purpose:
              "Quotation follow-up tracker: tickets awaiting customer confirmation with contact details, quoted spare parts, and days waiting.",
          },
          {
            nameKey: "nav.salesConversion",
            href: "/sales-conversion-report",
            purpose:
              "Sales quote conversion report: quote approval rate % (Sale Confirmed vs Customer Rejected) and average closing days.",
          },
          {
            nameKey: "nav.salesLeads",
            href: "/sales-leads-report",
            purpose:
              "New machine hot sales leads: unrepairable and customer rejected jobs to pitch new replacement equipment.",
          },
          {
            nameKey: "nav.contractRenewal",
            href: "/contract-renewal-report",
            purpose:
              "Contract SLA renewal tracker: identifies expiring maintenance agreements and high-frequency walk-in clients ready to upgrade to annual AMC.",
          },
          {
            nameKey: "nav.topCustomers",
            href: "/top-customers-report",
            purpose:
              "Top customer accounts: ranks top enterprise and VIP clients by service frequency and parts usage with dynamic CustomerType.",
          },
          {
            nameKey: "nav.customerReport",
            href: "/customer-report",
            purpose:
              "Customer report: tickets grouped by company with contact name and phone, so one customer's activity for the period reads as a single block.",
          },
          {
            nameKey: "nav.contractReport",
            href: "/contract-report",
            purpose:
              "Contract vs walk-in report: service volume breakdown between annual SLA maintenance contracts and per-visit chargeable walk-in customers.",
          },
        ],
      },
      {
        titleKey: "nav.subgroupStockParts",
        iconName: "Package",
        purpose: "Spare parts consumption, stock transaction ledger, movement, reconciliations, and health audits.",
        items: [
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
          {
            nameKey: "nav.stockTransactions",
            href: "/stock-transactions",
            purpose:
              "Stock transaction ledger: every individual stock movement in the period, newest first, with the running balance after each one and the ticket it came from. Filterable to stock-in only, stock-out only or adjustments only.",
          },
          {
            nameKey: "nav.stockMovement",
            href: "/stock-movement",
            purpose:
              "Stock movement summary: per part over the period — opening balance, total in, total out, net change, closing balance, and the live catalogue quantity for comparison.",
          },
          {
            nameKey: "nav.stockAdjustments",
            href: "/stock-adjustments",
            purpose:
              "Inventory adjustments: stock changed by editing the catalogue quantity directly rather than through a repair job, with the before and after values and the stated reason.",
          },
          {
            nameKey: "nav.stockReconciliation",
            href: "/stock-reconciliation",
            purpose:
              "Stock reconciliation: for a chosen date range, explains why the Telegram stock-out notification count and the usage report figure disagree.",
          },
          {
            nameKey: "nav.stockHealth",
            href: "/stock-health",
            purpose:
              "Stock data health: standing faults that make stock numbers disagree — Telegram notifications sent for movements the ledger never recorded, returns with no matching issue, parts whose ledger implies an impossible opening balance, negative stock, and duplicate catalogue names.",
          },
          {
            nameKey: "nav.stockDead",
            href: "/stock-dead",
            purpose:
              "Dead stock: parts holding stock that has not moved in 90 days, with how much of it is already on hold.",
          },
        ],
      },
    ],
  },
];

/** Every routable destination, sidebar or not — what the assistant may offer to open. */
export const ALL_NAV_ITEMS: NavItem[] = [
  HOME_ITEM,
  ...NAV_GROUPS.flatMap((group) => [
    ...(group.items ?? []),
    ...(group.subGroups?.flatMap((sg) => sg.items) ?? []),
  ]),
  USERS_ITEM,
  SETTINGS_ITEM,
];

/** Resolves a route to its menu entry; used to validate an assistant-proposed destination. */
export function findNavItem(href: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => item.href === href);
}
