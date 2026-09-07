"use client";

/**
 * @file report/PropertyInspector.tsx
 * @description The docked Right Sidebar (Property Inspector) for the Templates
 * Settings Studio.
 *
 * Inspired by enterprise report designers (DevExpress Report Designer, ActiveReports):
 * - Permanently docked on the right side of the studio.
 * - Displays active element properties, typography, full database field binding,
 *   formatting, order, visibility, and quick actions.
 */

import React, { useState, useMemo } from "react";
import {
  Image as ImageIcon,
  Upload,
  RotateCcw,
  X,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Sliders,
  Database,
  Type,
  Eye,
  EyeOff,
  Move,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  Calendar,
  Hash,
  CheckSquare,
  FileText,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Tag,
} from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import {
  ALL_SIGNATURE_ROLES,
  getTargetKey,
  type DesignTarget,
  type ReportSignatureRole,
} from "@/report-layout";
import { uploadImage } from "@/services/upload";
import {
  useReportTemplateDraft,
  updateReportTemplate,
  DEFAULT_REPORT_LABELS,
  TICKET_FIELDS,
  type ReportLabels,
  type ReportColumnKey,
  type ReportInfoRow,
  type ReportTemplateSettings,
  type ReportSignatureToggles,
  type TicketFieldDef,
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
  companyName: "tpl.f.companyName",
  contactName: "tpl.f.contactName",
  phoneNumber: "tpl.f.phoneNumber",
  address: "tpl.f.address",
  itemName: "tpl.f.itemName",
  serialNumber: "tpl.f.serialNumber",
  serviceDate: "tpl.f.serviceDate",
  inspectDate: "tpl.f.inspectDate",
  finishedDate: "tpl.f.finishedDate",
  createdByName: "tpl.f.createdByName",
  createdByPhone: "tpl.f.createdByPhone",
  inspectByName: "tpl.f.inspectByName",
  repairByName: "tpl.f.repairByName",
  repairByPhone: "tpl.f.repairByPhone",
  verifiedByName: "tpl.f.verifiedByName",
  sparePartsSummary: "tpl.f.sparePartsSummary",
  sparePartsCount: "tpl.f.sparePartsCount",
  sparePartsTotalCost: "tpl.f.sparePartsTotalCost",
  sparePartsRemarks: "tpl.f.sparePartsRemarks",
  isHoldStatus: "tpl.f.isHoldStatus",
  daysTaken: "tpl.f.daysTaken",
};

const FONT_PRESETS = [7, 8, 9, 10, 11, 12, 14, 16];

const FONT_FAMILIES = [
  { label: "Khmer OS Battambang (Default)", value: "khmer" },
  { label: "Kantumruy Pro (Modern)", value: "kantumruy" },
  { label: "Noto Sans Khmer (Google)", value: "noto" },
  { label: "Arial Clean", value: "arial" },
  { label: "Times New Roman", value: "times" },
  { label: "Courier New Mono", value: "courier" },
];

interface PropertyInspectorProps {
  target?: DesignTarget | null;
  onDeselect: () => void;
  onSelectTarget?: (target: DesignTarget) => void;
}

const cardCls = "p-3 rounded-xl border border-subtle bg-surface shadow-xs space-y-2.5";
const labelCls = "block text-xs font-semibold text-ink space-y-1";
const inputCls = "w-full px-2.5 py-1.5 rounded-lg border border-subtle bg-sunken text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition font-khmer";
const sectionHeaderCls = "text-[11px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5";

function SearchableFieldSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (field: string) => void;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return TICKET_FIELDS;
    return TICKET_FIELDS.filter((f) => {
      const label = FIELD_NAME[f.key] ? t(FIELD_NAME[f.key]) : f.key;
      return f.key.toLowerCase().includes(term) || label.toLowerCase().includes(term);
    });
  }, [search, t]);

  const activeDef = TICKET_FIELDS.find((f) => f.key === value);
  const activeLabel = activeDef
    ? FIELD_NAME[activeDef.key]
      ? t(FIELD_NAME[activeDef.key])
      : activeDef.key
    : value;

  const grouped = useMemo(() => {
    const map: Record<string, TicketFieldDef[]> = {};
    filtered.forEach((f) => {
      map[f.group] = map[f.group] || [];
      map[f.group].push(f);
    });
    return map;
  }, [filtered]);

  return (
    <div className="relative space-y-1">
      <span className="block text-xs font-semibold text-ink flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5 text-accent" />
        <span>{t("tpl.boundField")}</span>
      </span>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg border border-subtle bg-sunken text-xs text-ink hover:bg-cushion transition cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span className="font-semibold text-ink truncate">{activeLabel}</span>
          <span className="font-mono text-[10px] text-ink-muted">({value})</span>
        </div>
        <Sliders className="w-3.5 h-3.5 text-ink-muted shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-subtle bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-72">
            <div className="p-2 border-b border-subtle bg-sunken/60 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={t("tpl.searchField")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-none text-xs text-ink placeholder:text-ink-muted focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="p-0.5 rounded hover:bg-cushion text-ink-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-2">
              {Object.keys(grouped).length === 0 ? (
                <p className="p-3 text-center text-xs text-ink-muted">
                  {t("tpl.noFieldsFound")}
                </p>
              ) : (
                Object.entries(grouped).map(([groupKey, fields]) => (
                  <div key={groupKey} className="space-y-0.5">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-sunken/40 rounded">
                      {GROUP_NAME[groupKey] ? t(GROUP_NAME[groupKey]) : groupKey}
                    </p>
                    {fields.map((f) => {
                      const isSelected = f.key === value;
                      const label = FIELD_NAME[f.key] ? t(FIELD_NAME[f.key]) : f.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => {
                            onChange(f.key);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition text-left cursor-pointer ${
                            isSelected
                              ? "bg-accent/15 text-accent font-bold"
                              : "text-ink hover:bg-sunken"
                          }`}
                        >
                          <div className="truncate flex-1 pr-2">
                            <p className="truncate">{label}</p>
                            <p className="font-mono text-[9.5px] text-ink-muted">{f.key}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-sunken text-ink-muted border border-subtle">
                              {TYPE_NAME[f.type] ? t(TYPE_NAME[f.type]) : f.type}
                            </span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-accent" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TypographyBox({
  fontPt,
  bold,
  italic,
  underline,
  fontFamily,
  align,
  color,
  defaultFontPt,
  onChange,
}: {
  fontPt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontFamily?: string;
  align?: "left" | "center" | "right";
  color?: string;
  defaultFontPt: number;
  onChange: (patch: {
    fontPt?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontFamily?: string;
    align?: "left" | "center" | "right";
    color?: string;
  }) => void;
}) {
  const { t } = useI18n();
  const currentPt = fontPt || defaultFontPt;

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between">
        <p className={sectionHeaderCls}>
          <Type className="w-3.5 h-3.5" />
          <span>{t("tpl.typography")}</span>
        </p>
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent">
          {currentPt} pt
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-ink">
          <span>{t("tpl.fontSize")}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChange({ fontPt: Math.max(6, Math.round((currentPt - 0.5) * 2) / 2) })}
              className="w-6 h-6 rounded bg-sunken border border-subtle text-ink hover:bg-cushion flex items-center justify-center font-bold text-xs cursor-pointer"
            >
              -
            </button>
            <input
              type="number"
              min={6}
              max={24}
              step={0.5}
              value={currentPt}
              onChange={(e) => onChange({ fontPt: Number(e.target.value) || defaultFontPt })}
              className="w-12 text-center py-0.5 rounded bg-sunken border border-subtle font-mono text-xs font-bold text-ink"
            />
            <button
              type="button"
              onClick={() => onChange({ fontPt: Math.min(24, Math.round((currentPt + 0.5) * 2) / 2) })}
              className="w-6 h-6 rounded bg-sunken border border-subtle text-ink hover:bg-cushion flex items-center justify-center font-bold text-xs cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 pt-0.5">
          {FONT_PRESETS.map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => onChange({ fontPt: pt })}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                currentPt === pt
                  ? "bg-accent text-white font-bold shadow-xs"
                  : "bg-sunken text-ink-muted hover:text-ink hover:bg-cushion border border-subtle"
              }`}
            >
              {pt}pt
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs text-ink font-medium">{t("tpl.fontFamily")}</span>
        <select
          value={fontFamily || ""}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className={`${inputCls} py-1 cursor-pointer`}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-1 flex items-center justify-between border-t border-subtle">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Bold"
            onClick={() => onChange({ bold: bold !== undefined ? !bold : false })}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition cursor-pointer ${
              bold || (bold === undefined && false)
                ? "bg-accent/15 text-accent font-black ring-1 ring-accent/40"
                : "text-ink-muted hover:text-ink hover:bg-cushion"
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => onChange({ italic: !italic })}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs transition cursor-pointer ${
              italic
                ? "bg-accent/15 text-accent font-bold ring-1 ring-accent/40"
                : "text-ink-muted hover:text-ink hover:bg-cushion"
            }`}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Underline"
            onClick={() => onChange({ underline: !underline })}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs transition cursor-pointer ${
              underline
                ? "bg-accent/15 text-accent font-bold ring-1 ring-accent/40"
                : "text-ink-muted hover:text-ink hover:bg-cushion"
            }`}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 bg-sunken rounded p-0.5 border border-subtle">
          <button
            type="button"
            title="Align Left"
            onClick={() => onChange({ align: "left" })}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs transition cursor-pointer ${
              align === "left"
                ? "bg-accent/15 text-accent"
                : "text-ink-muted hover:text-ink hover:bg-cushion"
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Align Center"
            onClick={() => onChange({ align: "center" })}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs transition cursor-pointer ${
              align === "center"
                ? "bg-accent/15 text-accent"
                : "text-ink-muted hover:text-ink hover:bg-cushion"
            }`}
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Align Right"
            onClick={() => onChange({ align: "right" })}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs transition cursor-pointer ${
              align === "right" || !align
                ? "bg-accent/15 text-accent"
                : "text-ink-muted hover:text-ink hover:bg-cushion"
            }`}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}


function FieldSelector({
  value,
  onChange,
  label = "Bound Database Field",
}: {
  value: string;
  onChange: (fieldKey: string) => void;
  label?: string;
}) {
  const selectedDef = TICKET_FIELDS.find((f) => f.key === value);

  return (
    <div className={cardCls}>
      <label className={labelCls}>
        <span className="flex items-center gap-1.5 font-bold text-xs text-ink">
          <Database className="w-3.5 h-3.5 text-accent" />
          <span>{label}</span>
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} mt-1 font-mono font-bold text-xs text-accent bg-sunken cursor-pointer border-accent/30 focus:border-accent`}
        >
          <optgroup label="📋 1. Ticket & Service Core">
            {TICKET_FIELDS.filter((f) => f.group === "ticket").map((f) => (
              <option key={f.key} value={f.key}>
                {f.key} ({f.type})
              </option>
            ))}
          </optgroup>
          <optgroup label="🔧 2. Spare Parts & Costs">
            {TICKET_FIELDS.filter((f) => f.group === "spareparts").map((f) => (
              <option key={f.key} value={f.key}>
                {f.key} ({f.type})
              </option>
            ))}
          </optgroup>
          <optgroup label="🏢 3. Customer & Contact">
            {TICKET_FIELDS.filter((f) => f.group === "customer").map((f) => (
              <option key={f.key} value={f.key}>
                {f.key} ({f.type})
              </option>
            ))}
          </optgroup>
          <optgroup label="💻 4. Machine & Equipment">
            {TICKET_FIELDS.filter((f) => f.group === "machine").map((f) => (
              <option key={f.key} value={f.key}>
                {f.key} ({f.type})
              </option>
            ))}
          </optgroup>
          <optgroup label="📅 5. Lifecycle & Audit Dates">
            {TICKET_FIELDS.filter((f) => f.group === "dates").map((f) => (
              <option key={f.key} value={f.key}>
                {f.key} ({f.type})
              </option>
            ))}
          </optgroup>
          <optgroup label="👥 6. People & Engineers">
            {TICKET_FIELDS.filter((f) => f.group === "people").map((f) => (
              <option key={f.key} value={f.key}>
                {f.key} ({f.type})
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {selectedDef && (
        <div className="flex items-center justify-between mt-1 text-[10px] text-ink-muted">
          <span>Type: <strong className="uppercase text-accent font-mono">{selectedDef.type}</strong></span>
          <span>Group: <strong className="capitalize text-ink">{selectedDef.group}</strong></span>
        </div>
      )}
    </div>
  );
}


function LogoInspector({
  s,
  updateReportTemplate,
  t,
}: {
  s: ReportTemplateSettings;
  updateReportTemplate: (patch: Partial<ReportTemplateSettings>) => void;
  t: (key: TranslationKey) => string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (.png, .jpg, .svg, .webp)");
      return;
    }

    setUploading(true);
    try {
      const cdnUrl = await uploadImage(file);
      if (cdnUrl) {
        updateReportTemplate({
          logoSource: "custom",
          logoCustomUrl: cdnUrl,
          logoVisible: true,
        });
        setUploading(false);
        return;
      }
    } catch {
      // Cloudflare R2 not configured or offline — fall back to embedded Base64 Data URL
      const reader = new FileReader();
      reader.onload = (loadEv) => {
        const dataUrl = loadEv.target?.result as string;
        if (dataUrl) {
          updateReportTemplate({
            logoSource: "custom",
            logoCustomUrl: dataUrl,
            logoVisible: true,
          });
        }
        setUploading(false);
      };
      reader.onerror = () => setUploading(false);
      reader.readAsDataURL(file);
      return;
    }
    setUploading(false);
  };

  const activeSrc =
    s.logoSource === "custom" && s.logoCustomUrl
      ? s.logoCustomUrl
      : s.logoSource === "brand"
      ? "/images/CamLogo.png"
      : "/images/CamLogo.png";

  return (
    <div className="space-y-3">
      {/* Header & Visibility */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md flex items-center gap-1">
          <ImageIcon className="w-3 h-3" />
          <span>HEADER & LOGO · LOGO</span>
        </span>
        <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={s.logoVisible}
            onChange={(e) => updateReportTemplate({ logoVisible: e.target.checked })}
            className="w-4 h-4 accent-accent rounded"
          />
          <span>Show on report</span>
        </label>
      </div>

      {/* Logo Source Selection */}
      <div className={cardCls}>
        <p className={sectionHeaderCls}>
          <Layers className="w-3.5 h-3.5" />
          <span>Logo Image Source</span>
        </p>

        <div className="grid grid-cols-3 gap-1.5 p-1 bg-sunken rounded-xl border border-subtle">
          {[
            { key: "default", label: "Default" },
            { key: "brand", label: "Branding" },
            { key: "custom", label: "Custom" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() =>
                updateReportTemplate({
                  logoSource: opt.key as "default" | "brand" | "custom",
                })
              }
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                s.logoSource === opt.key
                  ? "bg-accent text-white shadow-xs"
                  : "text-ink hover:bg-cushion"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Live Logo Preview Box */}
        <div className="p-3 rounded-xl border border-subtle bg-sunken/40 flex flex-col items-center justify-center gap-2 mt-2">
          <div className="max-h-24 max-w-full flex items-center justify-center p-2 bg-white rounded-lg border border-black/10 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeSrc}
              alt="Logo Preview"
              className="max-h-20 max-w-full object-contain"
            />
          </div>
          <p className="text-[10px] text-ink-muted text-center font-medium">
            {s.logoSource === "custom"
              ? "Custom Logo Active"
              : s.logoSource === "brand"
              ? "Using App Brand Logo"
              : "Using Bundled Cam Logo"}
          </p>
        </div>

        {/* Custom Upload & URL Controls */}
        {s.logoSource === "custom" && (
          <div className="space-y-2 pt-2 border-t border-subtle mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 transition cursor-pointer shadow-xs"
            >
              {uploading ? (
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>ជ្រើសរើសរូប Logo ពីកុំព្យូទ័រ (Upload Image)</span>
            </button>

            <label className={labelCls}>
              <span className="text-[11px] text-ink-muted">Or Image URL / Base64:</span>
              <input
                type="text"
                placeholder="https://example.com/logo.png"
                value={s.logoCustomUrl}
                onChange={(e) =>
                  updateReportTemplate({
                    logoSource: "custom",
                    logoCustomUrl: e.target.value,
                  })
                }
                className={`${inputCls} mt-1 font-mono text-[11px]`}
              />
            </label>
          </div>
        )}

        {/* Quick Reset to Default Button */}
        {s.logoSource !== "default" && (
          <div className="pt-2 border-t border-subtle mt-2">
            <button
              type="button"
              onClick={() =>
                updateReportTemplate({
                  logoSource: "default",
                  logoCustomUrl: "",
                })
              }
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-ink-muted" />
              <span>Reset to Default Logo</span>
            </button>
          </div>
        )}
      </div>

      {/* Logo Height Sizing Slider */}
      <div className={cardCls}>
        <label className={labelCls}>
          <div className="flex justify-between">
            <span>Logo Height</span>
            <span className="font-mono font-bold text-accent">{s.logoHeightPx} px</span>
          </div>
          <input
            type="range"
            min={20}
            max={140}
            step={2}
            value={s.logoHeightPx}
            onChange={(e) => updateReportTemplate({ logoHeightPx: Number(e.target.value) })}
            className="w-full accent-accent cursor-pointer mt-1"
          />
        </label>
      </div>
    </div>
  );
}


function PositionInspector({
  target,
  s,
  updateReportTemplate,
}: {
  target: DesignTarget | null;
  s: ReportTemplateSettings;
  updateReportTemplate: (patch: Partial<ReportTemplateSettings>) => void;
}) {
  if (!target) return null;

  // Shared with the renderer, which reads the same key to apply the offset.
  const targetKey = getTargetKey(target);

  const offset = s.componentOffsets?.[targetKey] || { x: 0, y: 0 };
  const hasOffset = offset.x !== 0 || offset.y !== 0;

  const handleUpdateOffset = (axis: "x" | "y", val: number) => {
    updateReportTemplate({
      componentOffsets: {
        ...(s.componentOffsets || {}),
        [targetKey]: {
          ...offset,
          [axis]: val,
        },
      },
    });
  };

  const handleReset = () => {
    const next = { ...(s.componentOffsets || {}) };
    delete next[targetKey];
    updateReportTemplate({ componentOffsets: next });
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between">
        <p className={sectionHeaderCls}>
          <Move className="w-3.5 h-3.5" />
          <span>📐 Canvas Position (X / Y Offset)</span>
        </p>
        {hasOffset && (
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] text-danger hover:underline cursor-pointer font-bold"
          >
            Reset (0, 0)
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <label className={labelCls}>
          <div className="flex justify-between">
            <span className="text-[10px]">X (Horizontal)</span>
            <span className="font-mono text-accent font-bold">{offset.x}px</span>
          </div>
          <input
            type="range"
            min={-200}
            max={200}
            step={2}
            value={offset.x}
            onChange={(e) => handleUpdateOffset("x", Number(e.target.value))}
            className="w-full accent-accent cursor-pointer mt-0.5"
          />
        </label>

        <label className={labelCls}>
          <div className="flex justify-between">
            <span className="text-[10px]">Y (Vertical)</span>
            <span className="font-mono text-accent font-bold">{offset.y}px</span>
          </div>
          <input
            type="range"
            min={-200}
            max={200}
            step={2}
            value={offset.y}
            onChange={(e) => handleUpdateOffset("y", Number(e.target.value))}
            className="w-full accent-accent cursor-pointer mt-0.5"
          />
        </label>
      </div>
      <p className="text-[9.5px] text-ink-muted mt-1 italic">
        💡 Tip: You can also hold Left Mouse Click directly on the element in the canvas to drag it anywhere!
      </p>
    </div>
  );
}

export default function PropertyInspector({
  target,
  onDeselect,
  onSelectTarget,
}: PropertyInspectorProps) {
  const { t } = useI18n();
  const s = useReportTemplateDraft();

  const setLabel = (k: keyof ReportLabels, v: string) =>
    updateReportTemplate({ labels: { ...s.labels, [k]: v } });

  const setSec = (k: keyof ReportTemplateSettings["sections"], v: boolean) =>
    updateReportTemplate({ sections: { ...s.sections, [k]: v } });

  const setSig = (k: keyof ReportSignatureToggles, v: boolean) =>
    updateReportTemplate({ signatureRoles: { ...s.signatureRoles, [k]: v } });

  const setCol = (k: ReportColumnKey, v: boolean) =>
    updateReportTemplate({ columns: { ...s.columns, [k]: v } });

  const setWidth = (k: keyof ReportTemplateSettings["columnWidths"], v: number) =>
    updateReportTemplate({ columnWidths: { ...s.columnWidths, [k]: v } });

  
  const moveSection = (sec: "customer" | "instrument" | "request" | "diagnostic" | "solution", dir: -1 | 1) => {
    const currentOrder = s.sectionOrder || ["customer", "instrument", "request", "diagnostic", "solution"];
    const idx = currentOrder.indexOf(sec);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;
    const next = [...currentOrder];
    const [item] = next.splice(idx, 1);
    next.splice(targetIdx, 0, item);
    updateReportTemplate({ sectionOrder: next });
  };

  /**
   * Reorders the bottom signature blocks.
   *
   * This used to be drag-and-drop on the old designer canvas, which was the
   * ONLY way to set `signatureOrder` — when that canvas was replaced by an
   * overlay on the shared report layout, the capability would have been lost
   * with it. Buttons here are also more discoverable than an undocumented drag.
   */
  const moveSignature = (role: ReportSignatureRole, dir: -1 | 1) => {
    const list = [...(s.signatureOrder ?? ALL_SIGNATURE_ROLES)];
    const idx = list.indexOf(role);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= list.length) return;
    const [item] = list.splice(idx, 1);
    list.splice(nextIdx, 0, item);
    updateReportTemplate({ signatureOrder: list });
  };

  const moveColumn = (col: ReportColumnKey, dir: -1 | 1) => {
    const list = [...s.columnOrder];
    const idx = list.indexOf(col);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= list.length) return;
    const [item] = list.splice(idx, 1);
    list.splice(nextIdx, 0, item);
    updateReportTemplate({ columnOrder: list });
  };

  const updateRow = (
    sec: "customer" | "instrument",
    rowId: string,
    patch: Partial<ReportInfoRow>
  ) => {
    const key: "infoRowsCustomer" | "infoRowsInstrument" =
      sec === "customer" ? "infoRowsCustomer" : "infoRowsInstrument";
    const list = s[key].map((r: ReportInfoRow) => (r.id === rowId ? { ...r, ...patch } : r));
    updateReportTemplate({ [key]: list });
  };

  const moveRow = (sec: "customer" | "instrument", rowId: string, dir: -1 | 1) => {
    const key: "infoRowsCustomer" | "infoRowsInstrument" =
      sec === "customer" ? "infoRowsCustomer" : "infoRowsInstrument";
    const list = [...s[key]];
    const idx = list.findIndex((r: ReportInfoRow) => r.id === rowId);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= list.length) return;
    const [item] = list.splice(idx, 1);
    list.splice(nextIdx, 0, item);
    updateReportTemplate({ [key]: list });
  };

  const removeRow = (sec: "customer" | "instrument", rowId: string) => {
    const key: "infoRowsCustomer" | "infoRowsInstrument" =
      sec === "customer" ? "infoRowsCustomer" : "infoRowsInstrument";
    const list = s[key].filter((r: ReportInfoRow) => r.id !== rowId);
    updateReportTemplate({ [key]: list });
    onDeselect();
  };

  const addRow = (sec: "customer" | "instrument") => {
    const key: "infoRowsCustomer" | "infoRowsInstrument" =
      sec === "customer" ? "infoRowsCustomer" : "infoRowsInstrument";
    const nextId = `r_${Date.now()}`;
    const newRow: ReportInfoRow = {
      id: nextId,
      label: "Custom Field",
      field: "reportNo",
      visible: true,
    };
    updateReportTemplate({ [key]: [...s[key], newRow] });
    onSelectTarget?.({ kind: "infoRowValue", section: sec, id: nextId });
  };

  return (
    <aside className="w-80 shrink-0 h-full flex flex-col rounded-2xl border border-subtle bg-surface shadow-sm overflow-hidden select-none">
      {/* Inspector Header */}
      <div className="p-3.5 border-b border-subtle flex items-center justify-between bg-sunken/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink">
              {t("tpl.propertyInspector")}
            </h3>
            <p className="text-[10px] text-ink-muted">
              {target ? t("tpl.selectedElement") : t("tpl.noSelection")}
            </p>
          </div>
        </div>

        {target && (
          <button
            type="button"
            onClick={onDeselect}
            title="Deselect"
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-cushion transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Inspector Content Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {!target ? (
          /* Empty Selection Placeholder */
          <div className="py-12 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h4 className="text-xs font-bold text-ink">
              {t("tpl.noSelection")}
            </h4>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              {t("tpl.noSelectionHint")}
            </p>
          </div>
        ) : target.kind === "infoRowLabel" ? (
          /* 1. SEPARATE LABEL INSPECTOR (XRLabel) */
          (() => {
            const rows = target.section === "customer" ? s.infoRowsCustomer : s.infoRowsInstrument;
            const row = rows.find((r: ReportInfoRow) => r.id === target.id);
            if (!row) return null;
            const idx = rows.findIndex((r: ReportInfoRow) => r.id === target.id);

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    <span>LABEL CONTROL</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectTarget?.({ kind: "infoRowValue", section: target.section, id: row.id })}
                    className="text-[10px] text-accent font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Edit Field Binding &rarr;</span>
                  </button>
                </div>

                <div className={cardCls}>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-ink-muted" />
                      <span>Label Text / Caption</span>
                    </span>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => updateRow(target.section, row.id, { label: e.target.value })}
                      className={`${inputCls} mt-1 font-semibold`}
                    />
                  </label>
                </div>

                {/* Typography for Label */}
                <TypographyBox
                  fontPt={row.fontPt}
                  bold={row.bold}
                  italic={row.italic}
                  underline={row.underline}
                  fontFamily={row.fontFamily}
                  align={row.align}
                  color={row.color}
                  defaultFontPt={s.baseFontPt}
                  onChange={(patch) => updateRow(target.section, row.id, patch)}
                />

                {/* Quick Actions */}
                <div className={cardCls}>
                  <p className={sectionHeaderCls}>
                    <Move className="w-3.5 h-3.5" />
                    {t("tpl.quickActions")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={idx <= 0}
                      onClick={() => moveRow(target.section, row.id, -1)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>{t("tpl.moveUp")}</span>
                    </button>
                    <button
                      type="button"
                      disabled={idx >= rows.length - 1}
                      onClick={() => moveRow(target.section, row.id, 1)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>{t("tpl.moveDown")}</span>
                    </button>
                  </div>
                  <div className="pt-2 border-t border-subtle flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => addRow(target.section)}
                      className="flex items-center gap-1.5 text-xs text-accent font-semibold hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t("tpl.addField")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(target.section, row.id)}
                      className="flex items-center gap-1.5 text-xs text-danger font-medium hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t("tpl.removeField")}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        ) : target.kind === "infoRowValue" ? (
          /* 2. SEPARATE DATA FIELD INSPECTOR (XRBinding) */
          (() => {
            const rows = target.section === "customer" ? s.infoRowsCustomer : s.infoRowsInstrument;
            const row = rows.find((r: ReportInfoRow) => r.id === target.id);
            if (!row) return null;
            const idx = rows.findIndex((r: ReportInfoRow) => r.id === target.id);

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" />
                    <span>DATA FIELD CONTROL</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectTarget?.({ kind: "infoRowLabel", section: target.section, id: row.id })}
                    className="text-[10px] text-accent font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>&larr; Edit Label</span>
                  </button>
                </div>

                <div className={cardCls}>
                  <SearchableFieldSelect
                    value={row.field}
                    onChange={(newField) => updateRow(target.section, row.id, { field: newField })}
                  />
                </div>

                {/* Typography for Value Field */}
                <TypographyBox
                  fontPt={row.valueFontPt || row.fontPt}
                  bold={row.valueBold}
                  italic={row.valueItalic}
                  underline={row.valueUnderline}
                  fontFamily={row.valueFontFamily || row.fontFamily}
                  align={row.valueAlign}
                  color={row.valueColor}
                  defaultFontPt={s.baseFontPt}
                  onChange={(patch) =>
                    updateRow(target.section, row.id, {
                      valueFontPt: patch.fontPt,
                      valueBold: patch.bold,
                      valueItalic: patch.italic,
                      valueUnderline: patch.underline,
                      valueFontFamily: patch.fontFamily,
                      valueAlign: patch.align,
                      valueColor: patch.color,
                    })
                  }
                />

                {/* Quick Actions */}
                <div className={cardCls}>
                  <p className={sectionHeaderCls}>
                    <Move className="w-3.5 h-3.5" />
                    {t("tpl.quickActions")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={idx <= 0}
                      onClick={() => moveRow(target.section, row.id, -1)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>{t("tpl.moveUp")}</span>
                    </button>
                    <button
                      type="button"
                      disabled={idx >= rows.length - 1}
                      onClick={() => moveRow(target.section, row.id, 1)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>{t("tpl.moveDown")}</span>
                    </button>
                  </div>
                  <div className="pt-2 border-t border-subtle flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => addRow(target.section)}
                      className="flex items-center gap-1.5 text-xs text-accent font-semibold hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t("tpl.addField")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(target.section, row.id)}
                      className="flex items-center gap-1.5 text-xs text-danger font-medium hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t("tpl.removeField")}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        ) : target.kind === "infoRow" ? (
          /* 3. ROW COMBINED INSPECTOR */
          (() => {
            const rows = target.section === "customer" ? s.infoRowsCustomer : s.infoRowsInstrument;
            const row = rows.find((r: ReportInfoRow) => r.id === target.id);
            if (!row) return null;
            const idx = rows.findIndex((r: ReportInfoRow) => r.id === target.id);

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                    {target.section === "customer" ? t("tpl.secCustomer") : t("tpl.secInstrument")}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.visible}
                      onChange={(e) => updateRow(target.section, row.id, { visible: e.target.checked })}
                      className="w-4 h-4 accent-accent rounded"
                    />
                    <span>{t("tpl.popShow")}</span>
                  </label>
                </div>

                <div className={cardCls}>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-ink-muted" />
                      {t("tpl.popHeaderText")}
                    </span>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => updateRow(target.section, row.id, { label: e.target.value })}
                      className={`${inputCls} mt-1`}
                    />
                  </label>

                  <SearchableFieldSelect
                    value={row.field}
                    onChange={(newField) => updateRow(target.section, row.id, { field: newField })}
                  />
                </div>

                <TypographyBox
                  fontPt={row.fontPt}
                  bold={row.bold}
                  italic={row.italic}
                  underline={row.underline}
                  fontFamily={row.fontFamily}
                  align={row.align}
                  color={row.color}
                  defaultFontPt={s.baseFontPt}
                  onChange={(patch) => updateRow(target.section, row.id, patch)}
                />
              </div>
            );
          })()
        ) : target.kind === "headerBoxLabel" ? (
          /* HEADER BOX LABEL INSPECTOR */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                HEADER BOX LABEL
              </span>
            </div>
            <div className={cardCls}>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-ink-muted" />
                  <span>Caption</span>
                </span>
                <input
                  type="text"
                  value={s.labels[target.key]}
                  onChange={(e) => setLabel(target.key, e.target.value)}
                  className={`${inputCls} mt-1 font-bold`}
                />
              </label>
            </div>
          </div>
                ) : target.kind === "headerBoxValue" ? (
          /* HEADER BOX VALUE INSPECTOR (DYNAMIC BOUND FIELD PICKER) */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                HEADER SYSTEM FIELD
              </span>
            </div>

            <FieldSelector
              value={(s.headerFields && s.headerFields[target.key]) || target.key}
              onChange={(newField) => {
                updateReportTemplate({
                  headerFields: {
                    ...(s.headerFields || {}),
                    [target.key]: newField,
                  },
                });
              }}
              label="Bound Ticket Field"
            />
          </div>
        ) : target.kind === "column" ? (
          /* TABLE COLUMN INSPECTOR */
          (() => {
            const col = target.key;
            const labelKey = COLUMN_LABEL_KEY[col];
            const isVisible = s.columns[col];
            const widthKey = col as keyof ReportTemplateSettings["columnWidths"];
            const currentWidth = widthKey in s.columnWidths ? s.columnWidths[widthKey] : null;
            const colIdx = s.columnOrder.indexOf(col);

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                    {t("tpl.groupTable")}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(e) => setCol(col, e.target.checked)}
                      className="w-4 h-4 accent-accent rounded"
                    />
                    <span>{t("tpl.popShow")}</span>
                  </label>
                </div>

                <div className={cardCls}>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-ink-muted" />
                      {t("tpl.popHeaderText")}
                    </span>
                    <input
                      type="text"
                      value={s.labels[labelKey]}
                      onChange={(e) => setLabel(labelKey, e.target.value)}
                      className={`${inputCls} mt-1`}
                    />
                  </label>

                  {currentWidth != null && (
                    <label className={labelCls}>
                      <div className="flex justify-between">
                        <span>{t("tpl.popWidth")}</span>
                        <span className="font-mono text-ink">{currentWidth} px</span>
                      </div>
                      <input
                        type="range"
                        min={30}
                        max={300}
                        step={5}
                        value={currentWidth}
                        onChange={(e) => setWidth(widthKey, Number(e.target.value))}
                        className="w-full accent-accent cursor-pointer mt-1"
                      />
                    </label>
                  )}
                </div>

                {/* Column Reordering */}
                <div className={cardCls}>
                  <p className={sectionHeaderCls}>
                    <Move className="w-3.5 h-3.5" />
                    {t("tpl.colOrderHint")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={colIdx <= 0}
                      onClick={() => moveColumn(col, -1)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>{t("tpl.moveUp")}</span>
                    </button>
                    <button
                      type="button"
                      disabled={colIdx >= s.columnOrder.length - 1}
                      onClick={() => moveColumn(col, 1)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>{t("tpl.moveDown")}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        ) : target.kind === "section" || target.kind === "body" ? (
          /* SECTION / BODY INSPECTOR */
          (() => {
            const secKey = target.key;
            const labelKey = SECTION_LABEL_KEY[secKey];
            const isVisible = s.sections[secKey];

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                    {t("tpl.groupSections")}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(e) => setSec(secKey, e.target.checked)}
                      className="w-4 h-4 accent-accent rounded"
                    />
                    <span>{t("tpl.popShow")}</span>
                  </label>
                </div>

                {/* Section Reordering */}
                <div className={cardCls}>
                  <p className={sectionHeaderCls}>
                    <Move className="w-3.5 h-3.5" />
                    <span>Section Position Order</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={(s.sectionOrder || ["customer", "instrument", "request", "diagnostic", "solution"]).indexOf(secKey) <= 0}
                      onClick={() => moveSection(secKey, -1)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>{t("tpl.moveUp")}</span>
                    </button>
                    <button
                      type="button"
                      disabled={(s.sectionOrder || ["customer", "instrument", "request", "diagnostic", "solution"]).indexOf(secKey) >= (s.sectionOrder || ["customer", "instrument", "request", "diagnostic", "solution"]).length - 1}
                      onClick={() => moveSection(secKey, 1)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-subtle bg-sunken text-ink text-xs hover:bg-cushion disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>{t("tpl.moveDown")}</span>
                    </button>
                  </div>
                </div>


                <div className={cardCls}>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-ink-muted" />
                      {t("tpl.popHeaderText")}
                    </span>
                    <input
                      type="text"
                      value={s.labels[labelKey]}
                      onChange={(e) => setLabel(labelKey, e.target.value)}
                      className={`${inputCls} mt-1`}
                    />
                  </label>

                  {(secKey === "customer" || secKey === "instrument") && (
                    <div className="pt-2 border-t border-subtle">
                      <button
                        type="button"
                        onClick={() => addRow(secKey)}
                        className="flex items-center gap-1.5 text-xs text-accent font-semibold hover:underline cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t("tpl.addField")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()
                ) : target.kind === "signatureCell" || target.kind === "signatureLabel" || target.kind === "signaturePerson" ? (
          /* SIGNATURE CELL / LABEL / PERSON INSPECTOR */
          (() => {
            const role = target.role;
            const roleTitle =
              role === "customer"
                ? "Customer Signature"
                : role === "verify"
                ? "Verifier Signature"
                : "Engineer Signature";

            const kmKey =
              role === "customer"
                ? "sigCustomerKm"
                : role === "verify"
                ? "sigVerifyKm"
                : "sigEngineerKm";

            const enKey =
              role === "customer"
                ? "sigCustomerEn"
                : role === "verify"
                ? "sigVerifyEn"
                : "sigEngineerEn";

            const nameKey =
              role === "verify"
                ? "sigVerifyName"
                : role === "engineer"
                ? "sigEngineerName"
                : null;

            const phoneKey =
              role === "verify"
                ? "sigVerifyPhone"
                : role === "engineer"
                ? "sigEngineerPhone"
                : null;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                    {roleTitle}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.signatureRoles[role]}
                      onChange={(e) => setSig(role, e.target.checked)}
                      className="w-4 h-4 accent-accent rounded"
                    />
                    <span>{t("tpl.popShow")}</span>
                  </label>
                </div>

                {/* Print order of the three signature columns. */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveSignature(role, -1)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold rounded-md border border-subtle text-ink hover:bg-accent/10 hover:text-accent transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5 -rotate-90" />
                    <span>{t("tpl.moveUp")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSignature(role, 1)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold rounded-md border border-subtle text-ink hover:bg-accent/10 hover:text-accent transition-colors cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5 -rotate-90" />
                    <span>{t("tpl.moveDown")}</span>
                  </button>
                </div>

                {/* Khmer Caption */}
                <div className={cardCls}>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-ink-muted" />
                      <span>Khmer Caption</span>
                    </span>
                    <input
                      type="text"
                      value={s.labels[kmKey]}
                      onChange={(e) => setLabel(kmKey, e.target.value)}
                      className={`${inputCls} mt-1 font-bold`}
                    />
                  </label>

                  {/* English Caption */}
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-ink-muted" />
                      <span>English Subtitle</span>
                    </span>
                    <input
                      type="text"
                      value={s.labels[enKey]}
                      onChange={(e) => setLabel(enKey, e.target.value)}
                      className={`${inputCls} mt-1`}
                    />
                  </label>
                </div>

                {/* Fallback Person Name & Phone (For Verify & Engineer) */}
                {nameKey && phoneKey && (
                  <div className={cardCls}>
                    <p className={sectionHeaderCls}>
                      <Database className="w-3.5 h-3.5 text-accent" />
                      <span>Fallback Signer Info</span>
                    </p>
                    <label className={labelCls}>
                      <span>Default Name (when unassigned):</span>
                      <input
                        type="text"
                        value={s.labels[nameKey]}
                        onChange={(e) => setLabel(nameKey, e.target.value)}
                        className={`${inputCls} mt-1 font-semibold`}
                      />
                    </label>
                    <label className={labelCls}>
                      <span>Default Phone:</span>
                      <input
                        type="text"
                        value={s.labels[phoneKey]}
                        onChange={(e) => setLabel(phoneKey, e.target.value)}
                        className={`${inputCls} mt-1 font-mono`}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })()
        ) : target.kind === "signatures" ? (
          /* SIGNATURES INSPECTOR */
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md inline-block">
              {t("tpl.groupSignatures")}
            </span>

            <div className={cardCls}>
              <div className="space-y-2">
                {[
                  { key: "customer" as const, label: t("tpl.sigCustomer") },
                  { key: "verify" as const, label: t("tpl.sigVerify") },
                  { key: "engineer" as const, label: t("tpl.sigEngineer") },
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center justify-between p-2 rounded-lg bg-sunken/60 hover:bg-cushion cursor-pointer transition text-xs text-ink"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={s.signatureRoles[key]}
                      onChange={(e) => setSig(key, e.target.checked)}
                      className="w-4 h-4 accent-accent rounded"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : target.kind === "title" ? (
          /* TITLE INSPECTOR */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md inline-block">
                {t("tpl.groupHeader")} · Title
              </span>
              <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.titleVisible}
                  onChange={(e) => updateReportTemplate({ titleVisible: e.target.checked })}
                  className="w-4 h-4 accent-accent rounded"
                />
                <span>{t("tpl.popShow")}</span>
              </label>
            </div>

            <div className={cardCls}>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-ink-muted" />
                  <span>Report Title Text</span>
                </span>
                <input
                  type="text"
                  value={s.titleText}
                  onChange={(e) => updateReportTemplate({ titleText: e.target.value })}
                  className={`${inputCls} mt-1 font-bold`}
                />
              </label>

              <label className={labelCls}>
                <div className="flex justify-between">
                  <span>{t("tpl.fontSize")}</span>
                  <span className="font-mono font-bold text-accent">{s.titleFontPt} pt</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={24}
                  step={0.5}
                  value={s.titleFontPt}
                  onChange={(e) => updateReportTemplate({ titleFontPt: Number(e.target.value) })}
                  className="w-full accent-accent cursor-pointer mt-1"
                />
              </label>
            </div>
          </div>
        ) : target.kind === "logo" ? (
          <LogoInspector s={s} updateReportTemplate={updateReportTemplate} t={t} />
        ) : (
          /* GENERAL TARGET */
          <div className={cardCls}>
            <p className="text-xs text-ink-muted">
              {t("tpl.inspectorHint")}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
