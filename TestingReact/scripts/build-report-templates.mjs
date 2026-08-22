/**
 * Generates every report template workbook into `public/templates/`.
 *
 *   npm run build:templates
 *
 * The generated .xlsx files are the *source of truth for report layout* —
 * column order, headers, widths, fonts, fills, page setup. Open one in Excel,
 * change it, save, and the app picks the change up on next load. Nothing in the
 * React code decides what the columns are.
 *
 * This script exists so a template can be rebuilt if one is corrupted, and so
 * the initial design is reviewable as a readable diff. Day to day, edit the
 * .xlsx directly — **re-running this overwrites hand edits**.
 *
 * ## The placeholder contract (see src/services/excelTemplate.ts)
 *
 *   {{title}} {{subtitle}}      scalar text, replaced in place
 *   {{group}}                   PROTOTYPE row, cloned once per group
 *   {{<field>}}                 PROTOTYPE data row; each token names the record
 *                               property printed in that cell — so cell order
 *                               *is* column order
 *   {{subtotal}} {{count}}      PROTOTYPE row, cloned once per group
 *   {{grandTotal}} {{total}}    scalar
 *   {{summary}}                 scalar
 *
 * Prototype rows are cloned for their styling then removed; they never appear
 * in output. Reports with `grouped: false` omit the group and subtotal
 * prototypes entirely.
 */

import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "public", "templates");

const NAVY = "FF1E3A5F";
const GROUP_BLUE = "FFDCE9F7";
const SUBTOTAL_GREY = "FFF1F5F9";
const GRAND_GREY = "FFCBD5E1";

const thin = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const R = "right";

/**
 * One entry per report. Columns mirror the Blazor originals under
 * src/Apps/ServiceMaintenance/Pages/Reports so staff reconciling old against
 * new see the same document.
 */
const REPORTS = [
  {
    file: "monthly-report",
    sheet: "Monthly Report",
    grouped: true,
    columns: [
      { header: "Date", field: "serviceDate", width: 14 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Item Name", field: "itemName", width: 34 },
      { header: "Serial Number", field: "serialNumber", width: 22 },
      { header: "Status", field: "status", width: 22 },
    ],
  },
  {
    file: "daily-report",
    sheet: "Daily Report",
    grouped: true, // by status
    columns: [
      { header: "Date", field: "serviceDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 32 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Service Type", field: "serviceType", width: 14 },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "customer-report",
    sheet: "Customer Report",
    grouped: true, // by company
    columns: [
      { header: "Date", field: "serviceDate", width: 14 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Contact", field: "contactName", width: 22 },
      { header: "Phone", field: "phoneNumber", width: 16 },
      { header: "Item Name", field: "itemName", width: 28 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "engineer-report",
    sheet: "Engineer Report",
    grouped: true, // by engineer
    columns: [
      { header: "Date", field: "serviceDate", width: 14 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Days", field: "daysTaken", width: 8, align: R },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "history-report",
    sheet: "Machine History",
    grouped: true, // by serial number
    columns: [
      { header: "Date", field: "serviceDate", width: 14 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 28 },
      { header: "Item Name", field: "itemName", width: 24 },
      { header: "Inspection", field: "inspection", width: 34 },
      { header: "Solution", field: "solution", width: 34 },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "repair-report",
    sheet: "Repair Summary",
    grouped: false, // one row per engineer, months across
    columns: [
      { header: "Engineer", field: "engineer", width: 26 },
      { header: "Jan", field: "m1", width: 7, align: R },
      { header: "Feb", field: "m2", width: 7, align: R },
      { header: "Mar", field: "m3", width: 7, align: R },
      { header: "Apr", field: "m4", width: 7, align: R },
      { header: "May", field: "m5", width: 7, align: R },
      { header: "Jun", field: "m6", width: 7, align: R },
      { header: "Jul", field: "m7", width: 7, align: R },
      { header: "Aug", field: "m8", width: 7, align: R },
      { header: "Sep", field: "m9", width: 7, align: R },
      { header: "Oct", field: "m10", width: 7, align: R },
      { header: "Nov", field: "m11", width: 7, align: R },
      { header: "Dec", field: "m12", width: 7, align: R },
      { header: "Total", field: "totalJobs", width: 9, align: R },
    ],
  },
  {
    file: "pending-repairs",
    sheet: "Pending Repairs",
    grouped: true, // by status
    columns: [
      { header: "Date", field: "serviceDate", width: 14 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Days Stuck", field: "daysTaken", width: 12, align: R },
      { header: "Engineer", field: "engineer", width: 22 },
      { header: "Status", field: "status", width: 22 },
    ],
  },
  {
    file: "completed-repairs",
    sheet: "Completed Repairs",
    grouped: true, // by engineer
    columns: [
      { header: "Finished Date", field: "finishedDate", width: 15 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Days Taken", field: "daysTaken", width: 12, align: R },
      { header: "Engineer", field: "engineer", width: 22 },
      { header: "Solution", field: "solution", width: 34 },
    ],
  },
  {
    file: "stage-report",
    sheet: "Stage Activity Report",
    grouped: true, // by performer
    columns: [
      { header: "Action Date", field: "stageDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Performed By", field: "performedBy", width: 22 },
      { header: "Current Status", field: "status", width: 20 },
    ],
  },
  {
    file: "rejected-report",
    sheet: "Rejected & Scrap Report",
    grouped: true, // by status (Customer Rejected / Unrepairable)
    columns: [
      { header: "Date", field: "serviceDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Customer Request", field: "customerRequest", width: 28 },
      { header: "Inspection / Reason", field: "inspection", width: 32 },
      { header: "Decided By", field: "decidedBy", width: 22 },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "third-party-repairs",
    sheet: "Third-Party Repairs",
    grouped: true, // by current status
    columns: [
      { header: "Sent Date", field: "thirdPartyRepairDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Days Out", field: "daysTaken", width: 12, align: R },
      { header: "Handled By", field: "thirdPartyRepairByName", width: 22 },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "contract-report",
    sheet: "Contract Service Report",
    grouped: true, // by contract status (Contract / Walk-in)
    columns: [
      { header: "Date", field: "serviceDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Contract", field: "contractLabel", width: 18 },
      { header: "Service Type", field: "serviceType", width: 16 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "location-report",
    sheet: "Service Location Report",
    grouped: true, // by location (OnSite / CompanyService)
    columns: [
      { header: "Date", field: "serviceDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Location", field: "locationLabel", width: 20 },
      { header: "Engineer", field: "engineer", width: 22 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "faults-report",
    sheet: "Faults & Diagnostics",
    grouped: true, // by item name / model
    columns: [
      { header: "Date", field: "serviceDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Reported Fault", field: "customerRequest", width: 28 },
      { header: "Inspection Finding", field: "inspection", width: 32 },
      { header: "Applied Solution", field: "solution", width: 34 },
    ],
  },
  {
    file: "sales-followup",
    sheet: "Quotation Follow-up",
    grouped: true, // by company
    columns: [
      { header: "Quoted Date", field: "awaitingDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Contact Person", field: "contactName", width: 22 },
      { header: "Phone Number", field: "phoneNumber", width: 18 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Quoted Parts", field: "quotedParts", width: 34 },
      { header: "Days Waiting", field: "daysWaiting", width: 14, align: R },
    ],
  },
  {
    file: "sales-conversion-report",
    sheet: "Quote Conversion Rate",
    grouped: true, // by sales rep or status
    columns: [
      { header: "Decision Date", field: "decisionDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Item Name", field: "itemName", width: 26 },
      { header: "Sales Rep", field: "salesRep", width: 22 },
      { header: "Closing Days", field: "closingDays", width: 14, align: R },
      { header: "Outcome", field: "outcome", width: 18 },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "sales-leads-report",
    sheet: "New Machine Hot Leads",
    grouped: true, // by status
    columns: [
      { header: "Date", field: "serviceDate", width: 18 },
      { header: "Report #", field: "reportNo", width: 16 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Contact Person", field: "contactName", width: 22 },
      { header: "Phone Number", field: "phoneNumber", width: 18 },
      { header: "Item Model", field: "itemName", width: 26 },
      { header: "Diagnosis / Reason", field: "inspection", width: 34 },
      { header: "Status", field: "status", width: 20 },
    ],
  },
  {
    file: "contract-renewal-report",
    sheet: "Contract SLA Renewal",
    grouped: true, // by contract status
    columns: [
      { header: "Company Name", field: "companyName", width: 32 },
      { header: "Customer Type", field: "customerType", width: 18 },
      { header: "Contact Person", field: "contactName", width: 22 },
      { header: "Phone Number", field: "phoneNumber", width: 18 },
      { header: "Contract Status", field: "contractStatus", width: 18 },
      { header: "Total Repairs", field: "totalRepairs", width: 14, align: R },
      { header: "Last Service Date", field: "lastServiceDate", width: 18 },
      { header: "Suggested Action", field: "suggestedAction", width: 24 },
    ],
  },
  {
    file: "top-customers-report",
    sheet: "Top Customer Accounts",
    grouped: false, // ranked list
    columns: [
      { header: "Rank", field: "rank", width: 8, align: R },
      { header: "Company Name", field: "companyName", width: 34 },
      { header: "Customer Type", field: "customerType", width: 18 },
      { header: "Total Jobs", field: "totalJobs", width: 12, align: R },
      { header: "Finished", field: "finishedJobs", width: 12, align: R },
      { header: "Chargeable Jobs", field: "chargeableJobs", width: 16, align: R },
      { header: "Parts Used", field: "partsUsed", width: 14, align: R },
      { header: "Account Tier", field: "tier", width: 16 },
    ],
  },
  {
    file: "engineer-kpi-report",
    sheet: "Technician KPI Scorecard",
    grouped: false, // ranked list
    columns: [
      { header: "Rank", field: "rank", width: 8, align: R },
      { header: "Engineer Name", field: "engineerName", width: 26 },
      { header: "Assigned Jobs", field: "assignedJobs", width: 14, align: R },
      { header: "Finished Jobs", field: "finishedJobs", width: 14, align: R },
      { header: "MTTR / Avg Days", field: "avgDays", width: 16, align: R },
      { header: "Success Rate %", field: "successRate", width: 16, align: R },
      { header: "Active WIP Load", field: "activeWip", width: 16, align: R },
      { header: "KPI Grade", field: "grade", width: 14 },
    ],
  },
  {
    file: "sparepart-usage",
    sheet: "Spare Part Usage",
    grouped: false,
    columns: [
      { header: "Spare Part", field: "itemName", width: 34 },
      { header: "Serial Number", field: "serialNumber", width: 22 },
      { header: "Stock Qty", field: "stockQuantity", width: 12, align: R },
      { header: "Used Qty", field: "usedQuantity", width: 12, align: R },
      { header: "From Service", field: "serviceUsedQty", width: 14, align: R },
      { header: "Manual Out", field: "manualUsedQty", width: 13, align: R },
      { header: "Usage Count", field: "usageCount", width: 13, align: R },
    ],
  },
  {
    file: "sparepart-hold",
    sheet: "Spare Part Hold",
    grouped: false,
    columns: [
      { header: "Spare Part", field: "itemName", width: 34 },
      { header: "Serial Number", field: "serialNumber", width: 22 },
      { header: "Current Stock", field: "currentStock", width: 14, align: R },
      { header: "Hold Qty", field: "totalHoldQty", width: 12, align: R },
      { header: "Effective Stock", field: "effectiveStock", width: 15, align: R },
      { header: "Hold Jobs", field: "holdCount", width: 12, align: R },
    ],
  },

  // ── Stock transaction reporting ──────────────────────────────────────────
  // The four below read the audit log as MOVEMENTS rather than as a net total
  // per part. The usage report nets a return against an issue, so neither is
  // visible on its own; roughly 100 units returned to stock over six months
  // without appearing as a line anyone could read.
  {
    file: "stock-transactions",
    sheet: "Stock Transactions",
    grouped: false,
    columns: [
      { header: "Date / Time", field: "when", width: 19 },
      { header: "Spare Part", field: "itemName", width: 32 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Type", field: "typeLabel", width: 13 },
      { header: "Source", field: "sourceLabel", width: 13 },
      { header: "Qty", field: "signedQty", width: 8, align: R },
      { header: "Balance", field: "balanceAfter", width: 10, align: R },
      { header: "Report No", field: "reportNo", width: 17 },
      { header: "Company", field: "companyName", width: 30 },
      { header: "Reason", field: "reason", width: 46 },
    ],
  },
  {
    file: "stock-movement",
    sheet: "Stock Movement",
    grouped: false,
    columns: [
      { header: "Spare Part", field: "itemName", width: 34 },
      { header: "Serial Number", field: "serialNumber", width: 22 },
      { header: "Opening", field: "openingBalance", width: 11, align: R },
      { header: "Stock In", field: "totalIn", width: 11, align: R },
      { header: "Stock Out", field: "totalOut", width: 11, align: R },
      { header: "Net", field: "netChange", width: 9, align: R },
      { header: "Closing", field: "closingBalance", width: 11, align: R },
      { header: "Current Stock", field: "currentStock", width: 14, align: R },
      { header: "Movements", field: "movementCount", width: 12, align: R },
    ],
  },
  {
    file: "stock-adjustments",
    sheet: "Stock Adjustments",
    grouped: false,
    columns: [
      { header: "Date / Time", field: "when", width: 19 },
      { header: "Spare Part", field: "itemName", width: 34 },
      { header: "Serial Number", field: "serialNumber", width: 22 },
      { header: "Type", field: "typeLabel", width: 13 },
      { header: "Qty", field: "signedQty", width: 8, align: R },
      { header: "Before", field: "balanceBefore", width: 10, align: R },
      { header: "After", field: "balanceAfter", width: 10, align: R },
      { header: "Reason", field: "reason", width: 52 },
    ],
  },
  {
    file: "stock-reconciliation",
    sheet: "Stock Reconciliation",
    grouped: false,
    columns: [
      { header: "Spare Part", field: "itemName", width: 32 },
      { header: "Serial Number", field: "serialNumber", width: 20 },
      { header: "Qty", field: "quantity", width: 7, align: R },
      { header: "Went out", field: "outLabel", width: 18 },
      { header: "Returned", field: "backLabel", width: 18 },
      { header: "Out for", field: "openLabel", width: 12, align: R },
      { header: "Why", field: "why", width: 30 },
      { header: "Report No", field: "reportNo", width: 17 },
      { header: "In ledger?", field: "ledgerLabel", width: 13 },
    ],
  },
  {
    file: "stock-health",
    sheet: "Stock Data Health",
    grouped: false,
    columns: [
      { header: "Severity", field: "severityLabel", width: 11 },
      { header: "Issue", field: "categoryLabel", width: 22 },
      { header: "Spare Part", field: "itemName", width: 30 },
      { header: "Serial / Entries", field: "serialNumber", width: 34 },
      { header: "Report No", field: "reportNo", width: 16 },
      { header: "When", field: "whenLabel", width: 18 },
      { header: "What is wrong", field: "detail", width: 62 },
    ],
  },
  {
    file: "stock-dead",
    sheet: "Dead Stock",
    grouped: false,
    columns: [
      { header: "Spare Part", field: "itemName", width: 34 },
      { header: "Serial Number", field: "serialNumber", width: 22 },
      { header: "Stock Qty", field: "quantity", width: 12, align: R },
      { header: "On Hold", field: "heldQuantity", width: 11, align: R },
      { header: "Available", field: "availableQty", width: 12, align: R },
      { header: "Last Movement", field: "lastMovementLabel", width: 18 },
      { header: "Days Idle", field: "daysIdleLabel", width: 12, align: R },
    ],
  },
];

function buildReport(spec) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BIS Technical Service";

  const ws = wb.addWorksheet(spec.sheet, {
    // Frozen below the header row. The viewer reads this too, so the on-screen
    // table freezes exactly where the file says it should.
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });

  const cols = spec.columns;
  const last = cols.length;
  ws.columns = cols.map((c) => ({ width: c.width }));

  // 1. Title
  ws.getCell("A1").value = "{{title}}";
  ws.mergeCells(1, 1, 1, last);
  ws.getRow(1).height = 26;
  Object.assign(ws.getCell("A1"), {
    font: { bold: true, size: 15, color: { argb: NAVY } },
    alignment: { horizontal: "center", vertical: "middle" },
  });

  // 2. Subtitle
  ws.getCell("A2").value = "{{subtitle}}";
  ws.mergeCells(2, 1, 2, last);
  Object.assign(ws.getCell("A2"), {
    font: { italic: true, size: 10, color: { argb: "FF64748B" } },
    alignment: { horizontal: "center" },
  });

  // 3. Spacer
  ws.getRow(3).height = 6;

  // 4. Header
  const header = ws.getRow(4);
  header.height = 22;
  cols.forEach((col, i) => {
    const cell = header.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: col.align ?? "left", vertical: "middle", wrapText: true };
    cell.border = thin;
  });

  let row = 5;

  // 5. Group prototype (grouped reports only)
  if (spec.grouped) {
    const groupRow = ws.getRow(row);
    groupRow.getCell(1).value = "{{group}}";
    ws.mergeCells(row, 1, row, last);
    Object.assign(groupRow.getCell(1), {
      font: { bold: true, size: 11, color: { argb: NAVY } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_BLUE } },
      alignment: { horizontal: "left", vertical: "middle" },
      border: thin,
    });
    row++;
  }

  // 6. Data prototype — the tokens here define the columns
  const dataRow = ws.getRow(row);
  cols.forEach((col, i) => {
    const cell = dataRow.getCell(i + 1);
    cell.value = `{{${col.field}}}`;
    cell.font = { size: 10 };
    cell.alignment = { horizontal: col.align ?? "left", vertical: "top", wrapText: true };
    cell.border = thin;
  });
  row++;

  // 7. Subtotal prototype (grouped reports only)
  if (spec.grouped) {
    const subtotal = ws.getRow(row);
    subtotal.getCell(last - 1).value = "{{subtotal}}";
    subtotal.getCell(last).value = "{{count}}";
    for (let c = 1; c <= last; c++) {
      const cell = subtotal.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBTOTAL_GREY } };
      cell.border = thin;
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: c === last ? "left" : "right" };
    }
    row++;
  }

  // 8. Grand total
  const grand = ws.getRow(row);
  grand.getCell(last - 1).value = "{{grandTotal}}";
  grand.getCell(last).value = "{{total}}";
  for (let c = 1; c <= last; c++) {
    const cell = grand.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAND_GREY } };
    cell.border = thin;
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: c === last ? "left" : "right" };
  }
  row++;

  // 9. Summary breakdown
  ws.getCell(`A${row}`).value = "{{summary}}";
  ws.mergeCells(row, 1, row, last);
  Object.assign(ws.getCell(`A${row}`), {
    font: { size: 10, color: { argb: "FF334155" } },
    alignment: { horizontal: "left", vertical: "middle" },
    border: thin,
  });
  ws.getRow(row).height = 20;

  return wb;
}

mkdirSync(outDir, { recursive: true });
for (const spec of REPORTS) {
  const target = resolve(outDir, `${spec.file}.xlsx`);
  await buildReport(spec).xlsx.writeFile(target);
  console.log(`wrote ${spec.file}.xlsx  (${spec.columns.length} cols, ${spec.grouped ? "grouped" : "flat"})`);
}
