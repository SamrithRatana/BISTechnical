"use client";

import { useSyncExternalStore } from "react";

/**
 * @file services/reportTemplate.ts
 * @description Where the Technical Service report template is STORED — the
 * published/draft layers, undo history, and the server sync.
 *
 * ── THE TEMPLATE ITSELF IS NOT DEFINED HERE ───────────────────────────────
 * `ReportTemplateSettings`, its defaults and the merge live in
 * `src/report-layout/`, which is mirrored into the CamID phone app so both
 * platforms read one shape and print one layout. This file used to carry its
 * own copy of all of it — ~440 lines of types, labels, ticket fields and
 * defaults — which is precisely the duplication that let the phone drift.
 * Everything below is re-exported so existing imports keep working; add a new
 * field in `report-layout/types.ts` and default it in
 * `report-layout/defaults.ts`, never here.
 *
 * DEFAULTS ARE A CONTRACT: they reproduce the pre-settings report exactly, so
 * an installation that never opens the settings page prints what shipped
 * before the feature existed.
 *
 * Persistence is two layers (see the comment above `PUBLISHED_KEY`): the
 * company-wide published template that every print uses, and this browser's
 * unpublished draft that the designer edits.
 */

import {
  DEFAULT_REPORT_TEMPLATE,
  getTargetKey,
  nextInfoRowId,
  withDefaults,
  type DesignTarget,
  type ReportInfoRow,
  type ReportTemplateSettings,
} from "@/report-layout";

export {
  ALL_COLUMN_KEYS,
  getTargetKey,
  ALL_SECTION_KEYS,
  ALL_SIGNATURE_ROLES,
  DEFAULT_REPORT_LABELS,
  DEFAULT_REPORT_TEMPLATE,
  nextInfoRowId,
  TICKET_FIELDS,
  withDefaults,
} from "@/report-layout";

export type {
  DesignTarget,
  ReportColumnKey,
  ReportColumnToggles,
  ReportColumnWidths,
  ReportInfoRow,
  ReportLabels,
  ReportSectionKey,
  ReportSectionToggles,
  ReportSignatureRole,
  ReportSignatureToggles,
  ReportTemplateSettings,
  TicketFieldDef,
  TicketFieldType,
} from "@/report-layout";

/*
  Two layers, deliberately:

  - PUBLISHED — the company-wide template (AppSettings.ReportTemplateJson via
    GET/PUT api/AppSettings/report-template). What every Print Preview uses,
    for every user. Cached in localStorage so prints work offline.
  - DRAFT — this browser's work-in-progress in Templates Settings. Nobody
    else sees it until "Save for All Users" publishes it (admin-gated
    server-side, like the company logo).

  The report DATA path is untouched: this is one small JSON read, never a
  ticket query.
*/
const PUBLISHED_KEY = "report_template_published_v1";
const DRAFT_KEY = "report_template_draft_v1";
/** Pre-designer key: whatever a user had customized becomes their draft. */
const LEGACY_KEY = "report_template_v1";

const listeners = new Set<() => void>();
let published: ReportTemplateSettings | null = null;
let draft: ReportTemplateSettings | null = null;
let loaded = false;

function readKey(key: string): ReportTemplateSettings | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? withDefaults(JSON.parse(raw) as Partial<ReportTemplateSettings>) : null;
  } catch {
    return null;
  }
}

function loadOnce(): void {
  if (loaded) return;
  loaded = true;
  published = readKey(PUBLISHED_KEY);
  draft = readKey(DRAFT_KEY);
  if (!draft) {
    const legacy = readKey(LEGACY_KEY);
    if (legacy) {
      draft = legacy;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(legacy));
        localStorage.removeItem(LEGACY_KEY);
      } catch { /* best-effort migration */ }
    }
  }
}

function notify(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getServerSnapshot(): ReportTemplateSettings {
  return DEFAULT_REPORT_TEMPLATE;
}

/** What PRINTING uses: the company-wide template (defaults until one is published). */
export function getPublishedTemplateSnapshot(): ReportTemplateSettings {
  loadOnce();
  return published ?? DEFAULT_REPORT_TEMPLATE;
}

/** What the DESIGNER edits: this browser's draft, seeded from the published template. */
export function getDraftTemplateSnapshot(): ReportTemplateSettings {
  loadOnce();
  return draft ?? published ?? DEFAULT_REPORT_TEMPLATE;
}

/** Print path — company template for everyone. */
export function useReportTemplate(): ReportTemplateSettings {
  return useSyncExternalStore(subscribe, getPublishedTemplateSnapshot, getServerSnapshot);
}

/** Designer path — the local work-in-progress. */
export function useReportTemplateDraft(): ReportTemplateSettings {
  return useSyncExternalStore(subscribe, getDraftTemplateSnapshot, getServerSnapshot);
}

const historyPast: ReportTemplateSettings[] = [];
const historyFuture: ReportTemplateSettings[] = [];

export function updateReportTemplate(patch: Partial<ReportTemplateSettings>): void {
  loadOnce();
  const current = getDraftTemplateSnapshot();
  const next = withDefaults({ ...current, ...patch });
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    historyPast.push(current);
    if (historyPast.length > 50) historyPast.shift();
    historyFuture.length = 0;
  }
  draft = next;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* memory still serves */ }
  notify();
}

export function undoReportTemplate(): boolean {
  loadOnce();
  if (historyPast.length === 0) return false;
  const previous = historyPast.pop()!;
  const current = getDraftTemplateSnapshot();
  historyFuture.push(current);
  draft = previous;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
  notify();
  return true;
}

export function redoReportTemplate(): boolean {
  loadOnce();
  if (historyFuture.length === 0) return false;
  const next = historyFuture.pop()!;
  const current = getDraftTemplateSnapshot();
  historyPast.push(current);
  draft = next;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
  notify();
  return true;
}

export function canUndoReportTemplate(): boolean {
  return historyPast.length > 0;
}

export function canRedoReportTemplate(): boolean {
  return historyFuture.length > 0;
}

/** Discard local edits back to the company template. */
export function loadFactoryDefaults(): void {
  loadOnce();
  const current = getDraftTemplateSnapshot();
  historyPast.push(current);
  historyFuture.length = 0;
  
  // Clone pure defaults with zero offsets
  const fresh = JSON.parse(JSON.stringify(DEFAULT_REPORT_TEMPLATE));
  fresh.componentOffsets = {};
  draft = fresh;
  
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
  notify();
}

export function resetReportTemplate(): void {
  loadOnce();
  const current = getDraftTemplateSnapshot();
  historyPast.push(current);
  historyFuture.length = 0;
  
  const fresh = published ? JSON.parse(JSON.stringify(published)) : JSON.parse(JSON.stringify(DEFAULT_REPORT_TEMPLATE));
  draft = fresh;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
  notify();
}

export interface ComponentClipboard {
  target: DesignTarget;
  row?: ReportInfoRow;
}

let activeClipboard: ComponentClipboard | null = null;

export function copyComponentToClipboard(
  target: DesignTarget,
  s: ReportTemplateSettings
): ComponentClipboard | null {
  if (target.kind === "infoRow" || target.kind === "infoRowLabel" || target.kind === "infoRowValue") {
    const list = target.section === "customer" ? s.infoRowsCustomer : s.infoRowsInstrument;
    const row = list.find((r) => r.id === target.id);
    if (row) {
      activeClipboard = { target, row: { ...row } };
      return activeClipboard;
    }
  }
  activeClipboard = { target };
  return activeClipboard;
}

export function getActiveClipboard(): ComponentClipboard | null {
  return activeClipboard;
}

export function pasteComponentFromClipboard(
  clipboard: ComponentClipboard,
  s: ReportTemplateSettings
): { target: DesignTarget; newId?: string } | null {
  if (clipboard.row && (clipboard.target.kind === "infoRow" || clipboard.target.kind === "infoRowLabel" || clipboard.target.kind === "infoRowValue")) {
    const section = clipboard.target.section as "customer" | "instrument";
    const key = section === "customer" ? "infoRowsCustomer" : "infoRowsInstrument";
    const newId = nextInfoRowId(s[key], "row");
    const newRow: ReportInfoRow = {
      ...clipboard.row,
      id: newId,
      label: `${clipboard.row.label} (Copy)`,
    };
    updateReportTemplate({ [key]: [...s[key], newRow] });
    return { target: { kind: "infoRow", section, id: newId }, newId };
  }
  const targetKey = getTargetKey(clipboard.target);
  const currentOffset = s.componentOffsets?.[targetKey] || { x: 0, y: 0 };
  updateReportTemplate({
    componentOffsets: {
      ...(s.componentOffsets || {}),
      [targetKey]: { x: currentOffset.x + 20, y: currentOffset.y + 20 },
    },
  });
  return { target: clipboard.target };
}

/** True when the draft matches what is already published (nothing to save). */
export function isDraftPublished(): boolean {
  return JSON.stringify(getDraftTemplateSnapshot()) === JSON.stringify(getPublishedTemplateSnapshot());
}

export function isReportTemplateDefault(s: ReportTemplateSettings): boolean {
  return JSON.stringify(s) === JSON.stringify(DEFAULT_REPORT_TEMPLATE);
}

function authHeader(): Record<string, string> | null {
  try {
    const token = localStorage.getItem("jwt_token");
    return token ? { Authorization: `Bearer ${token}` } : null;
  } catch {
    return null;
  }
}

/**
 * Pulls the company template. Called on Templates Settings mount and by the
 * print preview — TTL-less by design: it is one tiny GET and both callers
 * are user-initiated screens, not pollers.
 */
export async function syncReportTemplateFromServer(): Promise<void> {
  const headers = authHeader();
  if (!headers) return;
  try {
    const res = await fetch("/api/proxy/AppSettings/report-template?service=jwt", {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return;
    const body = (await res.json()) as Record<string, unknown>;
    const raw = (body.reportTemplateJson ?? body.ReportTemplateJson) as string | null | undefined;
    const next = raw ? withDefaults(JSON.parse(raw) as Partial<ReportTemplateSettings>) : null;
    const changed = JSON.stringify(next) !== JSON.stringify(published);
    published = next;
    try {
      if (next) localStorage.setItem(PUBLISHED_KEY, JSON.stringify(next));
      else localStorage.removeItem(PUBLISHED_KEY);
    } catch { /* cache only */ }
    if (changed) notify();
  } catch {
    // Offline — the cached copy keeps serving.
  }
}

export type PublishResult = "published" | "forbidden" | "error";

/**
 * Publishes the draft as the company-wide template. Admin/SuperAdmin only —
 * the server enforces it; "forbidden" tells the UI to explain.
 */
export async function publishReportTemplate(): Promise<PublishResult> {
  const headers = authHeader();
  if (!headers) return "error";
  const toPublish = getDraftTemplateSnapshot();
  try {
    const res = await fetch("/api/proxy/AppSettings/report-template?service=jwt", {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        ReportTemplateJson: isReportTemplateDefault(toPublish) ? null : JSON.stringify(toPublish),
      }),
    });
    if (res.status === 401 || res.status === 403) return "forbidden";
    if (!res.ok) return "error";
    published = toPublish;
    draft = null;
    try {
      localStorage.setItem(PUBLISHED_KEY, JSON.stringify(toPublish));
      localStorage.removeItem(DRAFT_KEY);
    } catch { /* cache only */ }
    notify();
    return "published";
  } catch {
    return "error";
  }
}
