/**
 * @file report-layout/types.ts
 * @description Types for the Technical Service Report template.
 *
 * ── THIS FOLDER IS THE ONE REPORT LAYOUT ──────────────────────────────────
 * `src/report-layout/` is the single definition of the printed Technical
 * Service Report. It is plain TypeScript on purpose: no React, no Next, no
 * DOM, no `window`, no Node built-ins, no imports outside this folder. That
 * constraint is what lets the *same files* run inside the Expo/Metro bundle
 * on the CamID phone app, where they are mirrored to
 * `CamIdMobile/src/report-layout/` by `npm run sync:shared`.
 *
 * Web and mobile therefore print from the same code. Editing the layout in
 * one place changes both. Do not re-implement any part of this document in a
 * React component or in a mobile service — that is the drift this folder
 * exists to end.
 *
 * DEFAULTS ARE A CONTRACT: they reproduce the pre-settings report exactly
 * (the DevExpress Report2 replica), so an installation that never opens the
 * Templates Settings page prints what shipped before the feature existed.
 */

/** Every column the spare-parts table can print. The last three come from
 * RepairServices data (catalog price, qty x price, the line's remarks) and
 * default OFF so the shipped report is unchanged until someone enables them. */
export type ReportColumnKey =
  | "no" | "description" | "useFor" | "partNo" | "qty" | "condition"
  | "unitPrice" | "total" | "remarks";

export const ALL_COLUMN_KEYS: ReportColumnKey[] = [
  "no", "description", "useFor", "partNo", "qty", "condition", "unitPrice", "total", "remarks",
];

export type ReportColumnToggles = Record<ReportColumnKey, boolean>;

export type ReportSectionKey = "customer" | "instrument" | "request" | "diagnostic" | "solution";

export type ReportSignatureRole = "customer" | "verify" | "engineer";

/**
 * Every printed string a user can reword — headings, field labels, table
 * columns, box captions, signature captions. Defaults are the exact strings
 * the shipped report printed. Keys mirror where the text appears.
 */
export interface ReportLabels {
  secCustomer: string;
  secInstrument: string;
  secRequest: string;
  secDiagnostic: string;
  secSolution: string;
  boxReportNumber: string;
  boxOnSite: string;
  boxCompanyService: string;
  boxContract: string;
  boxDateStart: string;
  boxDateFinish: string;
  boxDateWaiting: string;
  colNo: string;
  colDescription: string;
  colUseFor: string;
  colPartNo: string;
  colQty: string;
  colCondition: string;
  colUnitPrice: string;
  colTotal: string;
  colRemarks: string;
  sigCustomerKm: string;
  sigCustomerEn: string;
  sigVerifyKm: string;
  sigVerifyEn: string;
  sigEngineerKm: string;
  sigEngineerEn: string;
  /** Printed when the ticket carries no verifier/engineer of its own. */
  sigVerifyName: string;
  sigVerifyPhone: string;
  sigEngineerName: string;
  sigEngineerPhone: string;
}

export const DEFAULT_REPORT_LABELS: ReportLabels = {
  secCustomer: "Customer Information (ព័ត៌មានអតិថិជន)",
  secInstrument: "Instrument Information (ព័ត៌មានសម្ភារៈ)",
  secRequest: "Customer Request / Complaint (សំណើនិងការអះអាងរបស់អតិថិជន)",
  secDiagnostic: "Diagnostic Analysis / Action Taken (វិនិច្ឆ័យខូចខាត និងការងារដែលបានធ្វើ)",
  secSolution: "Solution (ដំណោះស្រាយ)",
  boxReportNumber: "Report Number:",
  boxOnSite: "On Site:",
  boxCompanyService: "Company Service:",
  boxContract: "Service with Contract:",
  boxDateStart: "Date Start:",
  boxDateFinish: "Date Finish:",
  boxDateWaiting: "Date Waiting:",
  colNo: "No",
  colDescription: "Spare Part Descriptions",
  colUseFor: "Use For",
  colPartNo: "Part No",
  colQty: "Qty",
  colCondition: "Condition",
  colUnitPrice: "Unit Price",
  colTotal: "Total",
  colRemarks: "Remarks",
  sigCustomerKm: "ហត្ថលេខា និង ឈ្មោះអតិថិជន",
  sigCustomerEn: "Customer's signature",
  sigVerifyKm: "ហត្ថលេខា និង ឈ្មោះអ្នកផ្ទៀងផ្ទាត់",
  sigVerifyEn: "Verify's signature",
  sigEngineerKm: "ហត្ថលេខា និង ឈ្មោះជាង",
  sigEngineerEn: "Engineer's signature",
  sigVerifyName: "Seng KimNeang",
  sigVerifyPhone: "+855 16 221 237",
  sigEngineerName: "Sors Sokean",
  sigEngineerPhone: "+855 16 380 159",
};

/** A bindable field of the RepairServices record, with its data type so the
 * report can format it correctly (dates via the report date format, booleans
 * as the DevExpress-style checkboxes, numbers plain). */
export type TicketFieldType = "text" | "date" | "number" | "boolean";

export interface TicketFieldDef {
  key: string;
  type: TicketFieldType;
  group: "ticket" | "spareparts" | "customer" | "machine" | "dates" | "people";
}

/** One printed label/value line in an info section — label text, the bound
 * database field, visibility, typography & alignment, in user-chosen order. */
export interface ReportInfoRow {
  id: string;
  label: string;
  field: string;
  visible: boolean;
  fontPt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontFamily?: string;
  align?: "left" | "center" | "right";
  color?: string;

  // Value typography & alignment (independent from label)
  valueFontPt?: number;
  valueBold?: boolean;
  valueItalic?: boolean;
  valueUnderline?: boolean;
  valueFontFamily?: string;
  valueAlign?: "left" | "center" | "right";
  valueColor?: string;
}

export type ReportSectionToggles = Record<ReportSectionKey, boolean>;

export type ReportSignatureToggles = Record<ReportSignatureRole, boolean>;

/** Fixed px widths; description has none (it takes the remaining space). */
export type ReportColumnWidths = Record<Exclude<ReportColumnKey, "description">, number>;

export interface ReportTemplateSettings {
  /** Sheet inner padding in px. 32 = the shipped `md:p-8` look. */
  pageMarginPx: number;
  /** Body font size in pt. Header boxes and the table derive from this and `tableFontPt`. */
  baseFontPt: number;
  /** Body line-height multiplier. */
  lineHeight: number;
  /** Vertical gap between the numbered sections, px (`mb-2.5` = 10). */
  sectionGapPx: number;
  /** Width of the bold right-aligned label column, px. */
  labelColWidthPx: number;

  logoVisible: boolean;
  /** Logo height in px (`h-24` = 96). */
  logoHeightPx: number;
  /** Which image the header shows: the bundled Cam logo, the uploaded system brand logo, or a custom URL. */
  logoSource: "default" | "brand" | "custom";
  logoCustomUrl: string;

  titleVisible: boolean;
  titleText: string;
  /** Report title size in pt (the shipped `text-base` is 12pt). */
  titleFontPt: number;

  /** The two bordered header boxes (report number / dates). */
  headerBoxesVisible: boolean;

  /** Spare-parts table font size in pt. */
  tableFontPt: number;
  columns: ReportColumnToggles;
  /** The five numbered report sections, individually hideable. */
  sections: ReportSectionToggles;
  /** Print order of the five numbered report sections. */
  sectionOrder?: ReportSectionKey[];

  signaturesVisible: boolean;
  /** Print order of the bottom signature blocks. */
  signatureOrder?: ReportSignatureRole[];

  /**
   * Body typeface. "khmer" | "arial" | "times" are the shipped presets; any
   * other value is used as a raw font-family name — the picker can list every
   * font installed on the user's PC. A font another machine lacks falls back
   * to the Battambang stack there.
   */
  fontFamily: string;
  /** Print order of the table columns; hidden ones keep their slot. */
  columnOrder: ReportColumnKey[];
  /** Left indent of the free-text section bodies, px (shipped 36). */
  contentIndentPx: number;
  /** Table cell vertical padding, px (shipped 4). */
  tableCellPaddingPx: number;
  /** Table border thickness, px. */
  tableBorderWidthPx: number;
  /** Height of the empty spare-parts box when a ticket has no rows, px. */
  emptyTableHeightPx: number;
  /** Width of the left header box as % of the sheet (right box fills the rest). */
  headerLeftBoxPercent: number;
  /** Fixed column widths, px; the description column takes the remainder. */
  columnWidths: ReportColumnWidths;
  /** Which of the three signature columns print. */
  signatureRoles: ReportSignatureToggles;

  /** The label/value lines of section 1 (Customer Information). */
  infoRowsCustomer: ReportInfoRow[];
  /** The label/value lines of section 2 (Instrument Information). */
  infoRowsInstrument: ReportInfoRow[];
  /** Which ticket field each free-text section prints. */
  bodyFields: { request: string; diagnostic: string; solution: string };
  /** Custom database field mapping for header box slots */
  headerFields?: Record<string, string>;
  /** Custom database field mapping for signature slots */
  signatureFields?: Record<string, string>;

  /** All printed text, freely rewordable. */
  labels: ReportLabels;
  /** Freeform XY position offsets for draggable components on the canvas */
  componentOffsets?: Record<string, { x: number; y: number }>;
}

/**
 * The shape the renderer needs from a ticket.
 *
 * Deliberately structural: the web app's `RepairServiceItem` and the mobile
 * app's `RepairServiceItem` are separate declarations with different optional
 * fields, and both must satisfy this without either importing the other.
 *
 * Note the absence of an index signature. Adding one would express "any other
 * field may also be read", which is true — the designer binds arbitrary
 * column names — but TypeScript will not assign a declared interface to a type
 * that has one, so it would reject the very types this is meant to accept.
 * Dynamic reads go through `asRecord()` instead.
 */
export interface ReportSparePartLike {
  description?: string | null;
  itemName?: string | null;
  quantity?: number | null;
  defaultPrice?: number | null;
  remarks?: string | null;
}

export interface ReportTicketLike {
  reportNo?: string | null;
  status?: string | null;
  statusId?: number | null;
  serviceLocation?: string | null;
  hasContract?: boolean | null;
  serviceDate?: string | null;
  finishedDate?: string | null;
  daysTaken?: number | null;
  sparePartItems?: ReportSparePartLike[] | null;
  sparepartItems?: ReportSparePartLike[] | null;
}

/** Reads a ticket or spare-part line by a field name chosen at runtime. */
export function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

/** One resolved spare-parts table row, already enriched from inventory. */
export interface ResolvedSparePartRow {
  id: string;
  itemName: string;
  useFor: string;
  sparePartId: string;
  quantity: number;
  condition: string;
  unitPrice?: number;
  remarks?: string;
}
