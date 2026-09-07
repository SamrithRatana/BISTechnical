"use client";

/**
 * @file report/DesignPopover.tsx
 * @description The design surface's element inspector — docked on the RIGHT,
 * the report-designer convention. Click anything in the live preview and this
 * panel edits exactly that element. Field rows get the full data toolbox: a
 * grouped picker of every bindable RepairServices field (typed — text, date,
 * number, checkbox — each formatted correctly on the report), rename, move,
 * hide, remove, and add-new-field on the section.
 */

import React, { useEffect, useRef } from "react";
import { X, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import type { DesignTarget } from "@/report-layout";
import {
  useReportTemplateDraft,
  updateReportTemplate,
  DEFAULT_REPORT_LABELS,
  TICKET_FIELDS,
  type ReportLabels,
  type ReportColumnKey,
  type ReportInfoRow,
  type ReportTemplateSettings,
} from "@/services/reportTemplate";

const COLUMN_LABEL_KEY: Record<ReportColumnKey, keyof ReportLabels> = {
  no: "colNo",
  description: "colDescription",
  useFor: "colUseFor",
  partNo: "colPartNo",
  qty: "colQty",
  condition: "colCondition",
  unitPrice: "colUnitPrice",
  total: "colTotal",
  remarks: "colRemarks",
};

const SECTION_LABEL_KEY = {
  customer: "secCustomer",
  instrument: "secInstrument",
  request: "secRequest",
  diagnostic: "secDiagnostic",
  solution: "secSolution",
} as const;

const GROUP_NAME: Record<string, TranslationKey> = {
  ticket: "tpl.gTicket",
  customer: "tpl.gCustomer",
  machine: "tpl.gMachine",
  dates: "tpl.gDates",
  people: "tpl.gPeople",
};

const TYPE_NAME: Record<string, TranslationKey> = {
  text: "tpl.tText",
  date: "tpl.tDate",
  number: "tpl.tNumber",
  boolean: "tpl.tBoolean",
};

const FIELD_NAME: Record<string, TranslationKey> = {
  reportNo: "tpl.f.reportNo",
  status: "tpl.f.status",
  serviceType: "tpl.f.serviceType",
  servicePriority: "tpl.f.servicePriority",
  serviceLocation: "tpl.f.serviceLocation",
  hasContract: "tpl.f.hasContract",
  isThirdPartyRepair: "tpl.f.isThirdPartyRepair",
  daysTaken: "tpl.f.daysTaken",
  customerRequest: "tpl.f.customerRequest",
  inspection: "tpl.f.inspection",
  solution: "tpl.f.solution",
  companyName: "tpl.f.companyName",
  contactName: "tpl.f.contactName",
  phoneNumber: "tpl.f.phoneNumber",
  address: "tpl.f.address",
  itemName: "tpl.f.itemName",
  serialNumber: "tpl.f.serialNumber",
  serviceDate: "tpl.f.serviceDate",
  inspectDate: "tpl.f.inspectDate",
  awaitingSparepartDate: "tpl.f.awaitingSparepartDate",
  awaitingCustomerConfirmDate: "tpl.f.awaitingCustomerConfirmDate",
  saleConfirmedDate: "tpl.f.saleConfirmedDate",
  sentSparepartsDate: "tpl.f.sentSparepartsDate",
  repairDate: "tpl.f.repairDate",
  finishedDate: "tpl.f.finishedDate",
  customerRejectedDate: "tpl.f.customerRejectedDate",
  unrepairableDate: "tpl.f.unrepairableDate",
  createdByName: "tpl.f.createdByName",
  createdByPhone: "tpl.f.createdByPhone",
  inspectByName: "tpl.f.inspectByName",
  repairByName: "tpl.f.repairByName",
  repairByPhone: "tpl.f.repairByPhone",
  verifiedByName: "tpl.f.verifiedByName",
  thirdPartyRepairByName: "tpl.f.thirdPartyRepairByName",
};

export interface DesignPopoverProps {
  target: DesignTarget;
  /** Kept for call-site compatibility; the inspector docks right regardless. */
  x?: number;
  y?: number;
  onClose: () => void;
}

const inputCls =
  "w-full text-xs rounded-lg border border-subtle bg-sunken px-2.5 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-accent-ring";
const rowCls = "flex items-center justify-between gap-3 py-1";
const labelCls = "text-xs font-medium text-ink";
const checkCls = "w-4 h-4 accent-[var(--av-accent)] cursor-pointer";
const btnCls =
  "p-1.5 rounded-md border border-subtle bg-sunken text-ink hover:bg-cushion disabled:opacity-30 cursor-pointer";

/** Grouped picker over every bindable RepairServices field, typed. */
function FieldSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const groups = ["ticket", "customer", "machine", "dates", "people"] as const;
  return (
    <label className="block py-1">
      <span className={`${labelCls} block mb-1`}>{t("tpl.dataField")}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} cursor-pointer`}>
        {groups.map((g) => (
          <optgroup key={g} label={t(GROUP_NAME[g])}>
            {TICKET_FIELDS.filter((f) => f.group === g).map((f) => (
              <option key={f.key} value={f.key}>
                {t(FIELD_NAME[f.key])} · {t(TYPE_NAME[f.type])}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export default function DesignPopover({ target, onClose }: DesignPopoverProps) {
  const { t } = useI18n();
  const s = useReportTemplateDraft();
  const ref = useRef<HTMLDivElement | null>(null);

  // Escape closes; outside clicks stay live so the user can keep clicking
  // other report elements and the inspector re-targets (§14 cleanup).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (patch: Partial<ReportTemplateSettings>) => updateReportTemplate(patch);

  const rowListKey = (section: "customer" | "instrument") =>
    section === "customer" ? ("infoRowsCustomer" as const) : ("infoRowsInstrument" as const);

  const updateRow = (section: "customer" | "instrument", id: string, patch: Partial<ReportInfoRow>) => {
    const key = rowListKey(section);
    set({ [key]: s[key].map((r) => (r.id === id ? { ...r, ...patch } : r)) } as Partial<ReportTemplateSettings>);
  };

  const moveRow = (section: "customer" | "instrument", id: string, dir: -1 | 1) => {
    const key = rowListKey(section);
    const list = [...s[key]];
    const i = list.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ [key]: list } as Partial<ReportTemplateSettings>);
  };

  const removeRow = (section: "customer" | "instrument", id: string) => {
    const key = rowListKey(section);
    set({ [key]: s[key].filter((r) => r.id !== id) } as Partial<ReportTemplateSettings>);
    onClose();
  };

  const addRow = (section: "customer" | "instrument") => {
    const key = rowListKey(section);
    const field = "reportNo";
    const row: ReportInfoRow = {
      id: `row-${crypto.randomUUID().slice(0, 8)}`,
      label: `${t(FIELD_NAME[field])} :`,
      field,
      visible: true,
    };
    set({ [key]: [...s[key], row] } as Partial<ReportTemplateSettings>);
  };

  const body = (() => {
    switch (target.kind) {
      case "infoRow": {
        const list = s[rowListKey(target.section)];
        const idx = list.findIndex((r) => r.id === target.id);
        const row = list[idx];
        if (!row) return <p className="text-xs text-ink-muted">—</p>;
        return (
          <>
            <label className={rowCls}>
              <span className={labelCls}>{t("tpl.popShow")}</span>
              <input type="checkbox" checked={row.visible} onChange={(e) => updateRow(target.section, row.id, { visible: e.target.checked })} className={checkCls} />
            </label>
            <label className="block py-1">
              <span className={`${labelCls} block mb-1`}>{t("tpl.popHeaderText")}</span>
              <input type="text" value={row.label} onChange={(e) => updateRow(target.section, row.id, { label: e.target.value })} className={inputCls} />
            </label>
            <FieldSelect value={row.field} onChange={(v) => updateRow(target.section, row.id, { field: v })} />
            <div className={rowCls}>
              <span className={labelCls}>{t("tpl.popMove")}</span>
              <div className="flex gap-1.5">
                <button type="button" aria-label={t("tpl.moveUp")} onClick={() => moveRow(target.section, row.id, -1)} disabled={idx <= 0} className={btnCls}><ArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" aria-label={t("tpl.moveDown")} onClick={() => moveRow(target.section, row.id, 1)} disabled={idx >= list.length - 1} className={btnCls}><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <button type="button" onClick={() => removeRow(target.section, row.id)} className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-danger/40 text-danger hover:bg-danger-soft transition-colors cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
              {t("tpl.removeField")}
            </button>
          </>
        );
      }
      case "body":
        return (
          <FieldSelect
            value={s.bodyFields[target.key]}
            onChange={(v) => set({ bodyFields: { ...s.bodyFields, [target.key]: v } })}
          />
        );
      case "column": {
        const key = target.key as ReportColumnKey;
        const labelKey = COLUMN_LABEL_KEY[key];
        const order = s.columnOrder;
        const idx = order.indexOf(key);
        const move = (dir: -1 | 1) => {
          const next = [...order];
          const j = idx + dir;
          if (j < 0 || j >= next.length) return;
          [next[idx], next[j]] = [next[j], next[idx]];
          set({ columnOrder: next });
        };
        return (
          <>
            <label className={rowCls}>
              <span className={labelCls}>{t("tpl.popShow")}</span>
              <input type="checkbox" checked={s.columns[key]} onChange={(e) => set({ columns: { ...s.columns, [key]: e.target.checked } })} className={checkCls} />
            </label>
            <label className="block py-1">
              <span className={`${labelCls} block mb-1`}>{t("tpl.popHeaderText")}</span>
              <input type="text" value={s.labels[labelKey]} onChange={(e) => set({ labels: { ...s.labels, [labelKey]: e.target.value } })} className={inputCls} />
            </label>
            {key !== "description" && (
              <label className="block py-1">
                <div className="flex items-center justify-between mb-1">
                  <span className={labelCls}>{t("tpl.popWidth")}</span>
                  <span className="text-[11px] font-mono font-bold text-accent">{s.columnWidths[key]}px</span>
                </div>
                <input type="range" min={24} max={280} step={4} value={s.columnWidths[key]} onChange={(e) => set({ columnWidths: { ...s.columnWidths, [key]: Number(e.target.value) } })} className="w-full accent-[var(--av-accent)] cursor-pointer" />
              </label>
            )}
            <div className={rowCls}>
              <span className={labelCls}>{t("tpl.popMove")}</span>
              <div className="flex gap-1.5">
                <button type="button" aria-label={t("tpl.moveUp")} onClick={() => move(-1)} disabled={idx <= 0} className={btnCls}><ArrowUp className="w-3.5 h-3.5 -rotate-90" /></button>
                <button type="button" aria-label={t("tpl.moveDown")} onClick={() => move(1)} disabled={idx >= order.length - 1} className={btnCls}><ArrowDown className="w-3.5 h-3.5 -rotate-90" /></button>
              </div>
            </div>
          </>
        );
      }
      case "title":
        return (
          <>
            <label className={rowCls}>
              <span className={labelCls}>{t("tpl.showTitle")}</span>
              <input type="checkbox" checked={s.titleVisible} onChange={(e) => set({ titleVisible: e.target.checked })} className={checkCls} />
            </label>
            <label className="block py-1">
              <span className={`${labelCls} block mb-1`}>{t("tpl.titleText")}</span>
              <input type="text" value={s.titleText} onChange={(e) => set({ titleText: e.target.value })} className={inputCls} />
            </label>
            <label className="block py-1">
              <div className="flex items-center justify-between mb-1">
                <span className={labelCls}>{t("tpl.titleSize")}</span>
                <span className="text-[11px] font-mono font-bold text-accent">{s.titleFontPt}pt</span>
              </div>
              <input type="range" min={9} max={18} step={0.5} value={s.titleFontPt} onChange={(e) => set({ titleFontPt: Number(e.target.value) })} className="w-full accent-[var(--av-accent)] cursor-pointer" />
            </label>
          </>
        );
      case "logo":
        return (
          <>
            <label className={rowCls}>
              <span className={labelCls}>{t("tpl.showLogo")}</span>
              <input type="checkbox" checked={s.logoVisible} onChange={(e) => set({ logoVisible: e.target.checked })} className={checkCls} />
            </label>
            <label className="block py-1">
              <div className="flex items-center justify-between mb-1">
                <span className={labelCls}>{t("tpl.logoHeight")}</span>
                <span className="text-[11px] font-mono font-bold text-accent">{s.logoHeightPx}px</span>
              </div>
              <input type="range" min={40} max={150} step={2} value={s.logoHeightPx} onChange={(e) => set({ logoHeightPx: Number(e.target.value) })} className="w-full accent-[var(--av-accent)] cursor-pointer" />
            </label>
          </>
        );
      case "headerBoxes": {
        const boxKeys: (keyof ReportLabels)[] = [
          "boxReportNumber", "boxOnSite", "boxCompanyService", "boxContract",
          "boxDateStart", "boxDateFinish", "boxDateWaiting",
        ];
        return (
          <>
            <label className={rowCls}>
              <span className={labelCls}>{t("tpl.showHeaderBoxes")}</span>
              <input type="checkbox" checked={s.headerBoxesVisible} onChange={(e) => set({ headerBoxesVisible: e.target.checked })} className={checkCls} />
            </label>
            <label className="block py-1">
              <div className="flex items-center justify-between mb-1">
                <span className={labelCls}>{t("tpl.leftBoxWidth")}</span>
                <span className="text-[11px] font-mono font-bold text-accent">{s.headerLeftBoxPercent}%</span>
              </div>
              <input type="range" min={40} max={70} value={s.headerLeftBoxPercent} onChange={(e) => set({ headerLeftBoxPercent: Number(e.target.value) })} className="w-full accent-[var(--av-accent)] cursor-pointer" />
            </label>
            {boxKeys.map((k) => (
              <label key={k} className="block py-1">
                <span className="text-[10px] font-medium text-ink-muted block mb-0.5 truncate">{DEFAULT_REPORT_LABELS[k]}</span>
                <input type="text" value={s.labels[k]} onChange={(e) => set({ labels: { ...s.labels, [k]: e.target.value } })} className={inputCls} />
              </label>
            ))}
          </>
        );
      }
      case "section": {
        const labelKey = SECTION_LABEL_KEY[target.key];
        const canAdd = target.key === "customer" || target.key === "instrument";
        return (
          <>
            <label className={rowCls}>
              <span className={labelCls}>{t("tpl.popShow")}</span>
              <input type="checkbox" checked={s.sections[target.key]} onChange={(e) => set({ sections: { ...s.sections, [target.key]: e.target.checked } })} className={checkCls} />
            </label>
            <label className="block py-1">
              <span className={`${labelCls} block mb-1`}>{t("tpl.popHeaderText")}</span>
              <input type="text" value={s.labels[labelKey]} onChange={(e) => set({ labels: { ...s.labels, [labelKey]: e.target.value } })} className={inputCls} />
            </label>
            {canAdd && (
              <button type="button" onClick={() => addRow(target.key as "customer" | "instrument")} className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-subtle bg-surface text-ink hover:bg-cushion transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                {t("tpl.addField")}
              </button>
            )}
          </>
        );
      }
      case "signatures":
        return (
          <>
            <label className={rowCls}>
              <span className={labelCls}>{t("tpl.showSignatures")}</span>
              <input type="checkbox" checked={s.signaturesVisible} onChange={(e) => set({ signaturesVisible: e.target.checked })} className={checkCls} />
            </label>
            {([["customer", "tpl.sigCustomer"], ["verify", "tpl.sigVerify"], ["engineer", "tpl.sigEngineer"]] as const).map(([k, lk]) => (
              <label key={k} className={rowCls}>
                <span className={labelCls}>{t(lk)}</span>
                <input type="checkbox" checked={s.signatureRoles[k]} onChange={(e) => set({ signatureRoles: { ...s.signatureRoles, [k]: e.target.checked } })} className={checkCls} />
              </label>
            ))}
            <p className="text-[11px] font-bold text-ink-secondary pt-2">{t("tpl.sigIdentities")}</p>
            {(["sigVerifyName", "sigVerifyPhone", "sigEngineerName", "sigEngineerPhone"] as (keyof ReportLabels)[]).map((k) => (
              <label key={k} className="block py-1">
                <span className="text-[10px] font-medium text-ink-muted block mb-0.5">{DEFAULT_REPORT_LABELS[k]}</span>
                <input type="text" value={s.labels[k]} onChange={(e) => set({ labels: { ...s.labels, [k]: e.target.value } })} className={inputCls} />
              </label>
            ))}
          </>
        );
    }
  })();

  const heading = (() => {
    switch (target.kind) {
      case "column": return DEFAULT_REPORT_LABELS[COLUMN_LABEL_KEY[target.key as ReportColumnKey]];
      case "section": return DEFAULT_REPORT_LABELS[SECTION_LABEL_KEY[target.key]];
      case "infoRow": {
        const row = s[rowListKey(target.section)].find((r) => r.id === target.id);
        return row?.label || t("tpl.dataField");
      }
      case "body": return DEFAULT_REPORT_LABELS[SECTION_LABEL_KEY[target.key === "request" ? "request" : target.key === "diagnostic" ? "diagnostic" : "solution"]];
      case "title": return t("tpl.showTitle");
      case "logo": return t("tpl.groupHeader");
      case "headerBoxes": return t("tpl.showHeaderBoxes");
      case "signatures": return t("tpl.groupSignatures");
    }
  })();

  return (
    /* Right-docked inspector: the designer's tools panel. Slides in with a
       transform-only entrance per the animation rules. */
    <div
      ref={ref}
      className="fixed right-3 top-20 bottom-3 z-[300] w-72 rounded-2xl border border-subtle bg-surface shadow-2xl p-3.5 enter-right overflow-y-auto"
      role="dialog"
      aria-label={heading}
    >
      <div className="flex items-center justify-between gap-3 mb-2 sticky top-0 bg-surface pb-1.5 border-b border-subtle">
        <h4 className="text-xs font-bold text-ink truncate" title={heading}>{heading}</h4>
        <button type="button" onClick={onClose} aria-label={t("tpl.popDone")} className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-cushion cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {body}
    </div>
  );
}
