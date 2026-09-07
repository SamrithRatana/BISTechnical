/**
 * @file report-layout/design.ts
 * @description Names for the pieces of the report the Templates Settings
 * designer can select.
 *
 * These live beside the renderer because the renderer is what stamps them
 * into the markup as `data-rpt-target` — see `html.ts`. Keeping the union
 * here is what lets the designer drive selection over generated HTML instead
 * of maintaining a second, React-shaped copy of the layout.
 *
 * See `types.ts` for why this folder has no framework imports.
 */

import type { ReportColumnKey, ReportLabels, ReportSectionKey, ReportSignatureRole } from "./types";

export type DesignTarget =
  | { kind: "column"; key: ReportColumnKey }
  | { kind: "infoRow"; section: "customer" | "instrument"; id: string }
  | { kind: "infoRowLabel"; section: "customer" | "instrument"; id: string }
  | { kind: "infoRowValue"; section: "customer" | "instrument"; id: string }
  | { kind: "headerBoxLabel"; key: keyof ReportLabels }
  | { kind: "headerBoxValue"; key: string }
  | { kind: "signatureCell"; role: ReportSignatureRole }
  | { kind: "signatureLabel"; role: ReportSignatureRole; lang: "km" | "en" }
  | { kind: "signaturePerson"; role: "verify" | "engineer"; field: "name" | "phone" }
  | { kind: "body"; key: "request" | "diagnostic" | "solution" }
  | { kind: "title" }
  | { kind: "logo" }
  | { kind: "headerBoxes" }
  | { kind: "section"; key: ReportSectionKey }
  | { kind: "signatures" };

export function isTargetEqual(a?: DesignTarget | null, b?: DesignTarget | null): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "column" && b.kind === "column") return a.key === b.key;
  if (a.kind === "infoRow" && b.kind === "infoRow") return a.section === b.section && a.id === b.id;
  if (a.kind === "infoRowLabel" && b.kind === "infoRowLabel") return a.section === b.section && a.id === b.id;
  if (a.kind === "infoRowValue" && b.kind === "infoRowValue") return a.section === b.section && a.id === b.id;
  if (a.kind === "headerBoxLabel" && b.kind === "headerBoxLabel") return a.key === b.key;
  if (a.kind === "headerBoxValue" && b.kind === "headerBoxValue") return a.key === b.key;
  if (a.kind === "signatureCell" && b.kind === "signatureCell") return a.role === b.role;
  if (a.kind === "signatureLabel" && b.kind === "signatureLabel") return a.role === b.role && a.lang === b.lang;
  if (a.kind === "signaturePerson" && b.kind === "signaturePerson") return a.role === b.role && a.field === b.field;
  if (a.kind === "body" && b.kind === "body") return a.key === b.key;
  if (a.kind === "section" && b.kind === "section") return a.key === b.key;
  return true;
}

/** A short caption for the selection badge the designer draws over an element. */
export function describeTarget(target: DesignTarget): string {
  switch (target.kind) {
    case "column": return `COL: ${target.key}`;
    case "infoRow": return "ROW";
    case "infoRowLabel": return "LABEL";
    case "infoRowValue": return "DATA FIELD";
    case "headerBoxLabel": return "LABEL";
    case "headerBoxValue": return `FIELD [${target.key}]`;
    case "signatureCell": return `SIGNATURE: ${target.role.toUpperCase()}`;
    case "signatureLabel": return `LABEL (${target.lang.toUpperCase()})`;
    case "signaturePerson": return `${target.role.toUpperCase()} ${target.field.toUpperCase()}`;
    case "body": return `DATA BODY [${target.key}]`;
    case "title": return "TITLE";
    case "logo": return "LOGO";
    case "headerBoxes": return "HEADER BOXES";
    case "section": return `SECTION: ${target.key}`;
    case "signatures": return "SIGNATURES";
  }
}

/**
 * The stable string that identifies one element across renders — what
 * `ReportTemplateSettings.componentOffsets` is keyed by.
 *
 * It lives here, beside the union it describes, rather than in the web app's
 * template store, because the renderer needs it to apply those offsets and the
 * renderer has to run on the phone too. Typed against `DesignTarget` instead of
 * the `{ kind: string; [k: string]: any }` the store used, so adding a variant
 * to the union without giving it a key is a compile error rather than a silent
 * fall-through to `t.kind`.
 */
export function getTargetKey(t: DesignTarget): string {
  switch (t.kind) {
    case "logo": return "logo";
    case "title": return "title";
    case "headerBoxes": return "headerBoxes";
    case "headerBoxLabel": return `hdr_lbl_${t.key}`;
    case "headerBoxValue": return `hdr_val_${t.key}`;
    case "section": return `sec_${t.key}`;
    case "body": return `body_${t.key}`;
    case "infoRow": return `row_${t.section}_${t.id}`;
    case "infoRowLabel": return `row_lbl_${t.section}_${t.id}`;
    case "infoRowValue": return `row_val_${t.section}_${t.id}`;
    case "signatureCell": return `sig_cell_${t.role}`;
    case "signatureLabel": return `sig_lbl_${t.role}_${t.lang}`;
    case "signaturePerson": return `sig_person_${t.role}_${t.field}`;
    case "signatures": return "signatures";
    case "column": return `col_${t.key}`;
  }
}

/** Reads a `data-rpt-target` attribute back into a `DesignTarget`. */
export function parseDesignTarget(raw: string | null | undefined): DesignTarget | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof (parsed as { kind?: unknown }).kind === "string") {
      return parsed as DesignTarget;
    }
  } catch {
    // A malformed attribute means a stale DOM node, not a reason to crash the
    // designer — treat it as "nothing selected".
  }
  return null;
}
