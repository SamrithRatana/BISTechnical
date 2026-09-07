"use client";

/**
 * @file report/TemplateControls.tsx
 * @description The Left Studio Pane for the Templates Settings page — organizes
 * layout knobs, page typography, and a comprehensive Database Field Explorer.
 */

import React, { useState, useMemo } from "react";
import {
  RotateCcw,
  Globe,
  Loader2,
  Undo2,
  ArrowUp,
  ArrowDown,
  MonitorDown,
  Database,
  Sliders,
  Layers,
  Search,
  Plus,
  Calendar,
  Hash,
  CheckSquare,
  FileText,
  ChevronRight,
  Sparkles,
  GripVertical,
} from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import {
  useReportTemplateDraft,
  updateReportTemplate,
  resetReportTemplate,
  isDraftPublished,
  publishReportTemplate,
  loadFactoryDefaults,
  isReportTemplateDefault,
  DEFAULT_REPORT_LABELS,
  TICKET_FIELDS,
  type ReportTemplateSettings,
  type ReportSectionToggles,
  type ReportLabels,
  type ReportSignatureToggles,
  type ReportColumnWidths,
  type ReportColumnKey,
  type PublishResult,
  type ReportInfoRow,
  nextInfoRowId,
} from "@/services/reportTemplate";
import type { DesignTarget } from "@/report-layout";

const GROUP_NAME: Record<string, TranslationKey> = {
  ticket: "tpl.gTicket",
  spareparts: "tpl.gSpareparts",
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
  id: "tpl.f.id",
  statusId: "tpl.f.statusId",
  serviceTypeId: "tpl.f.serviceTypeId",
  servicePriorityId: "tpl.f.servicePriorityId",
  telegramMessageId: "tpl.f.telegramMessageId",
  sparePartsSummary: "tpl.f.sparePartsSummary",
  sparePartsCount: "tpl.f.sparePartsCount",
  sparePartsTotalCost: "tpl.f.sparePartsTotalCost",
  sparePartsRemarks: "tpl.f.sparePartsRemarks",
  isHoldStatus: "tpl.f.isHoldStatus",
  remarksUpdatedAt: "tpl.f.remarksUpdatedAt",
  sparePartId: "tpl.f.sparePartId",
  companyName: "tpl.f.companyName",
  contactName: "tpl.f.contactName",
  phoneNumber: "tpl.f.phoneNumber",
  address: "tpl.f.address",
  customerId: "tpl.f.customerId",
  itemName: "tpl.f.itemName",
  serialNumber: "tpl.f.serialNumber",
  itemId: "tpl.f.itemId",
  serviceDate: "tpl.f.serviceDate",
  inspectDate: "tpl.f.inspectDate",
  inspectingDate: "tpl.f.inspectingDate",
  awaitingSparepartDate: "tpl.f.awaitingSparepartDate",
  awaitingCustomerConfirmDate: "tpl.f.awaitingCustomerConfirmDate",
  saleConfirmedDate: "tpl.f.saleConfirmedDate",
  sentSparepartsDate: "tpl.f.sentSparepartsDate",
  repairDate: "tpl.f.repairDate",
  thirdPartyRepairDate: "tpl.f.thirdPartyRepairDate",
  finishedDate: "tpl.f.finishedDate",
  customerRejectedDate: "tpl.f.customerRejectedDate",
  unrepairableDate: "tpl.f.unrepairableDate",
  createdByName: "tpl.f.createdByName",
  createdByPhone: "tpl.f.createdByPhone",
  inspectByName: "tpl.f.inspectByName",
  setAwaitingSparepartByName: "tpl.f.setAwaitingSparepartByName",
  setAwaitingCustomerConfirmByName: "tpl.f.setAwaitingCustomerConfirmByName",
  setSaleConfirmedByName: "tpl.f.setSaleConfirmedByName",
  setSentSparepartsByName: "tpl.f.setSentSparepartsByName",
  repairByName: "tpl.f.repairByName",
  repairByPhone: "tpl.f.repairByPhone",
  verifiedByName: "tpl.f.verifiedByName",
  thirdPartyRepairByName: "tpl.f.thirdPartyRepairByName",
  setCustomerRejectedByName: "tpl.f.setCustomerRejectedByName",
  setUnrepairableByName: "tpl.f.setUnrepairableByName",
  createBy: "tpl.f.createBy",
  inspectBy: "tpl.f.inspectBy",
  inspectingBy: "tpl.f.inspectingBy",
  setAwaitingSparepartBy: "tpl.f.setAwaitingSparepartBy",
  setAwaitingCustomerConfirmBy: "tpl.f.setAwaitingCustomerConfirmBy",
  setSaleConfirmedBy: "tpl.f.setSaleConfirmedBy",
  setSentSparepartsBy: "tpl.f.setSentSparepartsBy",
  repairBy: "tpl.f.repairBy",
  verifiedBy: "tpl.f.verifiedBy",
  thirdPartyRepairBy: "tpl.f.thirdPartyRepairBy",
  setCustomerRejectedBy: "tpl.f.setCustomerRejectedBy",
  setUnrepairableBy: "tpl.f.setUnrepairableBy",
};

function FieldTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "date":
      return <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    case "number":
      return <Hash className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    case "boolean":
      return <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />;
  }
}

function Group({ titleKey, children }: { titleKey: TranslationKey; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-subtle bg-surface p-4 space-y-3 shadow-xs">
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink-secondary">{t(titleKey)}</h3>
      {children}
    </section>
  );
}

function SliderRow({
  labelKey, value, min, max, step = 1, unit, onChange,
}: {
  labelKey: TranslationKey; value: number; min: number; max: number; step?: number; unit: string;
  onChange: (v: number) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-ink">{t(labelKey)}</span>
        <span className="text-[11px] font-mono font-bold text-accent">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent cursor-pointer"
      />
    </label>
  );
}

export interface TemplateControlsProps {
  onSelectTarget?: (target: DesignTarget) => void;
}

export default function TemplateControls({ onSelectTarget }: TemplateControlsProps) {
  const { t } = useI18n();
  const s = useReportTemplateDraft();
  const isDefault = isReportTemplateDefault(s);
  const isPublished = isDraftPublished();

  const [activeTab, setActiveTab] = useState<"layout" | "database" | "sections">("layout");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [loadingFonts, setLoadingFonts] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");

  const [localFonts, setLocalFonts] = useState<string[]>([]);

  const handlePublish = async () => {
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await publishReportTemplate();
      setPublishResult(res);
    } finally {
      setPublishing(false);
    }
  };

  const handleLoadFonts = async () => {
    if (!("queryLocalFonts" in window)) return;
    setLoadingFonts(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fonts = await (window as any).queryLocalFonts();
      const unique = Array.from(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Set<string>(fonts.map((f: any) => f.family as string))
      ).sort();
      setLocalFonts(unique);
    } catch {
      // User cancelled permission
    } finally {
      setLoadingFonts(false);
    }
  };

  const handleAddFieldToSection = (sec: "customer" | "instrument", fieldKey: string) => {
    const key: "infoRowsCustomer" | "infoRowsInstrument" =
      sec === "customer" ? "infoRowsCustomer" : "infoRowsInstrument";
    const nextId = nextInfoRowId(s[key]);
    const fieldDef = TICKET_FIELDS.find((f) => f.key === fieldKey);
    const fieldLabel = fieldDef ? t(FIELD_NAME[fieldDef.key] || fieldDef.key) : fieldKey;
    
    const newRow: ReportInfoRow = {
      id: nextId,
      label: fieldLabel,
      field: fieldKey,
      visible: true,
    };
    updateReportTemplate({ [key]: [...s[key], newRow] });
    onSelectTarget?.({ kind: "infoRow", section: sec, id: nextId });
  };

  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return TICKET_FIELDS;
    return TICKET_FIELDS.filter((f) => {
      const translated = t(FIELD_NAME[f.key] || f.key).toLowerCase();
      return f.key.toLowerCase().includes(q) || translated.includes(q);
    });
  }, [fieldSearch, t]);

  const groups = ["ticket", "spareparts", "customer", "machine", "dates", "people"] as const;

  return (
    <div className="space-y-4">
      {/* ── Studio Top Action Toolbar ── */}
      <div className="rounded-2xl border border-subtle bg-surface p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-ink-muted">
            {isPublished ? t("tpl.upToDate") : t("tpl.unsavedDraft")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={publishing || isPublished}
            onClick={handlePublish}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition cursor-pointer shadow-xs"
          >
            {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            <span>{t("tpl.publish")}</span>
          </button>

          <button
            type="button"
            disabled={isPublished}
            onClick={resetReportTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 transition cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>{t("tpl.reset")}</span>
          </button>

          <button
            type="button"
            disabled={isDefault}
            onClick={loadFactoryDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t("tpl.factory")}</span>
          </button>
        </div>

        {publishResult && (
          <p className={`text-[11px] font-medium ${publishResult === "published" ? "text-success" : "text-danger"}`}>
            {publishResult === "published"
              ? t("tpl.publishOk")
              : publishResult === "forbidden"
              ? t("tpl.publishForbidden")
              : t("tpl.publishError")}
          </p>
        )}
      </div>

      {/* ── Studio Navigation Tabs ── */}
      <div className="flex rounded-xl p-1 bg-sunken border border-subtle gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("layout")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === "layout"
              ? "bg-surface text-ink shadow-xs"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{t("tpl.groupPage")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("database")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === "database"
              ? "bg-surface text-ink shadow-xs"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          <Database className="w-3.5 h-3.5 text-accent" />
          <span>{t("tpl.allDbFields")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sections")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === "sections"
              ? "bg-surface text-ink shadow-xs"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t("tpl.groupSections")}</span>
        </button>
      </div>

      {/* ── TAB 1: LAYOUT & TYPOGRAPHY ── */}
      {activeTab === "layout" && (
        <div className="space-y-4">
          <Group titleKey="tpl.groupPage">
            <SliderRow
              labelKey="tpl.margin"
              value={s.pageMarginPx}
              min={12}
              max={64}
              unit="px"
              onChange={(v) => updateReportTemplate({ pageMarginPx: v })}
            />
            <SliderRow
              labelKey="tpl.baseFont"
              value={s.baseFontPt}
              min={8}
              max={14}
              step={0.5}
              unit="pt"
              onChange={(v) => updateReportTemplate({ baseFontPt: v })}
            />
            <SliderRow
              labelKey="tpl.lineHeight"
              value={s.lineHeight}
              min={1.0}
              max={2.0}
              step={0.05}
              unit="×"
              onChange={(v) => updateReportTemplate({ lineHeight: v })}
            />
            <SliderRow
              labelKey="tpl.sectionGap"
              value={s.sectionGapPx}
              min={4}
              max={24}
              unit="px"
              onChange={(v) => updateReportTemplate({ sectionGapPx: v })}
            />
            <SliderRow
              labelKey="tpl.labelWidth"
              value={s.labelColWidthPx}
              min={140}
              max={340}
              step={5}
              unit="px"
              onChange={(v) => updateReportTemplate({ labelColWidthPx: v })}
            />
            <SliderRow
              labelKey="tpl.contentIndent"
              value={s.contentIndentPx}
              min={0}
              max={60}
              unit="px"
              onChange={(v) => updateReportTemplate({ contentIndentPx: v })}
            />

            {/* Font selector */}
            <div className="pt-2 border-t border-subtle space-y-2">
              <label className="block">
                <span className="text-xs font-medium text-ink block mb-1">{t("tpl.fontFamily")}</span>
                <select
                  value={s.fontFamily}
                  onChange={(e) => updateReportTemplate({ fontFamily: e.target.value })}
                  className="w-full text-xs rounded-xl border border-subtle bg-sunken px-2.5 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  <option value="khmer">Khmer OS Battambang (default)</option>
                  <option value="Kantumruy Pro">Kantumruy Pro</option>
                  <option value="Hanuman">Hanuman</option>
                  <option value="Siemreap">Siemreap</option>
                  <option value="system-ui">System UI</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  {localFonts.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </label>

              {"queryLocalFonts" in (typeof window !== "undefined" ? window : {}) && (
                <button
                  type="button"
                  onClick={handleLoadFonts}
                  disabled={loadingFonts}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion transition cursor-pointer"
                >
                  {loadingFonts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MonitorDown className="w-3.5 h-3.5" />}
                  <span>{t("tpl.loadPcFonts")}</span>
                </button>
              )}
            </div>
          </Group>

          <Group titleKey="tpl.groupHeader">
            <SliderRow
              labelKey="tpl.logoHeight"
              value={s.logoHeightPx}
              min={24}
              max={120}
              unit="px"
              onChange={(v) => updateReportTemplate({ logoHeightPx: v })}
            />
            <SliderRow
              labelKey="tpl.leftBoxWidth"
              value={s.headerLeftBoxPercent}
              min={30}
              max={70}
              step={1}
              unit="%"
              onChange={(v) => updateReportTemplate({ headerLeftBoxPercent: v })}
            />
            {/* How tall the spare-parts box prints when a ticket has no parts.
                Previously only reachable by dragging the old designer canvas's
                bottom handle, which went with that canvas. */}
            <SliderRow
              labelKey="tpl.emptyTableHeight"
              value={s.emptyTableHeightPx}
              min={40}
              max={220}
              step={5}
              unit="px"
              onChange={(v) => updateReportTemplate({ emptyTableHeightPx: v })}
            />
          </Group>
        </div>
      )}

      {/* ── TAB 2: FULL DATABASE FIELDS EXPLORER ── */}
      {activeTab === "database" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-subtle bg-surface p-3.5 shadow-xs space-y-3">
            <div>
              <h3 className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Database className="w-4 h-4 text-accent" />
                {t("tpl.fieldExplorer")}
              </h3>
              <p className="text-[11px] text-ink-muted mt-0.5">
                {t("tpl.fieldExplorerHint")}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t("tpl.searchFields")}
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="w-full text-xs rounded-xl border border-subtle bg-sunken pl-8 pr-2.5 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Categorized Fields List */}
          <div className="space-y-3">
            {groups.map((g) => {
              const inGroup = filteredFields.filter((f) => f.group === g);
              if (inGroup.length === 0) return null;

              return (
                <div key={g} className="rounded-2xl border border-subtle bg-surface p-3 shadow-xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-subtle">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      {t(GROUP_NAME[g])}
                    </span>
                    <span className="text-[10px] font-mono font-semibold bg-sunken px-1.5 py-0.5 rounded text-ink-muted">
                      {inGroup.length} fields
                    </span>
                  </div>

                  <div className="space-y-1">
                    {inGroup.map((f) => (
                      <div
                        key={f.key}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "application/json",
                            JSON.stringify({
                              key: f.key,
                              group: f.group,
                              label: t(FIELD_NAME[f.key] || f.key),
                            })
                          );
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="group flex items-center justify-between p-2 rounded-xl bg-sunken/60 hover:bg-cushion transition border border-transparent hover:border-accent/40 cursor-grab active:cursor-grabbing shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <GripVertical className="w-3.5 h-3.5 text-ink-muted shrink-0 opacity-40 group-hover:opacity-100 transition" />
                          <FieldTypeIcon type={f.type} />
                          <div className="truncate">
                            <p className="text-xs font-semibold text-ink truncate">
                              {t(FIELD_NAME[f.key] || f.key)}
                            </p>
                            <p className="text-[10px] font-mono text-ink-muted truncate">
                              {f.key} · {t(TYPE_NAME[f.type])}
                            </p>
                          </div>
                        </div>

                        {/* Quick Insert Buttons */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                          <button
                            type="button"
                            title="Insert into Customer Info"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddFieldToSection("customer", f.key);
                            }}
                            className="px-2 py-1 rounded-md bg-surface text-ink text-[10px] font-semibold hover:bg-accent hover:text-white transition cursor-pointer border border-subtle shadow-2xs"
                          >
                            + Customer
                          </button>
                          <button
                            type="button"
                            title="Insert into Instrument Info"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddFieldToSection("instrument", f.key);
                            }}
                            className="px-2 py-1 rounded-md bg-surface text-ink text-[10px] font-semibold hover:bg-accent hover:text-white transition cursor-pointer border border-subtle shadow-2xs"
                          >
                            + Instrument
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: SECTIONS & TABLES ── */}
      {activeTab === "sections" && (
        <div className="space-y-4">
          <Group titleKey="tpl.groupSections">
            <div className="space-y-2">
              {[
                { key: "customer" as const, label: t("tpl.secCustomer") },
                { key: "instrument" as const, label: t("tpl.secInstrument") },
                { key: "request" as const, label: t("tpl.secRequest") },
                { key: "diagnostic" as const, label: t("tpl.secDiagnostic") },
                { key: "solution" as const, label: t("tpl.secSolution") },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  onClick={() => onSelectTarget?.({ kind: "section", key })}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-sunken/60 hover:bg-cushion transition cursor-pointer border border-transparent hover:border-subtle"
                >
                  <span className="text-xs font-semibold text-ink">{label}</span>
                  <input
                    type="checkbox"
                    checked={s.sections[key]}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateReportTemplate({
                        sections: { ...s.sections, [key]: e.target.checked },
                      });
                    }}
                    className="w-4 h-4 accent-accent rounded cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </Group>

          <Group titleKey="tpl.groupSignatures">
            <div className="space-y-2">
              {[
                { key: "customer" as const, label: t("tpl.sigCustomer") },
                { key: "verify" as const, label: t("tpl.sigVerify") },
                { key: "engineer" as const, label: t("tpl.sigEngineer") },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  onClick={() => onSelectTarget?.({ kind: "signatures" })}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-sunken/60 hover:bg-cushion transition cursor-pointer border border-transparent hover:border-subtle"
                >
                  <span className="text-xs font-semibold text-ink">{label}</span>
                  <input
                    type="checkbox"
                    checked={s.signatureRoles[key]}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateReportTemplate({
                        signatureRoles: { ...s.signatureRoles, [key]: e.target.checked },
                      });
                    }}
                    className="w-4 h-4 accent-accent rounded cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </Group>
        </div>
      )}
    </div>
  );
}
