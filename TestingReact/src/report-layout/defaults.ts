/**
 * @file report-layout/defaults.ts
 * @description The shipped template, and the merge that keeps older saved
 * blobs loadable.
 *
 * See `types.ts` for why this folder has no framework imports.
 */

import {
  ALL_COLUMN_KEYS,
  DEFAULT_REPORT_LABELS,
  type ReportColumnKey,
  type ReportInfoRow,
  type ReportSectionKey,
  type ReportSignatureRole,
  type ReportTemplateSettings,
} from "./types";

export const ALL_SECTION_KEYS: ReportSectionKey[] = [
  "customer", "instrument", "request", "diagnostic", "solution",
];

export const ALL_SIGNATURE_ROLES: ReportSignatureRole[] = ["customer", "verify", "engineer"];

export const DEFAULT_REPORT_TEMPLATE: ReportTemplateSettings = {
  pageMarginPx: 20,
  baseFontPt: 10,
  lineHeight: 1.3,
  sectionGapPx: 10,
  labelColWidthPx: 230,
  logoVisible: true,
  logoHeightPx: 96,
  logoSource: "default",
  logoCustomUrl: "",
  titleVisible: true,
  titleText: "TECHNICAL SERVICE REPORT",
  titleFontPt: 12,
  headerBoxesVisible: true,
  tableFontPt: 9.5,
  columns: {
    no: true,
    description: true,
    useFor: true,
    partNo: true,
    qty: true,
    condition: true,
    unitPrice: false,
    total: false,
    remarks: false,
  },
  sectionOrder: [...ALL_SECTION_KEYS],
  sections: {
    customer: true,
    instrument: true,
    request: true,
    diagnostic: true,
    solution: true,
  },
  signaturesVisible: true,
  signatureOrder: [...ALL_SIGNATURE_ROLES],
  fontFamily: "khmer",
  contentIndentPx: 36,
  tableCellPaddingPx: 4,
  tableBorderWidthPx: 1,
  emptyTableHeightPx: 80,
  headerLeftBoxPercent: 57,
  columnWidths: { no: 32, useFor: 192, partNo: 112, qty: 40, condition: 80, unitPrice: 80, total: 80, remarks: 128 },
  columnOrder: [...ALL_COLUMN_KEYS],
  signatureRoles: { customer: true, verify: true, engineer: true },
  infoRowsCustomer: [
    { id: "companyName", label: "Company Name (ឈ្មោះក្រុមហ៊ុន) :", field: "companyName", visible: true },
    { id: "attention", label: "Attention (អ្នកទទួលខុសត្រូវ) :", field: "contactName", visible: true },
    { id: "tel", label: "Tel (លេខទូរស័ព្ទ) :", field: "phoneNumber", visible: true },
    { id: "address", label: "Address (អាសយដ្ឋាន) :", field: "address", visible: true },
  ],
  infoRowsInstrument: [
    { id: "productName", label: "Product Name (ឈ្មោះម៉ាស៊ីន) :", field: "itemName", visible: true },
    { id: "serialNumber", label: "Serial Number (លេខកូដ) :", field: "serialNumber", visible: true },
    { id: "serviceType", label: "Type of Service (ប្រភេទសេវាកម្ម) :", field: "serviceType", visible: true },
  ],
  headerFields: {
    reportNo: "reportNo",
    boxOnSite: "serviceLocation",
    boxCompanyService: "serviceLocation",
    boxContract: "hasContract",
    boxDateStart: "serviceDate",
    boxDateFinish: "finishedDate",
    boxDateWaiting: "statusDate",
    status: "status",
  },
  signatureFields: {
    verifyName: "verifiedByName",
    verifyPhone: "createdByPhone",
    engineerName: "repairByName",
    engineerPhone: "repairByPhone",
  },
  bodyFields: { request: "customerRequest", diagnostic: "inspection", solution: "solution" },
  labels: DEFAULT_REPORT_LABELS,
  componentOffsets: {},
};

/**
 * Completes a saved order list: keeps the user's sequence, drops anything
 * unrecognised or duplicated, then appends whatever keys the build added
 * since the blob was written. A template saved before a key existed still
 * prints that key rather than silently losing it.
 */
function completeOrder<T extends string>(saved: readonly T[] | undefined, all: readonly T[]): T[] {
  const seen = new Set<T>();
  const order: T[] = [];
  for (const key of saved ?? []) {
    if (!all.includes(key) || seen.has(key)) continue;
    seen.add(key);
    order.push(key);
  }
  for (const key of all) if (!seen.has(key)) order.push(key);
  return order;
}

/**
 * The next free id for a row added to an info section.
 *
 * Derived from the rows that already exist rather than from a clock. Two
 * reasons: `Date.now()` collides when two rows are added inside the same
 * millisecond (paste, or a fast double-click), and calling it while React is
 * rendering is impure — a render can be discarded and replayed, so the id is
 * not stable, which `react-hooks/purity` correctly rejects.
 */
export function nextInfoRowId(rows: readonly ReportInfoRow[], prefix = "r"): string {
  let highest = 0;
  for (const row of rows) {
    const match = /^(?:r|row)_(\d+)$/.exec(row.id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}_${highest + 1}`;
}

/** Deep-merge over defaults so a blob saved by an older build never strips newer fields. */
export function withDefaults(raw: Partial<ReportTemplateSettings>): ReportTemplateSettings {
  return {
    ...DEFAULT_REPORT_TEMPLATE,
    ...raw,
    columns: { ...DEFAULT_REPORT_TEMPLATE.columns, ...(raw.columns ?? {}) },
    sections: { ...DEFAULT_REPORT_TEMPLATE.sections, ...(raw.sections ?? {}) },
    columnWidths: { ...DEFAULT_REPORT_TEMPLATE.columnWidths, ...(raw.columnWidths ?? {}) },
    columnOrder: completeOrder<ReportColumnKey>(raw.columnOrder, ALL_COLUMN_KEYS),
    sectionOrder: completeOrder<ReportSectionKey>(raw.sectionOrder, ALL_SECTION_KEYS),
    signatureOrder: completeOrder<ReportSignatureRole>(raw.signatureOrder, ALL_SIGNATURE_ROLES),
    signatureRoles: { ...DEFAULT_REPORT_TEMPLATE.signatureRoles, ...(raw.signatureRoles ?? {}) },
    labels: (() => {
      const merged = { ...DEFAULT_REPORT_LABELS, ...(raw.labels ?? {}) };
      if (merged.boxDateWaiting && merged.boxDateWaiting.trim() === "Date Waiting") {
        merged.boxDateWaiting = "Date Waiting:";
      }
      return merged;
    })(),
    infoRowsCustomer: raw.infoRowsCustomer?.length
      ? raw.infoRowsCustomer
      : DEFAULT_REPORT_TEMPLATE.infoRowsCustomer,
    infoRowsInstrument: raw.infoRowsInstrument?.length
      ? raw.infoRowsInstrument
      : DEFAULT_REPORT_TEMPLATE.infoRowsInstrument,
    bodyFields: { ...DEFAULT_REPORT_TEMPLATE.bodyFields, ...(raw.bodyFields ?? {}) },
    headerFields: { ...DEFAULT_REPORT_TEMPLATE.headerFields, ...(raw.headerFields ?? {}) },
    signatureFields: { ...DEFAULT_REPORT_TEMPLATE.signatureFields, ...(raw.signatureFields ?? {}) },
    componentOffsets: raw.componentOffsets ?? {},
  };
}
