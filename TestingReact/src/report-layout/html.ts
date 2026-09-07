/**
 * @file report-layout/html.ts
 * @description The one markup generator for the printed Technical Service
 * Report — the A4 sheet itself, without the surrounding document.
 *
 * See `types.ts` for why this folder has no framework imports.
 *
 * Every element the Templates Settings designer can select carries a
 * `data-rpt-target` attribute holding its `DesignTarget` as JSON, and every
 * re-wordable string carries `data-rpt-label`. That is what lets the designer
 * drive selection and inline editing over this markup instead of maintaining
 * a second, React-shaped copy of the layout.
 */

import { pxToMm } from "./css";
import { getTargetKey, type DesignTarget } from "./design";
import {
  cssColor,
  cssKeyword,
  cssNumber,
  escapeHtml,
  formatFieldValue,
  formatReportStatus,
  resolveReportFontFamily,
  safeImageSrc,
} from "./format";
import {
  DEFAULT_REPORT_LABELS,
  type ReportColumnKey,
  type ReportInfoRow,
  type ReportLabels,
  type ReportSectionKey,
  type ReportSignatureRole,
  type ReportTemplateSettings,
  type ReportTicketLike,
  type ResolvedSparePartRow,
} from "./types";

const PART_COLUMN_META: Record<
  ReportColumnKey,
  { labelKey: keyof ReportLabels; widthKey: Exclude<ReportColumnKey, "description"> | null; cell: string; pad: string }
> = {
  no: { labelKey: "colNo", widthKey: "no", cell: "rpt-align-center", pad: "rpt-pad-1" },
  description: { labelKey: "colDescription", widthKey: null, cell: "rpt-align-left", pad: "rpt-pad-2" },
  useFor: { labelKey: "colUseFor", widthKey: "useFor", cell: "rpt-align-left", pad: "rpt-pad-2" },
  partNo: { labelKey: "colPartNo", widthKey: "partNo", cell: "rpt-align-center rpt-mono", pad: "rpt-pad-1" },
  qty: { labelKey: "colQty", widthKey: "qty", cell: "rpt-align-center rpt-bold", pad: "rpt-pad-1" },
  condition: { labelKey: "colCondition", widthKey: "condition", cell: "rpt-align-center", pad: "rpt-pad-1" },
  unitPrice: { labelKey: "colUnitPrice", widthKey: "unitPrice", cell: "rpt-align-right", pad: "rpt-pad-2" },
  total: { labelKey: "colTotal", widthKey: "total", cell: "rpt-align-right", pad: "rpt-pad-2" },
  remarks: { labelKey: "colRemarks", widthKey: "remarks", cell: "rpt-align-left", pad: "rpt-pad-2" },
};

const SECTION_LABEL_KEY: Record<ReportSectionKey, keyof ReportLabels> = {
  customer: "secCustomer",
  instrument: "secInstrument",
  request: "secRequest",
  diagnostic: "secDiagnostic",
  solution: "secSolution",
};

export interface RenderReportOptions {
  /** Emits designer hooks (`data-rpt-target`, `data-rpt-label`). */
  design?: boolean;
  /** Emits interactive WYSIWYG editor hooks (per-row delete button, add row button). */
  interactive?: boolean;
  /** Resolved URL/data-URI for the header logo when the template asks for the bundled or brand image. */
  defaultLogoSrc?: string;
  /** Resolved URL/data-URI of the uploaded system brand logo, if any. */
  brandLogoSrc?: string;
}

/**
 * The designer hook for an element, plus any nudge the designer saved for it.
 *
 * `data-rpt-target` is emitted only in design mode — it exists so the canvas can
 * resolve a click back to a `DesignTarget`. `componentOffsets` is NOT a designer
 * affordance though: it is a layout setting the user edited, so it has to reach
 * the printed page in every mode. It used to reach none of them — the panel in
 * PropertyInspector wrote coordinates that nothing ever read, which is the same
 * write-but-never-render drift this module exists to end.
 *
 * Offsets convert to millimetres like every other px token, so a nudge lands in
 * the same physical place on the desktop and on the phone.
 *
 * `extraStyle` merges rather than overwrites: several elements already carry an
 * inline style (a column width, the signature grid), and emitting a second
 * `style` attribute would silently drop one of them.
 */
function target(
  design: boolean,
  value: DesignTarget,
  s?: ReportTemplateSettings,
  extraStyle: [string, string | undefined][] = [],
): string {
  const offset = s?.componentOffsets?.[getTargetKey(value)];
  const pairs = [...extraStyle];
  if (offset && (offset.x || offset.y)) {
    pairs.push(["transform", `translate(${pxToMm(offset.x || 0)}, ${pxToMm(offset.y || 0)})`]);
  }
  const hook = design ? ` data-rpt-target="${escapeHtml(JSON.stringify(value))}"` : "";
  return hook + inlineStyle(pairs);
}

/** Marks a label as inline-editable and names the settings key it writes. */
function label(design: boolean, key: string): string {
  return design ? ` data-rpt-label="${escapeHtml(key)}"` : "";
}

function moneyCell(col: ReportColumnKey, sp: ResolvedSparePartRow, index: number): string {
  switch (col) {
    case "no": return String(index + 1);
    case "description": return sp.itemName;
    case "useFor": return sp.useFor;
    case "partNo": return sp.sparePartId;
    case "qty": return String(sp.quantity);
    case "condition": return sp.condition;
    case "unitPrice": return sp.unitPrice != null ? `$${sp.unitPrice.toFixed(2)}` : "—";
    case "total": return sp.unitPrice != null ? `$${(sp.unitPrice * (sp.quantity || 1)).toFixed(2)}` : "—";
    case "remarks": return sp.remarks || "";
  }
}

/**
 * Builds an inline `style` attribute from already-validated values.
 *
 * Callers must pass values through `cssNumber` / `cssColor` / `cssKeyword`
 * first. `escapeHtml` below stops the *attribute* being escaped, but not a
 * second declaration being injected inside it — a colour of
 * `red;background:url(https://evil/?d=)` survives HTML-escaping intact and
 * beacons on every printed report.
 */
function inlineStyle(pairs: [string, string | undefined][]): string {
  const body = pairs.filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(";");
  return body ? ` style="${escapeHtml(body)}"` : "";
}

const ALIGNMENTS = ["left", "center", "right"] as const;

/** `12` -> `"12pt"`, and anything unusable -> undefined (the CSS class wins). */
function ptOrUndefined(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  return `${cssNumber(value, 10, 4, 96)}pt`;
}

function renderInfoRows(
  rows: ReportInfoRow[],
  section: "customer" | "instrument",
  item: ReportTicketLike,
  design: boolean,
  s: ReportTemplateSettings,
): string {
  const visible = rows.filter((r) => r.visible);
  if (visible.length === 0) return "";

  const body = visible
    .map((r) => {
      const labelStyle: [string, string | undefined][] = [
        ["font-size", ptOrUndefined(r.fontPt)],
        ["font-weight", r.bold === undefined ? undefined : r.bold ? "700" : "400"],
        ["font-style", r.italic ? "italic" : undefined],
        ["text-decoration", r.underline ? "underline" : undefined],
        ["text-align", cssKeyword(r.align, ALIGNMENTS)],
        ["color", cssColor(r.color)],
        // The designer exposes a per-row typeface; it used to be written to the
        // template and then read by nothing, which is the same silent drift the
        // shared module exists to end.
        ["font-family", r.fontFamily ? resolveReportFontFamily(r.fontFamily) : undefined],
      ];
      const valueStyle: [string, string | undefined][] = [
        ["font-size", ptOrUndefined(r.valueFontPt ?? r.fontPt)],
        ["font-weight", r.valueBold === undefined ? undefined : r.valueBold ? "700" : "400"],
        ["font-style", r.valueItalic ? "italic" : undefined],
        ["text-decoration", r.valueUnderline ? "underline" : undefined],
        ["text-align", cssKeyword(r.valueAlign, ALIGNMENTS)],
        ["color", cssColor(r.valueColor)],
        ["font-family", r.valueFontFamily
          ? resolveReportFontFamily(r.valueFontFamily)
          : r.fontFamily
            ? resolveReportFontFamily(r.fontFamily)
            : undefined],
      ];
      const mono = r.field === "serialNumber" ? " rpt-mono" : "";

      return `<div class="rpt-inforow"${target(design, { kind: "infoRow", section, id: r.id }, s)}>
  <div class="rpt-inforow-label"${target(design, { kind: "infoRowLabel", section, id: r.id }, s, labelStyle)}${label(design, `infoRow:${section}:${r.id}`)}>${escapeHtml(r.label)}</div>
  <div class="rpt-inforow-value${mono}" data-rpt-field="${escapeHtml(r.field)}"${target(design, { kind: "infoRowValue", section, id: r.id }, s, valueStyle)}>${escapeHtml(formatFieldValue(item, r.field))}</div>
</div>`;
    })
    .join("\n");

  return `<div class="rpt-inforows">\n${body}\n</div>`;
}

function renderPartsTable(
  s: ReportTemplateSettings,
  rows: ResolvedSparePartRow[],
  design: boolean,
  interactive: boolean = false,
): string {
  const columns = s.columnOrder.filter((k) => s.columns[k]).map((k) => ({ key: k, ...PART_COLUMN_META[k] }));
  if (columns.length === 0) return "";

  const divider = (i: number) => (i < columns.length - 1 ? " rpt-cell-divider" : "");
  const widthPair = (
    widthKey: Exclude<ReportColumnKey, "description"> | null,
  ): [string, string | undefined][] => (widthKey ? [["width", pxToMm(s.columnWidths[widthKey])]] : []);

  const head = columns
    .map((c, i) => {
      const align = c.key === "description" ? "rpt-align-left" : "rpt-align-center";
      return `<th class="${c.pad} ${align}${divider(i)}"${target(design, { kind: "column", key: c.key }, s, widthPair(c.widthKey))}${label(design, c.labelKey)}>${escapeHtml(s.labels[c.labelKey])}</th>`;
    })
    .join("");

  const actionTh = interactive ? `<th class="rpt-col-action rpt-no-print" style="width: 28px; text-align: center;"></th>` : "";

  const body = rows.length
    ? rows
        .map((sp, idx) => {
          const cells = columns
            .map((c, i) => `<td class="${c.pad} ${c.cell}${divider(i)}" data-rpt-part-col="${c.key}">${escapeHtml(moneyCell(c.key, sp, idx))}</td>`)
            .join("");
          const actionCell = interactive ? `<td class="rpt-col-action rpt-no-print" style="width: 28px; text-align: center; vertical-align: middle;"><button type="button" class="rpt-row-del-btn" data-rpt-del-row="${idx}" title="លុបគ្រឿងបន្លាស់ជួរនេះ">✕</button></td>` : "";
          return `<tr data-rpt-part-row="${idx}">${cells}${actionCell}</tr>`;
        })
        .join("\n")
    : `<tr class="rpt-row-empty" data-rpt-part-row="0" data-rpt-part-empty="true">${columns
        .map((c, i) => `<td class="${c.pad} ${c.cell}${divider(i)}" data-rpt-part-col="${c.key}">&nbsp;</td>`)
        .join("")}${interactive ? '<td class="rpt-col-action rpt-no-print" style="width: 28px;">&nbsp;</td>' : ""}</tr>`;

  const addRowTfoot = interactive
    ? `<tfoot class="rpt-parts-tfoot rpt-no-print">
<tr data-rpt-add-row="true">
  <td colspan="${columns.length + 1}" class="rpt-add-row-cell">
    <div class="rpt-add-row-inner">＋ បន្ថែមគ្រឿងបន្លាស់ (Add Spare Part)</div>
  </td>
</tr>
</tfoot>`
    : "";

  return `<table class="rpt-table">
<thead><tr>${head}${actionTh}</tr></thead>
<tbody>
${body}
</tbody>
${addRowTfoot}
</table>`;
}

function renderSection(
  key: ReportSectionKey,
  number: number,
  s: ReportTemplateSettings,
  item: ReportTicketLike,
  rows: ResolvedSparePartRow[],
  design: boolean,
  interactive: boolean = false,
): string {
  const labelKey = SECTION_LABEL_KEY[key];
  const heading = `<h2 class="rpt-section-heading"${target(design, { kind: "section", key }, s)}>${number}/ <u${label(design, labelKey)}>${escapeHtml(s.labels[labelKey])}</u></h2>`;

  if (key === "customer" || key === "instrument") {
    const rowsSource = key === "customer" ? s.infoRowsCustomer : s.infoRowsInstrument;
    return `<section class="rpt-section" data-rpt-section="${escapeHtml(key)}">
${heading}
${renderInfoRows(rowsSource, key, item, design, s)}
</section>`;
  }

  const bodyField = s.bodyFields[key as "request" | "diagnostic" | "solution"];
  const bodyClass = key === "solution" ? "rpt-body rpt-body--solution" : "rpt-body";
  const bodyHtml = `<div class="${bodyClass}" data-rpt-body="${escapeHtml(key)}"${target(design, { kind: "body", key }, s)}>${escapeHtml(formatFieldValue(item, bodyField))}</div>`;

  if (key === "solution") {
    const table = renderPartsTable(s, rows, design, interactive);
    return `<section class="rpt-section" data-rpt-section="${escapeHtml(key)}">
${heading}
${bodyHtml}
</section>${table ? `\n<div class="rpt-section rpt-section--table" data-rpt-section="spareparts">\n${table}\n</div>` : ""}`;
  }

  return `<section class="rpt-section" data-rpt-section="${escapeHtml(key)}">
${heading}
${bodyHtml}
</section>`;
}

function renderSignatures(s: ReportTemplateSettings, item: ReportTicketLike, design: boolean): string {
  const order = s.signatureOrder ?? ["customer", "verify", "engineer"];
  const roles = order.filter((role) => s.signatureRoles[role]);
  if (!s.signaturesVisible || roles.length === 0) return "";

  const person = (role: ReportSignatureRole): string => {
    if (role === "customer") return "";
    const nameField = s.signatureFields?.[`${role}Name`];
    const phoneField = s.signatureFields?.[`${role}Phone`];
    const fallbackName = role === "verify" ? s.labels.sigVerifyName : s.labels.sigEngineerName;
    const fallbackPhone = role === "verify" ? s.labels.sigVerifyPhone : s.labels.sigEngineerPhone;

    const resolvedName = nameField ? formatFieldValue(item, nameField) : "—";
    const resolvedPhone = phoneField ? formatFieldValue(item, phoneField) : "—";
    const name = resolvedName && resolvedName !== "—" ? resolvedName : fallbackName;
    const phone = resolvedPhone && resolvedPhone !== "—" ? resolvedPhone : fallbackPhone;

    return `
  <div class="rpt-sig-name" data-rpt-sig-role="${escapeHtml(role)}" data-rpt-sig-field="name"${target(design, { kind: "signaturePerson", role, field: "name" }, s)}>${escapeHtml(name)}</div>
  <div class="rpt-sig-phone" data-rpt-sig-role="${escapeHtml(role)}" data-rpt-sig-field="phone"${target(design, { kind: "signaturePerson", role, field: "phone" }, s)}>${escapeHtml(phone)}</div>`;
  };

  const kmKey = (role: ReportSignatureRole) =>
    (role === "customer" ? "sigCustomerKm" : role === "verify" ? "sigVerifyKm" : "sigEngineerKm") as keyof ReportLabels;
  const enKey = (role: ReportSignatureRole) =>
    (role === "customer" ? "sigCustomerEn" : role === "verify" ? "sigVerifyEn" : "sigEngineerEn") as keyof ReportLabels;

  const cells = roles
    .map(
      (role) => `<div class="rpt-sig" data-rpt-sig="${escapeHtml(role)}"${target(design, { kind: "signatureCell", role }, s)}>
  <div class="rpt-sig-rule"></div>
  <div class="rpt-sig-km"${target(design, { kind: "signatureLabel", role, lang: "km" }, s)}${label(design, kmKey(role))}>${escapeHtml(s.labels[kmKey(role)])}</div>
  <div class="rpt-sig-en"${target(design, { kind: "signatureLabel", role, lang: "en" }, s)}${label(design, enKey(role))}>${escapeHtml(s.labels[enKey(role)])}</div>${person(role)}
</div>`,
    )
    .join("\n");

  return `<div class="rpt-signatures"${target(design, { kind: "signatures" }, s, [["grid-template-columns", `repeat(${roles.length},minmax(0,1fr))`]])}>
${cells}
</div>`;
}

function renderHeaderBoxes(s: ReportTemplateSettings, item: ReportTicketLike, design: boolean): string {
  if (!s.headerBoxesVisible) return "";

  const L = s.labels;
  const f = s.headerFields ?? {};
  const isCompanyService = item.serviceLocation === "CompanyService" || item.serviceLocation === "Company Service";
  const isOnSite = item.serviceLocation === "OnSite" || item.serviceLocation === "On Site";
  const hasContract = Boolean(item.hasContract);
  const isFinished = item.status === "Finished";

  const formatBoxLabel = (key: keyof ReportLabels): string => {
    let text = L[key] || DEFAULT_REPORT_LABELS[key] || "";
    if (key === "boxDateWaiting" && text.trim() === "Date Waiting") {
      text = "Date Waiting:";
    }
    return text;
  };

  const row = (
    labelKey: keyof ReportLabels,
    valueTargetKey: string,
    value: string,
    bold: boolean,
    boxKey?: string,
  ) => `<div class="rpt-box-row"${boxKey ? ` data-rpt-box="${escapeHtml(boxKey)}"` : ""}>
  <div class="rpt-box-label"${target(design, { kind: "headerBoxLabel", key: labelKey }, s)}${label(design, labelKey)}>${escapeHtml(formatBoxLabel(labelKey))}</div>
  <div class="rpt-box-value${bold ? " rpt-box-value--bold" : ""}"${target(design, { kind: "headerBoxValue", key: valueTargetKey }, s)}>${escapeHtml(value)}</div>
</div>`;

  const left = [
    row("boxReportNumber", "reportNo", formatFieldValue(item, f.reportNo || "reportNo"), true, "reportNo"),
    row("boxOnSite", "serviceLocation", isOnSite ? "☑" : "☐", false, "onSite"),
    row("boxCompanyService", "serviceLocation", isCompanyService ? "☑" : "☐", false, "companyService"),
    row("boxContract", "hasContract", hasContract ? "☑" : "☐", false, "contract"),
  ].join("\n");

  const secondDateLabel: keyof ReportLabels = isFinished ? "boxDateFinish" : "boxDateWaiting";
  const secondDateField = isFinished ? f.boxDateFinish || "finishedDate" : f.boxDateWaiting || "statusDate";

  const right = [
    row("boxDateStart", "serviceDate", formatFieldValue(item, f.boxDateStart || "serviceDate"), false, "dateStart"),
    row(secondDateLabel, isFinished ? "finishedDate" : "statusDate", formatFieldValue(item, secondDateField), false, isFinished ? "dateFinish" : "dateWaiting"),
    isFinished
      ? ""
      : `<div class="rpt-box-row" data-rpt-box="status">
  <div class="rpt-box-status"${target(design, { kind: "headerBoxValue", key: "status" }, s)}>Status = &#39;${escapeHtml(formatReportStatus(item.status))}&#39;</div>
</div>`,
  ]
    .filter(Boolean)
    .join("\n");

  return `<div class="rpt-headerboxes"${target(design, { kind: "headerBoxes" }, s)}>
<div class="rpt-headerbox rpt-headerbox--left">
${left}
</div>
<div class="rpt-headerbox rpt-headerbox--right">
${right}
</div>
</div>`;
}

/**
 * Renders the A4 sheet — the `<div class="rpt-sheet">` and everything in it.
 * Pair it with `buildReportCss()`; `renderReportDocument()` does both.
 */
export function renderReportSheet(
  item: ReportTicketLike,
  sparePartRows: ResolvedSparePartRow[],
  s: ReportTemplateSettings,
  options: RenderReportOptions = {},
): string {
  const { design = false, interactive = false, defaultLogoSrc = "/images/CamLogo.png", brandLogoSrc } = options;

  const chosenLogo =
    s.logoSource === "custom" && s.logoCustomUrl
      ? s.logoCustomUrl
      : s.logoSource === "brand" && brandLogoSrc
        ? brandLogoSrc
        : defaultLogoSrc;
  const logoSrc = safeImageSrc(chosenLogo, defaultLogoSrc);

  const header =
    s.logoVisible || s.titleVisible
      ? `<div class="rpt-header">
  <div class="rpt-logo-slot"${target(design, { kind: "logo" }, s)}>${s.logoVisible ? `<img class="rpt-logo" src="${escapeHtml(logoSrc)}" alt="Company Logo" />` : ""}</div>
  <div class="rpt-title-slot">${s.titleVisible ? `<h1 class="rpt-title"${target(design, { kind: "title" }, s)}${label(design, "titleText")}>${escapeHtml(s.titleText)}</h1>` : ""}</div>
</div>`
      : "";

  const order = s.sectionOrder ?? ["customer", "instrument", "request", "diagnostic", "solution"];
  const printed = order.filter((k) => s.sections[k]);
  const sections = printed
    .map((key, i) => renderSection(key, i + 1, s, item, sparePartRows, design, interactive))
    .join("\n");

  return `<div class="rpt-sheet" data-rpt-sheet>
<div class="rpt-sheet-top">
${header}
${renderHeaderBoxes(s, item, design)}
${sections}
</div>
${renderSignatures(s, item, design)}
</div>`;
}
