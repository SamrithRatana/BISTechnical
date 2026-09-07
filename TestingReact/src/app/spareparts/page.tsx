"use client";

import React, { memo, useMemo, useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/PageWrapper";
import HighlightText from "@/components/HighlightText";
import {
  Plus,
  Search,
  Download,
  RefreshCw,
  Box,
  MinusCircle,
  PackageCheck,
  Edit,
  Trash2,
  X,
  Save,
  Upload,
  Loader2,
  Image as ImageIcon,
  Smartphone,
  Printer,
} from "lucide-react";
import { useCompanionScanner } from "@/context/CompanionScannerContext";
import {
  fetchSparePartsInventory,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  insertManualStockOut,
  invalidateCachePrefix,
  SparePartItem,
  fetchSparePartById,
} from "@/services/api";
import { uploadImage, UploadError } from "@/services/upload";
import { uploadErrorTranslationKey } from "@/lib/uploadErrorMessage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useRealtimeResource } from "@/hooks/useRealtimeTickets";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useSearchAction } from "@/hooks/useSearchAction";
import { useI18n } from "@/i18n/LanguageProvider";
import { firstValidationMessage } from "@/i18n/validationMessage";
import { validateSparePart, validateStockIn, validateStockOut } from "@/validation";
import { sendTelegramNotification } from "@/services/telegramService";
import { buildStockTelegramMessage } from "@/services/telegramMessageBuilder";
import { getCurrentUserFullName, getCurrentUserGuid } from "@/services/userService";
import { clearListCache } from "@/hooks/useInfiniteList";
import type { TranslationKey } from "@/i18n/translations";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";
import { useActionHandler, type ActionValues } from "@/components/ActionBus";
import { Badge, ConfirmDialog, EmptyState, ProgressBar, SkeletonRows } from "@/components/av";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import MediaLightbox from "@/components/MediaLightbox";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { cn } from "@/lib/utils";
import type { SparePartFilters } from "@/services/api";
import type { SparePartClassification } from "@/services/types";
import { SparePartFilterBar } from "@/components/spareparts/SparePartFilterBar";
import { SparePartClassificationFields } from "@/components/spareparts/SparePartClassificationFields";
import { useSparePartTaxonomyOptions } from "@/components/spareparts/useSparePartTaxonomyOptions";
import { useSparePartFilterParams } from "@/components/spareparts/useSparePartFilterParams";
import { TableHeaderFilterPopover } from "@/components/spareparts/TableHeaderFilterPopover";
import ModernSelect from "@/components/ModernSelect";
import { useTheme } from "@/theme/ThemeProvider";
import EnterpriseRibbonToolbar from "@/components/crud/EnterpriseRibbonToolbar";
import ColumnVisibilityDropdown, { type ColumnDefinition } from "@/components/crud/ColumnVisibilityDropdown";

interface ColumnFilters {
  itemName?: string;
  partNumber?: string;
  useFor?: string;
  hasImage?: "all" | "yes" | "no";
  minPrice?: number | null;
  maxPrice?: number | null;
  unclassifiedOnly?: boolean;
}

interface ColumnSort {
  column: "itemName" | "partNumber" | "price" | "quantity" | null;
  direction: "asc" | "desc" | null;
}

/**
 * Stock bands, derived from quantity. One definition, read by the badge, the
 * progress bar and the filter chips — they used to be three separate `if`
 * ladders over the same two thresholds.
 */
type StockBand = "good" | "critical" | "out";

function stockBand(qty: number): StockBand {
  if (qty <= 0) return "out";
  if (qty <= 2) return "critical";
  return "good";
}

const BAND_TONE = { good: "success", critical: "warning", out: "danger" } as const;
const BAND_LABEL = {
  good: "sp.stockGood",
  critical: "sp.stockCritical",
  out: "sp.stockOut",
} as const;

/**
 * What the stock bar is drawn as a proportion OF.
 *
 * There is no per-part reorder threshold in the data, so a "percentage of
 * target stock" would be inventing a denominator. Ten is the point past which
 * the exact number stops mattering at a glance — anything at or above it fills
 * the bar. The number itself is always shown above the bar, so the bar is a
 * scanning aid, not the source of truth.
 */
const STOCK_BAR_FULL = 10;

/**
 * Rendered height of one spare-part row, in px. Measured, not estimated:
 * 225 sampled rows were 96px with zero variance. Row virtualization derives
 * the scroll geometry from this, so it must track the real rendered height —
 * if the row padding or the thumbnail size changes, re-measure and update it.
 */
const SPAREPART_ROW_HEIGHT = 96;

/**
 * Normalises a picture URL from the parts database — absolute URLs pass
 * through, relative ones get a leading slash.
 *
 * Module scope rather than inside the component: it closes over nothing, and
 * `PartRow` needs it. It was also being re-created on every render for no
 * reason.
 */
function getImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

// Simple SVG Code128 Barcode Graphic
function BarcodeSvg({ value }: { value: string }) {
  const str = value || "00000";
  const bars: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bars.push((code % 3) + 1, ((code * 3) % 2) + 1, ((code * 7) % 3) + 1, (code % 2) + 1);
  }

  let xPos = 10;
  return (
    <div className="flex flex-col items-center justify-center py-1">
      <svg width="180" height="42" viewBox="0 0 200 48" className="bg-surface p-1 rounded border border-subtle shadow-2xs ">
        <rect x="5" y="4" width="2" height="40" fill="currentColor" className="text-ink " />
        <rect x="9" y="4" width="1" height="40" fill="currentColor" className="text-ink " />
        {bars.map((w, idx) => {
          xPos += w + (idx % 2 === 0 ? 1 : 2);
          if (xPos > 185) return null;
          return (
            <rect
              key={idx}
              x={xPos}
              y="4"
              width={w}
              height="40"
              fill={idx % 2 === 0 ? "currentColor" : "transparent"}
              className="text-ink "
            />
          );
        })}
        <rect x="188" y="4" width="2" height="40" fill="currentColor" className="text-ink " />
      </svg>
      <span className="font-mono text-[10px] font-bold text-ink mt-0.5 tracking-wider">
        {str}
      </span>
    </div>
  );
}

/**
 * One spare-part row.
 *
 * Extracted and memoised for row virtualization. The window holds ~22 rows and
 * the virtualizer re-renders on every scroll frame; with the JSX inline, all 22
 * were reconciled each frame and 16.3% of frames ran over 32ms at a realistic
 * 1200 px/s scroll. Memoised, a frame only renders the rows that just entered
 * the window.
 *
 * Every handler is a prop taking the part as an argument rather than a closure
 * over it — a closure would be a new function identity per render and would
 * defeat `memo` entirely, which is the usual reason this optimisation silently
 * does nothing. `t` is safe to pass because `LanguageProvider` returns it from
 * `useCallback`.
 */
const PartRow = memo(function PartRow({
  part,
  idx,
  search,
  t,
  onPreviewImage,
  onPreviewBarcode,
  onStockIn,
  onStockOut,
  onSetStock,
  onEdit,
  onDelete,
  onPrint,
  isRibbonMode,
  isSelected,
  onToggleSelect,
  isColVisible,
}: {
  part: SparePartItem;
  idx: number;
  search: string;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
  onPreviewImage: (part: SparePartItem) => void;
  onPreviewBarcode: (part: SparePartItem) => void;
  onStockIn: (part: SparePartItem) => void;
  onStockOut: (part: SparePartItem) => void;
  onSetStock: (part: SparePartItem) => void;
  onEdit: (part: SparePartItem) => void;
  onDelete: (part: SparePartItem) => void;
  onPrint: (part: SparePartItem) => void;
  isRibbonMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (part: SparePartItem) => void;
  isColVisible?: (key: string) => boolean;
}) {
  const image  = part.pictureUrl;
  const name   = part.itemName ?? "N/A";
  const partNo = part.serialNumber ?? part.partNumber ?? `SP-${idx + 100}`;
  const useFor = part.useFor ?? part.description ?? "N/A";
  const qty    = part.quantity ?? 0;
  const price  = part.defaultPrice ?? 0;

  const band = stockBand(qty);

  return (
    <tr
      key={part.id || idx}
      onClick={() => onToggleSelect?.(part)}
      onDoubleClick={() => onEdit(part)}
      className={cn(
        "transition-colors cursor-pointer border-b border-subtle/60",
        isSelected ? "bg-accent-soft/30 ring-1 ring-accent/30" : "hover:bg-cushion/80"
      )}
    >
      {/* Ribbon Checkbox Selection Column */}
      {isRibbonMode && (
        <td className="py-2 px-2 text-center w-10 min-w-[40px]" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect?.(part)}
            className="w-4 h-4 rounded text-accent focus:ring-accent border-subtle cursor-pointer accent-accent transition-transform hover:scale-105"
            aria-label="Select row"
          />
        </td>
      )}

      {/* Image Column */}
      {(!isColVisible || isColVisible("image")) && (
        <td className="py-2 px-2.5 sm:px-3 text-center" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onPreviewImage(part)}
            aria-label={`${t("sp.viewImage")} — ${name}`}
            className="group w-11 h-11 sm:w-12 sm:h-12 mx-auto rounded-lg border border-subtle bg-cushion flex items-center justify-center overflow-hidden shadow-2xs transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring cursor-pointer"
          >
            {image ? (
              <img
                src={getImageUrl(image)}
                alt={name}
                width={48}
                height={48}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-110"
              />
            ) : (
              <Box className="w-5 h-5 text-ink-muted" />
            )}
          </button>
        </td>
      )}

      {/* Item Name */}
      {(!isColVisible || isColVisible("itemName")) && (
        <td className="py-2 px-2.5 sm:px-3 font-semibold text-ink max-w-[170px] xl:max-w-[210px] truncate" title={name}>
          <HighlightText text={name} query={search} />
        </td>
      )}

      {/* Part Number */}
      {(!isColVisible || isColVisible("partNumber")) && (
        <td className="py-2 px-2.5 sm:px-3 whitespace-nowrap">
          <code className="px-1.5 py-0.5 rounded bg-sunken border border-subtle text-[11px] font-mono text-ink font-semibold">
            <HighlightText text={partNo} query={search} />
          </code>
        </td>
      )}

      {/* Use For */}
      {(!isColVisible || isColVisible("useFor")) && (
        <td className="py-2 px-2.5 sm:px-3 text-ink-secondary max-w-[140px] xl:max-w-[190px] truncate" title={useFor}>
          <HighlightText text={useFor} query={search} />
        </td>
      )}

      {/* Classification: brand chip over "Category › Type" */}
      {(!isColVisible || isColVisible("classification")) && (
        <td className="py-2 px-2.5 sm:px-3 max-w-[140px] xl:max-w-[180px]">
          {part.brandName || part.categoryName ? (
            <div className="flex flex-col gap-0.5 min-w-0">
              {part.brandName && (
                <span className="inline-flex items-center gap-1.5 max-w-full">
                  {part.brandLogoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(part.brandLogoUrl ?? undefined)}
                      alt=""
                      width={22}
                      height={22}
                      loading="lazy"
                      decoding="async"
                      className="w-5 h-5 object-contain shrink-0"
                    />
                  )}
                  <span className="text-xs font-bold text-ink tracking-wide truncate">
                    <HighlightText text={part.brandName} query={search} />
                  </span>
                </span>
              )}
              {part.categoryName && (
                <span className="text-[11px] text-ink-secondary truncate" title={`${part.categoryName}${part.typeName ? ` › ${part.typeName}` : ""}`}>
                  <HighlightText text={part.categoryName} query={search} />
                  {part.typeName && (
                    <>
                      {" › "}
                      <HighlightText text={part.typeName} query={search} />
                    </>
                  )}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-ink-muted">{t("sp.unclassified")}</span>
          )}
        </td>
      )}

      {/* Default Price */}
      {(!isColVisible || isColVisible("price")) && (
        <td className="py-2 px-2.5 sm:px-3 text-right font-mono font-semibold text-success whitespace-nowrap">
          ${Number(price).toFixed(2)}
        </td>
      )}

      {/* Quantity & Stock Level Bar (Clickable to Update Quantity) */}
      {(!isColVisible || isColVisible("quantity")) && (
        <td className="py-2 px-2.5 sm:px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onSetStock(part)}
            className="group/qty mx-auto flex flex-col items-center justify-center gap-0.5 min-w-[85px] px-1.5 py-0.5 rounded-xl hover:bg-cushion active:scale-95 transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            title={`${t("sp.stockLevel", { qty: String(qty) })} — Click to update`}
          >
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs font-extrabold text-ink tabular-nums group-hover/qty:text-accent transition-colors">
                {qty}
              </span>
              <Edit className="w-2.5 h-2.5 text-ink-muted opacity-0 group-hover/qty:opacity-100 group-hover/qty:text-accent transition-all shrink-0" />
            </div>
            <Badge tone={BAND_TONE[band]} dot>
              {t(BAND_LABEL[band])}
            </Badge>
            <ProgressBar
              value={(Math.min(qty, STOCK_BAR_FULL) / STOCK_BAR_FULL) * 100}
              tone={BAND_TONE[band]}
              className="w-14 mt-0.5"
            />
          </button>
        </td>
      )}

      {/* Barcode Graphic */}
      {(!isColVisible || isColVisible("barcode")) && (
        <td className="py-2 px-2 sm:px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onPreviewBarcode(part)}
            aria-label={`${t("sp.viewBarcode")} — ${partNo}`}
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-[#FFFFFF] border border-subtle shadow-2xs transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring cursor-pointer"
          >
            <BarcodeSvg value={partNo} />
          </button>
        </td>
      )}

      {/* Set Stock (Stock In) */}
      {(!isColVisible || isColVisible("stockIn")) && (
        <td className="py-2 px-2 sm:px-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onStockIn(part)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-success-soft hover:text-success-fg hover:border-success transition-colors shadow-2xs cursor-pointer"
          >
            <PackageCheck className="w-3.5 h-3.5 text-success" />
            <span>{t("action.stockIn")}</span>
          </button>
        </td>
      )}

      {/* Stock Out */}
      {(!isColVisible || isColVisible("stockOut")) && (
        <td className="py-2 px-2 sm:px-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={qty <= 0}
            onClick={() => onStockOut(part)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-danger bg-surface border border-danger rounded-xl hover:bg-danger-soft hover:border-danger transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <MinusCircle className="w-3.5 h-3.5" />
            <span>{t("action.stockOut")}</span>
          </button>
        </td>
      )}

      {/* Edit / Delete / Print Actions */}
      {(!isColVisible || isColVisible("actions")) && (
        <td className="py-2 px-2 sm:px-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1.5">
            {isRibbonMode ? (
              <button
                type="button"
                onClick={() => onPrint(part)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-accent hover:bg-accent-soft border border-accent/30 transition-colors shadow-2xs cursor-pointer"
                title={t("crud.print")}
                aria-label={`${t("crud.print")} — ${name}`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t("crud.print")}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(part)}
                  className="grid place-items-center w-7 h-7 rounded-full text-ink-secondary transition-colors hover:bg-accent-soft hover:text-accent-soft-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring cursor-pointer"
                  title={t("sp.edit")}
                  aria-label={`${t("sp.edit")} — ${name}`}
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(part)}
                  className="grid place-items-center w-7 h-7 rounded-full text-ink-secondary transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring cursor-pointer"
                  title={t("sp.delete")}
                  aria-label={`${t("sp.delete")} — ${name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onPrint(part)}
                  className="grid place-items-center w-7 h-7 rounded-full text-ink-secondary transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring cursor-pointer"
                  title={t("crud.print")}
                  aria-label={`${t("crud.print")} — ${name}`}
                >
                  <Printer className="w-3.5 h-3.5 text-accent" />
                </button>
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
});

export default function SparePartsPage() {
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";
  const { prefs } = useTheme();
  const crudStyle = prefs.crudStyle || "enterprise-ribbon";
  const isRibbonMode = crudStyle === "enterprise-ribbon";
  const [checkedRow, setCheckedRow] = useState<SparePartItem | null>(null);

  const [columnsState, setColumnsState] = useState<ColumnDefinition[]>([
    { key: "image", label: t("field.image"), visible: true },
    { key: "itemName", label: t("field.itemName"), visible: true, permanent: true },
    { key: "partNumber", label: t("field.partNumber"), visible: true },
    { key: "useFor", label: t("field.useFor"), visible: true },
    { key: "classification", label: t("sp.classification"), visible: true },
    { key: "price", label: t("field.defaultPrice"), visible: true },
    { key: "quantity", label: t("field.quantity"), visible: true },
    { key: "barcode", label: t("field.barcode"), visible: true },
    { key: "stockIn", label: t("sp.setStock"), visible: true },
    { key: "stockOut", label: t("action.stockOut"), visible: true },
    { key: "actions", label: t("field.actions"), visible: true, permanent: true },
  ]);

  useEffect(() => {
    setColumnsState((prev) =>
      prev.map((c) => {
        if (c.key === "image") return { ...c, label: t("field.image") };
        if (c.key === "itemName") return { ...c, label: t("field.itemName") };
        if (c.key === "partNumber") return { ...c, label: t("field.partNumber") };
        if (c.key === "useFor") return { ...c, label: t("field.useFor") };
        if (c.key === "classification") return { ...c, label: t("sp.classification") };
        if (c.key === "price") return { ...c, label: t("field.defaultPrice") };
        if (c.key === "quantity") return { ...c, label: t("field.quantity") };
        if (c.key === "barcode") return { ...c, label: t("field.barcode") };
        if (c.key === "stockIn") return { ...c, label: t("sp.setStock") };
        if (c.key === "stockOut") return { ...c, label: t("action.stockOut") };
        if (c.key === "actions") return { ...c, label: t("field.actions") };
        return c;
      })
    );
  }, [t]);

  const isColVisible = useCallback(
    (colKey: string) => columnsState.find((c) => c.key === colKey)?.visible ?? true,
    [columnsState]
  );

  const handleToggleColumn = useCallback((colKey: string) => {
    setColumnsState((prev) =>
      prev.map((col) => (col.key === colKey && !col.permanent ? { ...col, visible: !col.visible } : col))
    );
  }, []);

  const handleResetColumns = useCallback(() => {
    setColumnsState((prev) => prev.map((col) => ({ ...col, visible: true })));
  }, []);

  const handlePrintPart = useCallback((part?: SparePartItem | null) => {
    const target = part || checkedRow;
    if (!target) {
      toast(
        lang === "km"
          ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងដើម្បីបោះពុម្ព (Print)"
          : "Please select a spare part in the table first",
        { icon: "ℹ️" }
      );
      return;
    }
    window.print();
  }, [checkedRow, lang]);

  const [search, setSearch] = useState("");
  const pageSize = 25;

  const { openPairingModal } = useCompanionScanner();

  // Modal states
  const [activeModal, setActiveModal] = useState<"stockIn" | "stockOut" | "setStock" | "edit" | "delete" | null>(null);
  const [selectedPart, setSelectedPart] = useState<SparePartItem | null>(null);
  const [quantityInput, setQuantityInput] = useState(1);
  const [reasonInput, setReasonInput] = useState("");

  // Listen to global Companion Barcode Scanner events to filter spare parts catalogue
  useEffect(() => {
    const handleCompanionScan = (e: Event) => {
      const customEvent = e as CustomEvent<{ barcode?: string }>;
      if (customEvent?.detail?.barcode) {
        setSearch(customEvent.detail.barcode);
      }
    };
    window.addEventListener("companion-barcode-scanned", handleCompanionScan);
    return () => window.removeEventListener("companion-barcode-scanned", handleCompanionScan);
  }, []);

  /** Which thumbnail is open full-size, if any. */
  const [lightbox, setLightbox] = useState<
    { kind: "image" | "barcode"; part: SparePartItem } | null
  >(null);

  /**
   * Stock-band filter chips.
   *
   * **Filters the LOADED rows, not the catalogue.** The backend's parts
   * endpoint takes a `searchTerm` and nothing else — there is no stock-status
   * parameter to send — and the table loads 25 at a time by infinite scroll.
   * So this narrows what is on screen, and scrolling keeps feeding it more.
   *
   * That distinction is not a detail to leave implicit: a chip that reads
   * "Out of stock — 3" when the catalogue holds forty would be actively
   * misleading to someone ordering parts. The footer says "N of M loaded"
   * whenever a chip is active, so the number on screen is never mistaken for
   * the number that exists. A truthful count needs a server-side filter.
   */
  const [band, setBand] = useState<StockBand | "all">("all");

  /**
   * Category / Type / Brand filters — server-side, unlike the stock-band
   * chips: the API narrows the catalogue and the counts it returns are true
   * for the filtered set. Kept in the URL so a filtered view can be shared.
   */
  const [rawFilters, setFilters] = useState<SparePartFilters>({});
  const taxonomy = useSparePartTaxonomyOptions();
  // An id the lookups no longer know (deleted category, a shared link's
  // type outside its category) is dropped rather than sent to the API as a
  // filter that can only ever yield an empty list.
  const filters = taxonomy.pruneFilters(rawFilters);
  useSparePartFilterParams(filters, setFilters);
  const filterKey = `${filters.categoryId ?? ""}:${filters.typeId ?? ""}:${filters.brandId ?? ""}`;
  const [bandCounts, setBandCounts] = useState<{
    total: number;
    good: number;
    critical: number;
    out: number;
  }>({ total: 0, good: 0, critical: 0, out: 0 });

  // Table header column filters & sorting
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    hasImage: "all",
  });
  const [columnSort, setColumnSort] = useState<ColumnSort>({
    column: null,
    direction: null,
  });

  const hasActiveColumnFilters = useMemo(() => {
    return Boolean(
      search.trim() ||
      columnFilters.itemName ||
      columnFilters.partNumber ||
      columnFilters.useFor ||
      (columnFilters.hasImage && columnFilters.hasImage !== "all") ||
      columnFilters.minPrice != null ||
      columnFilters.maxPrice != null ||
      columnFilters.unclassifiedOnly ||
      filters.categoryId ||
      filters.typeId ||
      filters.brandId ||
      (columnSort.column && columnSort.direction)
    );
  }, [search, columnFilters, columnSort, filters]);

  const handleClearAllColumnFilters = useCallback(() => {
    setColumnFilters({ hasImage: "all" });
    setSearch("");
    setFilters({});
    setColumnSort({ column: null, direction: null });
  }, []);

  // Edit / Add Form State
  const [formState, setFormState] = useState<Partial<SparePartItem>>({
    itemName: "",
    serialNumber: "",
    description: "",
    useFor: "",
    pictureUrl: "",
    quantity: 0,
    defaultPrice: 0,
  });

  // Image upload — R2 via the shared `services/upload.ts` utility. The
  // "Picture URL" text field stays alongside this rather than being replaced
  // by it, so existing parts (and anyone who'd rather paste a URL) keep
  // working exactly as before.
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const handleImageFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allows re-selecting the same file after an error
      if (!file) return;

      setIsUploadingImage(true);
      try {
        const url = await uploadImage(file);
        setFormState((prev) => ({ ...prev, pictureUrl: url }));
      } catch (err) {
        const reason = err instanceof UploadError ? err.reason : "uploadFailed";
        toast.error(t(uploadErrorTranslationKey(reason)));
      } finally {
        setIsUploadingImage(false);
      }
    },
    [t]
  );


  /**
   * Row handlers, hoisted and stable.
   *
   * Each takes the part as an argument rather than closing over it, so the
   * identity never changes and `PartRow`'s `memo` actually holds. Passing an
   * inline arrow here instead would give every row a new prop on every scroll
   * frame and silently undo the memoisation.
   */
  const handlePreviewImage = useCallback((part: SparePartItem) => {
    setLightbox({ kind: "image", part });
  }, []);

  const handlePreviewBarcode = useCallback((part: SparePartItem) => {
    setLightbox({ kind: "barcode", part });
  }, []);

  const handleStockIn = useCallback((part: SparePartItem) => {
    setSelectedPart(part);
    setQuantityInput(1);
    setActiveModal("stockIn");
  }, []);

  const handleStockOut = useCallback((part: SparePartItem) => {
    setSelectedPart(part);
    setQuantityInput(1);
    setActiveModal("stockOut");
  }, []);

  const handleSetStock = useCallback((part: SparePartItem) => {
    setSelectedPart(part);
    setQuantityInput(part.quantity ?? 0);
    setReasonInput(`Direct quantity edit: ${part.itemName || ""}`.trim());
    setActiveModal("setStock");
  }, []);

  const handleEditPart = useCallback((part: SparePartItem) => {
    setSelectedPart(part);
    setFormState({
      ...part,
      itemName:     part.itemName,
      serialNumber: part.serialNumber ?? part.partNumber,
      useFor:       part.useFor,
      defaultPrice: part.defaultPrice,
      pictureUrl:   part.pictureUrl,
    });
    setActiveModal("edit");
  }, []);

  const handleDeletePart = useCallback((part: SparePartItem) => {
    setSelectedPart(part);
    setActiveModal("delete");
  }, []);

  // Seed from ?q= when arriving via the header's global search.
  useSearchQueryParam(setSearch);

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedPartNumber = useDebouncedValue(columnFilters.partNumber || "", 300);

  const term = useMemo(() => {
    const s = debouncedSearch.trim();
    const p = debouncedPartNumber.trim();
    if (s && p) return `${s} ${p}`.trim();
    return s || p;
  }, [debouncedSearch, debouncedPartNumber]);

  const sortByParam = columnSort.column === "itemName"
    ? "itemname"
    : columnSort.column === "partNumber"
    ? "serialnumber"
    : columnSort.column === "quantity"
    ? "quantity"
    : null;
  const sortDescParam = columnSort.direction === "desc";

  /**
   * Which list the counts on screen belong to. `useInfiniteList` drops a
   * stale page's ROWS by sequence number, but `setBandCounts` runs inside
   * `fetchPage` before that check — so a response for a previous filter
   * (a deep link fires the unfiltered request one render before the URL
   * seeds the filters) could leave the chips describing a different list
   * than the one shown. The key is updated in an effect declared BEFORE
   * the list hook, so it is current by the time the hook's reset fetches.
   */
  const listKey = `${term}:${band}:${filterKey}:${sortByParam ?? ""}:${sortDescParam}`;
  const listKeyRef = useRef(listKey);
  useEffect(() => {
    listKeyRef.current = listKey;
  }, [listKey]);

  const {
    items,
    totalCount,
    isLoading,
    isLoadingMore,
    reachedEnd,
    limitReached,
    scrollRootRef,
    scrollRoot,
    sentinelRef,
    refresh: loadData,
    setItems,
  } = useInfiniteList<SparePartItem, HTMLDivElement, HTMLTableRowElement>({
    fetchPage: async (pageNumber, size) => {
      const keyAtCall = listKeyRef.current;
      const res = await fetchSparePartsInventory(
        pageNumber,
        size,
        term,
        band,
        filters,
        sortByParam,
        sortDescParam
      );
      // Counts only from the list that is still current — see `listKeyRef`.
      if (res.goodCount !== undefined && keyAtCall === listKeyRef.current) {
        setBandCounts({
          total: res.totalAll ?? res.totalCount,
          good: res.goodCount ?? 0,
          critical: res.criticalCount ?? 0,
          out: res.outOfStockCount ?? 0,
        });
      }
      return res;
    },
    pageSize,
    resetKey: `spareparts:${listKey}`,
    getId: (p) => p?.id,
  });

  // Distinct Item Names present in current table data
  const visibleItems = useMemo(() => {
    let list = items;

    // Filter by global search term across all visible attributes (itemName, partNumber, useFor, description, brandName, categoryName, typeName)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) =>
        (p.itemName || "").toLowerCase().includes(q) ||
        (p.serialNumber || p.partNumber || "").toLowerCase().includes(q) ||
        (p.useFor || p.description || "").toLowerCase().includes(q) ||
        (p.brandName || "").toLowerCase().includes(q) ||
        (p.categoryName || "").toLowerCase().includes(q) ||
        (p.typeName || "").toLowerCase().includes(q)
      );
    }

    // Filter by item name (specific column filter)
    if (columnFilters.itemName?.trim()) {
      const q = columnFilters.itemName.trim().toLowerCase();
      list = list.filter((p) => (p.itemName || "").toLowerCase().includes(q));
    }

    // Filter by part number
    if (columnFilters.partNumber?.trim()) {
      const q = columnFilters.partNumber.trim().toLowerCase();
      list = list.filter((p) =>
        (p.serialNumber || p.partNumber || "").toLowerCase().includes(q)
      );
    }

    // Filter by use for
    if (columnFilters.useFor?.trim()) {
      const q = columnFilters.useFor.trim().toLowerCase();
      list = list.filter((p) => (p.useFor || p.description || "").toLowerCase().includes(q));
    }

    // Filter by image presence
    if (columnFilters.hasImage === "yes") {
      list = list.filter((p) => Boolean(p.pictureUrl));
    } else if (columnFilters.hasImage === "no") {
      list = list.filter((p) => !p.pictureUrl);
    }

    // Filter by price range
    if (columnFilters.minPrice != null && !isNaN(columnFilters.minPrice)) {
      list = list.filter((p) => (p.defaultPrice ?? 0) >= columnFilters.minPrice!);
    }
    if (columnFilters.maxPrice != null && !isNaN(columnFilters.maxPrice)) {
      list = list.filter((p) => (p.defaultPrice ?? 0) <= columnFilters.maxPrice!);
    }

    // Filter unclassified only
    if (columnFilters.unclassifiedOnly) {
      list = list.filter((p) => !p.brandName && !p.categoryName);
    }

    // Sort
    if (columnSort.column && columnSort.direction) {
      const dir = columnSort.direction === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        if (columnSort.column === "itemName") {
          return (a.itemName || "").localeCompare(b.itemName || "") * dir;
        }
        if (columnSort.column === "partNumber") {
          const aNo = a.serialNumber || a.partNumber || "";
          const bNo = b.serialNumber || b.partNumber || "";
          return aNo.localeCompare(bNo) * dir;
        }
        if (columnSort.column === "price") {
          return ((a.defaultPrice ?? 0) - (b.defaultPrice ?? 0)) * dir;
        }
        if (columnSort.column === "quantity") {
          return ((a.quantity ?? 0) - (b.quantity ?? 0)) * dir;
        }
        return 0;
      });
    }

    return list;
  }, [items, columnFilters, columnSort]);

  const handleExportCSV = useCallback(() => {
    const exportData = visibleItems.length > 0 ? visibleItems : items;
    if (exportData.length === 0) {
      toast.error(isKhmer ? "មិនមានទិន្នន័យសម្រាប់ទាញយកទេ" : "No data to export");
      return;
    }
    const headers = [
      "Item Name",
      "Part Number",
      "Use For",
      "Category",
      "Type",
      "Brand",
      "Price",
      "Quantity",
    ];
    const rows = exportData.map((p) => [
      `"${(p.itemName || "").replace(/"/g, '""')}"`,
      `"${(p.serialNumber || p.partNumber || "").replace(/"/g, '""')}"`,
      `"${(p.useFor || p.description || "").replace(/"/g, '""')}"`,
      `"${(p.categoryName || "").replace(/"/g, '""')}"`,
      `"${(p.typeName || "").replace(/"/g, '""')}"`,
      `"${(p.brandName || "").replace(/"/g, '""')}"`,
      `"${(p.defaultPrice ?? 0).toFixed(2)}"`,
      `"${p.quantity ?? 0}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `spareparts-inventory-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(isKhmer ? "បានទាញយក CSV ដោយជោគជ័យ" : "CSV exported successfully");
  }, [visibleItems, items, isKhmer]);

  /**
   * Only the rows on screen are rendered. See `hooks/useVirtualRows.ts` for the
   * measurements that motivated this and why the spacer-row approach is the one
   * that works inside a `<table>`.
   *
   * `SPAREPART_ROW_HEIGHT` is verified, not assumed: 225 sampled rows measured
   * 96px each, min and max identical. Every cell in this row is a fixed-height
   * control — 56px thumbnail, badge, progress bar — and the two text columns
   * are `truncate`, so nothing here wraps to a second line. If a wrapping cell
   * is ever added, this stops being true and the hook needs dynamic measurement
   * rather than a bigger constant.
   */
  const rowWindow = useVirtualRows({
    count: visibleItems.length,
    scrollElement: scrollRoot,
    rowHeight: SPAREPART_ROW_HEIGHT,
    // Nothing to window while the skeleton is up, and the container has no
    // scroll height yet at that point.
    disabled: isLoading,
  });

  /**
   * The rows to render this frame, carrying their real index in `visibleItems`.
   *
   * The index is kept because the row body uses it for the fallback part
   * number (`SP-${idx + 100}`) — reading it from the window position instead
   * would renumber parts as the user scrolls.
   */
  const renderRows = rowWindow.enabled
    ? rowWindow.items.map(({ index }) => ({ part: visibleItems[index], idx: index }))
    : visibleItems.map((part, idx) => ({ part, idx }));

  // Live updates so another user's add/edit/delete (or a stock-out / inspection) shows up
  // here without a manual reload.
  const handleRealtimeUpdate = useCallback(() => {
    invalidateCachePrefix("spareparts");
    clearListCache();
    void loadData();
  }, [loadData]);

  useRealtimeResource("sparepart", handleRealtimeUpdate);

  // Instant refresh when user returns to this tab
  useEffect(() => {
    const onTabActive = () => {
      invalidateCachePrefix("spareparts");
      clearListCache();
      void loadData();
    };
    window.addEventListener("focus", onTabActive);
    const onVis = () => {
      if (document.visibilityState === "visible") onTabActive();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onTabActive);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadData]);

  // ── Actions requested from elsewhere (the AI assistant today) ────────────
  //
  // Each one opens the same dialog its row button opens — the quantity, the
  // reason and the confirm click all stay with the user, so no stock moves
  // without them. Requests that name a part are retried as rows load, keyed on
  // `items.length`.
  const findPart = useCallback(
    (ref?: string): SparePartItem | null => {
      if (!ref) return null;
      const needle = ref.trim().toLowerCase();
      const match = (value?: string | null) => value?.trim().toLowerCase() === needle;
      return (
        items.find((p) => match(p.itemName)) ??
        items.find((p) => match(p.serialNumber) || match(p.partNumber)) ??
        // Last resort: a partial name, since people rarely type a part in full.
        items.find((p) => p.itemName?.toLowerCase().includes(needle)) ??
        null
      );
    },
    [items]
  );

  const openPartModal = useCallback(
    (modal: "stockIn" | "stockOut" | "delete") =>
      (ref?: string, values?: ActionValues): boolean => {
        const part = findPart(ref);
        if (!part) return false;
        setSelectedPart(part);
        // A quantity the user asked for is typed into the box; anything that
        // isn't a positive number falls back to 1 rather than leaving the
        // dialog holding NaN.
        const qty = Number(values?.quantity);
        setQuantityInput(Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1);
        setReasonInput(values?.reason ?? "");
        setActiveModal(modal);
        return true;
      },
    [findPart]
  );

  useActionHandler("sparePart.stockIn", openPartModal("stockIn"), items.length);
  useActionHandler("sparePart.stockOut", openPartModal("stockOut"), items.length);
  useActionHandler("sparePart.delete", openPartModal("delete"), items.length);

  /** The catalogue form's fields, parsed out of the assistant's string values. */
  const partFormPatch = (values?: ActionValues): Partial<SparePartItem> => {
    if (!values) return {};
    const patch: Partial<SparePartItem> = {};
    if (values.itemName?.trim()) patch.itemName = values.itemName.trim();
    if (values.serialNumber?.trim()) patch.serialNumber = values.serialNumber.trim();
    if (values.useFor?.trim()) patch.useFor = values.useFor.trim();
    if (values.description?.trim()) patch.description = values.description.trim();
    const qty = Number(values.quantity);
    if (Number.isFinite(qty) && qty >= 0) patch.quantity = Math.floor(qty);
    const price = Number(values.defaultPrice);
    if (Number.isFinite(price) && price >= 0) patch.defaultPrice = price;
    return patch;
  };

  useActionHandler(
    "sparePart.edit",
    (ref, values) => {
      const part = findPart(ref);
      if (!part) return false;
      setSelectedPart(part);
      setFormState({
        ...part,
        serialNumber: part.serialNumber ?? part.partNumber,
        // Last, so a field the user asked to change wins over the stored one
        // while every field they didn't mention keeps its current value.
        ...partFormPatch(values),
      });
      setActiveModal("edit");
      return true;
    },
    items.length
  );

  // Page-level: nothing to look up, so it can always be satisfied.
  useActionHandler("sparePart.create", (_ref, values) => {
    setSelectedPart(null);
    setFormState({
      itemName: "",
      serialNumber: "",
      description: "",
      useFor: "",
      pictureUrl: "",
      quantity: 1,
      defaultPrice: 0.0,
      ...partFormPatch(values),
    });
    setActiveModal("edit");
    return true;
  });

  useSearchAction(setSearch);

  // Closes whatever this page currently has open — the same thing Cancel or X
  // does, discarding anything typed. Always reports success: the request is
  // "leave nothing open", and that is true afterwards whether or not a dialog
  // happened to be showing.
  useActionHandler("ui.dialog.close", () => {
    setActiveModal(null);
    return true;
  });

  useActionHandler("ui.refresh", () => {
    invalidateCachePrefix("spareparts");
    void loadData();
    return true;
  });

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    // One rule, both platforms: `@/validation` is mirrored into the CamID app,
    // which was already refusing a part with no serial number and a negative
    // price while this screen accepted both and wrote them to the same rows.
    const check = validateSparePart({
      itemName: formState.itemName,
      serialNumber: formState.serialNumber ?? formState.partNumber,
      quantity: formState.quantity ?? 0,
      defaultPrice: formState.defaultPrice ?? 0,
      categoryId: formState.categoryId,
      typeId: formState.typeId,
    });
    if (!check.isValid) {
      toast.error(firstValidationMessage(check, t));
      return;
    }

    const userId = getCurrentUserGuid() || "00000000-0000-0000-0000-000000000000";

    // This form owns the classification, so it is always sent — an empty
    // select clears the field. Stock In / Set Stock go through
    // `updateSparePart` WITHOUT it and leave the filing untouched.
    const classification: SparePartClassification = {
      categoryId: formState.categoryId ?? null,
      typeId: formState.typeId ?? null,
      brandId: formState.brandId ?? null,
    };

    const result = formState.id
      ? await updateSparePart(formState as SparePartItem, userId, classification)
      : await createSparePart(formState as SparePartItem, classification);

    if (result.ok) {
      toast.success(isKhmer ? "រក្សាទុកគ្រឿងបន្លាស់បានជោគជ័យ" : "Spare part saved successfully");
      invalidateCachePrefix("spareparts");
      clearListCache();
      void loadData();
      setActiveModal(null);
    } else if (result.code === "network") {
      // Offline: keep the edit on screen so the work is not lost; the row
      // reconciles with the server on the next successful load.
      setItems((prev) =>
        formState.id
          ? prev.map((p) => (p.id === formState.id ? { ...p, ...formState } : p))
          : [...prev, { ...formState, id: "temp-" + Date.now() } as SparePartItem]
      );
      setActiveModal(null);
    } else {
      // The server refused (400 validation, 409 duplicate / constraint) —
      // say why and leave the dialog open for the correction.
      toast.error(t("sp.saveFailed", { detail: result.detail ?? "" }).trim());
    }
  };

  const handleDelete = async () => {
    if (!selectedPart?.id) return;
    const result = await deleteSparePart(selectedPart.id);
    if (result.ok) {
      toast.success(isKhmer ? "លុបគ្រឿងបន្លាស់បានជោគជ័យ" : "Spare part deleted successfully");
      invalidateCachePrefix("spareparts");
      clearListCache();
      void loadData();
    } else if (result.code === "inUse") {
      // The API refuses while the part is on a ticket line or has stock
      // history (the audit ledger's FK). Removing the row locally would
      // pretend it worked; say why instead.
      const name = selectedPart.itemName || selectedPart.serialNumber || "";
      toast.error(
        result.count !== undefined
          ? t("sp.deleteInUse", { name, count: result.count })
          : t("sp.deleteHasHistory", { name })
      );
    } else if (result.code === "network") {
      // Offline: optimistic delete, reconciled on the next load.
      setItems((prev) => prev.filter((p) => p.id !== selectedPart.id));
    } else {
      toast.error(t("sp.saveFailed", { detail: result.detail ?? "" }).trim());
    }
    setActiveModal(null);
  };

  const handleStockInSubmit = async () => {
    if (!selectedPart) return;
    const check = validateStockIn({ quantity: quantityInput });
    if (!check.isValid) {
      toast.error(firstValidationMessage(check, t));
      return;
    }

    const currentQty = selectedPart.quantity ?? 0;
    const newQty = currentQty + quantityInput;
    const updatedPart: SparePartItem = {
      ...selectedPart,
      quantity: newQty,
    };

    const userGuid = getCurrentUserGuid() || "00000000-0000-0000-0000-000000000000";
    const userName = getCurrentUserFullName();

    // Optimistic UI update
    setItems((prev) => prev.map((p) => (p.id === selectedPart.id ? updatedPart : p)));
    setActiveModal(null);

    const result = await updateSparePart(updatedPart, userGuid);
    if (result.ok) {
      toast.success(isKhmer ? `បានបញ្ចូលស្តុក +${quantityInput} ជោគជ័យ` : `Stock In +${quantityInput} recorded successfully`);
      invalidateCachePrefix("spareparts");
      clearListCache();
      void loadData();

      // 📨 Telegram Notification Topic 14 (Stock In)
      try {
        const msg = buildStockTelegramMessage("StockIn", {
          id: selectedPart.id,
          itemName: selectedPart.itemName || "Unknown Part",
          partNumber: selectedPart.serialNumber || selectedPart.partNumber || "N/A",
          useFor: selectedPart.useFor,
          quantity: quantityInput,
          oldQuantity: currentQty,
          newQuantity: newQty,
          performedBy: userName,
          remarks: `Stock In: +${quantityInput} ${selectedPart.itemName || ""}`.trim(),
        });
        void sendTelegramNotification("StockIn", msg);
      } catch (tgErr) {
        console.warn("StockIn telegram notification failed:", tgErr);
      }
    } else {
      toast.error("Failed to record stock in");
      void loadData();
    }
  };

  const handleStockOutSubmit = async () => {
    if (!selectedPart) return;

    // The row on screen comes from a cached list page, so its quantity can be
    // minutes old. Refusing a stock-out against that would block a legitimate
    // one the moment a colleague stocked in — so the ceiling is checked against
    // a live read, the same way the ticket transition pre-flight does it. A
    // failed read falls back to what is on screen rather than blocking.
    let currentQty = selectedPart.quantity ?? 0;
    try {
      const fresh = await fetchSparePartById(selectedPart.id, true);
      if (fresh && Number.isFinite(fresh.quantity)) currentQty = fresh.quantity ?? currentQty;
    } catch {
      // Keep the on-screen figure; the backend still refuses a real shortage.
    }

    const check = validateStockOut({
      quantity: quantityInput,
      available: currentQty,
      reason: reasonInput,
    });
    if (!check.isValid) {
      toast.error(firstValidationMessage(check, t));
      return;
    }

    const newQty = Math.max(0, currentQty - quantityInput);
    const updatedPart: SparePartItem = {
      ...selectedPart,
      quantity: newQty,
    };

    const userGuid = getCurrentUserGuid() || "00000000-0000-0000-0000-000000000000";
    const userName = getCurrentUserFullName();

    // Optimistic UI update
    setItems((prev) => prev.map((p) => (p.id === selectedPart.id ? updatedPart : p)));
    setActiveModal(null);

    const success = await insertManualStockOut(selectedPart.id, quantityInput, reasonInput.trim(), userGuid);
    if (success) {
      toast.success(isKhmer ? `បានដកស្តុក -${quantityInput} ជោគជ័យ` : `Stock Out -${quantityInput} recorded successfully`);
      invalidateCachePrefix("spareparts");
      clearListCache();
      void loadData();

      // 📨 Telegram Notification Topic 12 (Stock Out)
      try {
        const msg = buildStockTelegramMessage("StockOut", {
          id: selectedPart.id,
          itemName: selectedPart.itemName || "Unknown Part",
          partNumber: selectedPart.serialNumber || selectedPart.partNumber || "N/A",
          useFor: selectedPart.useFor,
          quantity: quantityInput,
          oldQuantity: currentQty,
          newQuantity: newQty,
          performedBy: userName,
          remarks: reasonInput.trim(),
        });
        void sendTelegramNotification("StockOut", msg);
      } catch (tgErr) {
        console.warn("StockOut telegram notification failed:", tgErr);
      }
    } else {
      toast.error("Failed to record stock out");
      void loadData();
    }
  };

  const handleSetStockSubmit = async () => {
    if (!selectedPart) return;
    const oldQty = selectedPart.quantity ?? 0;
    const newQty = Math.max(0, quantityInput);
    if (oldQty === newQty) {
      setActiveModal(null);
      return;
    }

    const updatedPart: SparePartItem = {
      ...selectedPart,
      quantity: newQty,
    };

    const userGuid = getCurrentUserGuid() || "00000000-0000-0000-0000-000000000000";
    const userName = getCurrentUserFullName();

    // Optimistic UI update
    setItems((prev) => prev.map((p) => (p.id === selectedPart.id ? updatedPart : p)));
    setActiveModal(null);

    const result = await updateSparePart(updatedPart, userGuid);
    if (result.ok) {
      toast.success(
        isKhmer
          ? `បានកែប្រែចំនួនស្តុកជោគជ័យ៖ ${oldQty} → ${newQty}`
          : `Stock quantity updated: ${oldQty} → ${newQty}`
      );
      invalidateCachePrefix("spareparts");
      clearListCache();
      void loadData();

      // 📨 Telegram Notification
      try {
        const isIncrease = newQty > oldQty;
        const delta = Math.abs(newQty - oldQty);
        const topicType = isIncrease ? "StockIn" : "StockOut";
        const remarksText = reasonInput?.trim() || `Direct quantity edit: ${selectedPart.itemName || ""}`.trim();
        const msg = buildStockTelegramMessage(topicType, {
          id: selectedPart.id,
          itemName: selectedPart.itemName || "Unknown Part",
          partNumber: selectedPart.serialNumber || selectedPart.partNumber || "N/A",
          useFor: selectedPart.useFor,
          quantity: delta,
          oldQuantity: oldQty,
          newQuantity: newQty,
          performedBy: userName,
          remarks: remarksText,
        });
        void sendTelegramNotification(topicType, msg);
      } catch (tgErr) {
        console.warn("SetStock telegram notification failed:", tgErr);
      }
    } else {
      toast.error("Failed to update stock quantity");
      void loadData();
    }
  };

  return (
    <PageWrapper
      titleKey="nav.sparePartInventory"
      subtitleKey="sub.spareParts"
    >
      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-subtle/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Unified Table Toolbar */}
        {crudStyle === "enterprise-ribbon" ? (
          <div className="flex flex-col border-b border-subtle">
            <EnterpriseRibbonToolbar
              canCreate={true}
              canEdit={true}
              canDelete={false}
              canPrint={true}
              onCreate={() => {
                setSelectedPart(null);
                setFormState({
                  itemName: "",
                  serialNumber: "",
                  description: "",
                  useFor: "",
                  pictureUrl: "",
                  quantity: 1,
                  defaultPrice: 0.0,
                });
                setActiveModal("edit");
              }}
              onEdit={() => {
                if (checkedRow) {
                  handleEditPart(checkedRow);
                } else {
                  toast(
                    lang === "km"
                      ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងជាមុនសិន"
                      : "Please select a record in the table first",
                    { icon: "ℹ️" }
                  );
                }
              }}
              onDelete={() => {
                if (checkedRow) {
                  handleDeletePart(checkedRow);
                } else {
                  toast(
                    lang === "km"
                      ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងដើម្បីលុប"
                      : "Please select a record to delete",
                    { icon: "ℹ️" }
                  );
                }
              }}
              onPrint={() => handlePrintPart(checkedRow)}
              onExportCsv={handleExportCSV}
              onReload={loadData}
              searchTerm={search}
              searchPlaceholder={t("sp.searchPlaceholder")}
              onSearchChange={(val) => {
                setSearch(val);
              }}
              onSearchSubmit={loadData}
              onSearchClear={() => {
                setSearch("");
              }}
              selectedCount={checkedRow ? 1 : 0}
              isLoading={isLoading}
              extraActions={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={openPairingModal}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-all shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
                    title="Scan Barcode with Phone"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Phone Scan</span>
                  </button>
                  <ColumnVisibilityDropdown
                    columns={columnsState}
                    onToggleColumn={handleToggleColumn}
                    onResetColumns={handleResetColumns}
                  />
                </div>
              }
            />

            {/* Classification Filters & Stock Band Chips */}
            <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 border-t border-subtle flex flex-wrap items-center justify-between gap-2 bg-cushion/40">
              <SparePartFilterBar
                value={filters}
                onChange={setFilters}
                categoryOptions={taxonomy.categoryOptions}
                brandOptions={taxonomy.brandOptions}
                typeOptionsFor={taxonomy.typeOptionsFor}
                loading={taxonomy.loading}
                error={taxonomy.error}
                onRetry={taxonomy.retry}
              />

              {/* Stock-band chips */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                {(["all", "good", "critical", "out"] as const).map((key) => {
                  const active = band === key;
                  const count =
                    key === "all"
                      ? (bandCounts.total || totalCount)
                      : key === "good"
                      ? bandCounts.good
                      : key === "critical"
                      ? bandCounts.critical
                      : bandCounts.out;

                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setBand(key)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] font-semibold",
                        "border transition-colors cursor-pointer",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                        active
                          ? "bg-accent-soft text-accent-soft-fg border-accent/40"
                          : "bg-surface text-ink-secondary border-subtle hover:bg-cushion hover:text-ink"
                      )}
                    >
                      {key !== "all" && (
                        <span
                          aria-hidden
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            key === "good" ? "bg-success" : key === "critical" ? "bg-warning" : "bg-danger"
                          )}
                        />
                      )}
                      <span>{key === "all" ? t("sp.filterAll") : t(BAND_LABEL[key])}</span>
                      <span className="tabular-nums opacity-70">{count}</span>
                    </button>
                  );
                })}
                {hasActiveColumnFilters && (
                  <button
                    type="button"
                    onClick={handleClearAllColumnFilters}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 transition-colors cursor-pointer select-none ml-auto"
                    title={t("sp.colFilter.clearAll")}
                  >
                    <X className="w-3 h-3" />
                    <span>{t("sp.colFilter.clearAll")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2.5 sm:p-3 xl:p-3.5 shrink-0 border-b border-subtle flex flex-wrap items-center justify-between gap-2 sm:gap-2.5 bg-cushion/50">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  placeholder={t("sp.searchPlaceholder")}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                  className="pl-8 pr-7 py-1.5 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-accent w-44 sm:w-60 xl:w-72 transition-shadow"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Mobile Companion Barcode Scanner */}
              <button
                type="button"
                onClick={openPairingModal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Scan Barcode with Phone"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Phone Scan</span>
              </button>

              <button
                onClick={loadData}
                className="p-1.5 text-ink-secondary hover:bg-sunken rounded-xl transition-colors"
                title={t("sp.reload")}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <ColumnVisibilityDropdown
                columns={columnsState}
                onToggleColumn={handleToggleColumn}
                onResetColumns={handleResetColumns}
              />

              <button
                onClick={() => {
                  setSelectedPart(null);
                  setFormState({
                    itemName: "",
                    serialNumber: "",
                    description: "",
                    useFor: "",
                    pictureUrl: "",
                    quantity: 1,
                    defaultPrice: 0.0,
                  });
                  setActiveModal("edit");
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("sp.add")}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrintPart(checkedRow)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-colors shadow-sm text-ink bg-surface border border-subtle hover:bg-cushion cursor-pointer"
                title={t("crud.print")}
              >
                <Printer className="w-3.5 h-3.5 text-accent" />
                <span>{t("crud.print")}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-ink bg-surface border border-prominent rounded-xl hover:bg-cushion transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t("action.export")}</span>
              </button>
            </div>

            {/* Category → Type → Brand. Server-side filters; the counts on the
                chips below are for the filtered set. */}
            <SparePartFilterBar
              value={filters}
              onChange={setFilters}
              categoryOptions={taxonomy.categoryOptions}
              brandOptions={taxonomy.brandOptions}
              typeOptionsFor={taxonomy.typeOptionsFor}
              loading={taxonomy.loading}
              error={taxonomy.error}
              onRetry={taxonomy.retry}
            />

            {/* Stock-band chips. Reflects true catalogue / search breakdown counts. */}
            <div className="flex items-center gap-1 sm:gap-1.5 w-full">
              {(["all", "good", "critical", "out"] as const).map((key) => {
                const active = band === key;
                const count =
                  key === "all"
                    ? (bandCounts.total || totalCount)
                    : key === "good"
                    ? bandCounts.good
                    : key === "critical"
                    ? bandCounts.critical
                    : bandCounts.out;

                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setBand(key)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] font-semibold",
                      "border transition-colors cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                      active
                        ? "bg-accent-soft text-accent-soft-fg border-accent/40"
                        : "bg-surface text-ink-secondary border-subtle hover:bg-cushion hover:text-ink"
                    )}
                  >
                    {key !== "all" && (
                      <span
                        aria-hidden
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          key === "good" ? "bg-success" : key === "critical" ? "bg-warning" : "bg-danger"
                        )}
                      />
                    )}
                    <span>{key === "all" ? t("sp.filterAll") : t(BAND_LABEL[key])}</span>
                    <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
              {hasActiveColumnFilters && (
                <button
                  type="button"
                  onClick={handleClearAllColumnFilters}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 transition-colors cursor-pointer select-none ml-auto"
                  title={t("sp.colFilter.clearAll")}
                >
                  <X className="w-3 h-3" />
                  <span>{t("sp.colFilter.clearAll")}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table Content — also the IntersectionObserver root for infinite scroll */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead>
              <tr className="sticky top-0 z-10 bg-cushion border-b border-subtle/80 text-[11px] font-bold text-ink-secondary uppercase tracking-wider shadow-soft-sm">
                {isRibbonMode && (
                  <th className="sticky top-0 z-20 bg-cushion py-2.5 px-2 text-center w-10 min-w-[40px]">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                {isColVisible("image") && (
                  <th className="py-1.5 px-2 sm:px-2.5 text-center whitespace-nowrap">
                    <TableHeaderFilterPopover
                      label={t("field.image")}
                      isActive={Boolean(columnFilters.hasImage && columnFilters.hasImage !== "all")}
                      onClear={() => setColumnFilters((prev) => ({ ...prev, hasImage: "all" }))}
                      onApply={loadData}
                      align="center"
                      width={200}
                      className="mx-auto"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                          {t("sp.colFilter.imageStatus")}
                        </span>
                        <div className="flex flex-col gap-1">
                          {(["all", "yes", "no"] as const).map((opt) => (
                            <label key={opt} className="flex items-center gap-2 p-1 rounded-lg hover:bg-cushion cursor-pointer select-none text-xs">
                              <input
                                type="radio"
                                name="hasImage"
                                checked={(columnFilters.hasImage || "all") === opt}
                                onChange={() => setColumnFilters((prev) => ({ ...prev, hasImage: opt }))}
                                className="accent-accent cursor-pointer"
                              />
                              <span>
                                {opt === "all"
                                  ? t("sp.colFilter.all")
                                  : opt === "yes"
                                  ? t("sp.colFilter.hasImage")
                                  : t("sp.colFilter.noImage")}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </TableHeaderFilterPopover>
                  </th>
                )}

                {isColVisible("itemName") && (
                  <th className="py-1.5 px-2 sm:px-2.5 whitespace-nowrap">
                    <TableHeaderFilterPopover
                      label={t("field.itemName")}
                      isActive={Boolean(columnFilters.itemName)}
                      onClear={() => {
                        setColumnFilters((prev) => ({ ...prev, itemName: "" }));
                      }}
                      onApply={loadData}
                      sortState={columnSort.column === "itemName" ? columnSort.direction : null}
                      sortType="alpha"
                      onSortChange={(dir) => setColumnSort({ column: dir ? "itemName" : null, direction: dir })}
                      width={260}
                    >
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                          {t("field.itemName")}
                        </span>
                        <div className="relative">
                          <input
                            type="text"
                            value={columnFilters.itemName || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setColumnFilters((prev) => ({ ...prev, itemName: val }));
                            }}
                            placeholder={t("sp.colFilter.searchPlaceholder", { col: t("field.itemName") })}
                            className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-cushion border border-subtle text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                            autoFocus
                          />
                          {columnFilters.itemName && (
                            <button
                              type="button"
                              onClick={() => {
                                setColumnFilters((prev) => ({ ...prev, itemName: "" }));
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </TableHeaderFilterPopover>
                  </th>
                )}

                {isColVisible("partNumber") && (
                  <th className="py-1.5 px-2 sm:px-2.5 whitespace-nowrap">
                    <TableHeaderFilterPopover
                      label={t("field.partNumber")}
                      isActive={Boolean(columnFilters.partNumber)}
                      onClear={() => setColumnFilters((prev) => ({ ...prev, partNumber: "" }))}
                      onApply={loadData}
                      sortState={columnSort.column === "partNumber" ? columnSort.direction : null}
                      sortType="alpha"
                      onSortChange={(dir) => setColumnSort({ column: dir ? "partNumber" : null, direction: dir })}
                      width={260}
                    >
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                          {t("field.partNumber")}
                        </span>
                        <div className="relative">
                          <input
                            type="text"
                            value={columnFilters.partNumber || ""}
                            onChange={(e) => setColumnFilters((prev) => ({ ...prev, partNumber: e.target.value }))}
                            placeholder={t("sp.colFilter.searchPlaceholder", { col: t("field.partNumber") })}
                            className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-cushion border border-subtle text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                          />
                          {columnFilters.partNumber && (
                            <button
                              type="button"
                              onClick={() => setColumnFilters((prev) => ({ ...prev, partNumber: "" }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </TableHeaderFilterPopover>
                  </th>
                )}

                {isColVisible("useFor") && (
                  <th className="py-1.5 px-2 sm:px-2.5 whitespace-nowrap">
                    <TableHeaderFilterPopover
                      label={t("field.useFor")}
                      isActive={Boolean(columnFilters.useFor)}
                      onClear={() => setColumnFilters((prev) => ({ ...prev, useFor: "" }))}
                      onApply={loadData}
                      width={260}
                    >
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                          {t("field.useFor")}
                        </span>
                        <div className="relative">
                          <input
                            type="text"
                            value={columnFilters.useFor || ""}
                            onChange={(e) => setColumnFilters((prev) => ({ ...prev, useFor: e.target.value }))}
                            placeholder={t("sp.colFilter.searchPlaceholder", { col: t("field.useFor") })}
                            className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-cushion border border-subtle text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                          />
                          {columnFilters.useFor && (
                            <button
                              type="button"
                              onClick={() => setColumnFilters((prev) => ({ ...prev, useFor: "" }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </TableHeaderFilterPopover>
                  </th>
                )}

                {isColVisible("classification") && (
                  <th className="py-1.5 px-2 sm:px-2.5 whitespace-nowrap">
                    <TableHeaderFilterPopover
                      label={t("sp.classification")}
                      title={isKhmer ? "តម្រងចំណាត់ថ្នាក់" : "Filter Classification"}
                      isActive={Boolean(filters.categoryId || filters.typeId || filters.brandId || columnFilters.unclassifiedOnly)}
                      onClear={() => {
                        setFilters({});
                        setColumnFilters((prev) => ({ ...prev, unclassifiedOnly: false }));
                      }}
                      onApply={loadData}
                      width={280}
                    >
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t("sp.category")}</span>
                          <ModernSelect
                            value={filters.categoryId || ""}
                            options={[{ value: "", label: t("sp.filterCategory") }, ...taxonomy.categoryOptions]}
                            onChange={(v) => setFilters((prev) => ({ ...prev, categoryId: v || undefined, typeId: undefined }))}
                            dense
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t("sp.type")}</span>
                          <ModernSelect
                            value={filters.typeId || ""}
                            options={[{ value: "", label: t("sp.filterType") }, ...taxonomy.typeOptionsFor(filters.categoryId)]}
                            onChange={(v) => setFilters((prev) => ({ ...prev, typeId: v || undefined }))}
                            disabled={!filters.categoryId}
                            dense
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t("sp.brand")}</span>
                          <ModernSelect
                            value={filters.brandId || ""}
                            options={[{ value: "", label: t("sp.filterBrand") }, ...taxonomy.brandOptions]}
                            onChange={(v) => setFilters((prev) => ({ ...prev, brandId: v || undefined }))}
                            dense
                          />
                        </div>
                        <label className="flex items-center gap-2 pt-1 border-t border-subtle cursor-pointer select-none text-xs">
                          <input
                            type="checkbox"
                            checked={Boolean(columnFilters.unclassifiedOnly)}
                            onChange={(e) => setColumnFilters((prev) => ({ ...prev, unclassifiedOnly: e.target.checked }))}
                            className="accent-accent rounded cursor-pointer w-3.5 h-3.5"
                          />
                          <span className="text-ink-secondary">{t("sp.unclassified")}</span>
                        </label>
                      </div>
                    </TableHeaderFilterPopover>
                  </th>
                )}

                {isColVisible("price") && (
                  <th className="py-1.5 px-2 sm:px-2.5 text-right whitespace-nowrap">
                    <div className="flex justify-end">
                      <TableHeaderFilterPopover
                        label={t("field.defaultPrice")}
                        isActive={columnFilters.minPrice != null || columnFilters.maxPrice != null}
                        onClear={() => setColumnFilters((prev) => ({ ...prev, minPrice: null, maxPrice: null }))}
                        onApply={loadData}
                        sortState={columnSort.column === "price" ? columnSort.direction : null}
                        sortType="numeric"
                        onSortChange={(dir) => setColumnSort({ column: dir ? "price" : null, direction: dir })}
                        align="start"
                        width={260}
                      >
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                            {t("field.defaultPrice")} ($)
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-ink-muted block mb-0.5">{t("sp.colFilter.minPrice")}</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={columnFilters.minPrice ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value === "" ? null : Number(e.target.value);
                                  setColumnFilters((prev) => ({ ...prev, minPrice: v }));
                                }}
                                placeholder="0.00"
                                className="w-full px-2 py-1 text-xs rounded-lg bg-cushion border border-subtle text-ink outline-none focus:border-accent"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-ink-muted block mb-0.5">{t("sp.colFilter.maxPrice")}</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={columnFilters.maxPrice ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value === "" ? null : Number(e.target.value);
                                  setColumnFilters((prev) => ({ ...prev, maxPrice: v }));
                                }}
                                placeholder="999.00"
                                className="w-full px-2 py-1 text-xs rounded-lg bg-cushion border border-subtle text-ink outline-none focus:border-accent"
                              />
                            </div>
                          </div>
                        </div>
                      </TableHeaderFilterPopover>
                    </div>
                  </th>
                )}

                {isColVisible("quantity") && (
                  <th className="py-1.5 px-2 sm:px-2.5 text-center whitespace-nowrap">
                    <TableHeaderFilterPopover
                      label={t("field.quantity")}
                      isActive={band !== "all"}
                      onClear={() => setBand("all")}
                      onApply={loadData}
                      sortState={columnSort.column === "quantity" ? columnSort.direction : null}
                      sortType="numeric"
                      onSortChange={(dir) => setColumnSort({ column: dir ? "quantity" : null, direction: dir })}
                      align="center"
                      width={220}
                      className="mx-auto"
                    >
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                          {t("sp.colFilter.stockStatus")}
                        </span>
                        <div className="flex flex-col gap-1">
                          {[
                            { key: "all", label: t("sp.filterAll") },
                            { key: "good", label: t("sp.stockGood") },
                            { key: "critical", label: t("sp.stockCritical") },
                            { key: "out", label: t("sp.stockOut") },
                          ].map((opt) => (
                            <label key={opt.key} className="flex items-center gap-2 p-1 rounded-lg hover:bg-cushion cursor-pointer select-none text-xs">
                              <input
                                type="radio"
                                name="stockBandHeader"
                                checked={band === opt.key}
                                onChange={() => setBand(opt.key as StockBand | "all")}
                                className="accent-accent"
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </TableHeaderFilterPopover>
                  </th>
                )}

                {isColVisible("barcode") && (
                  <th className="py-1.5 px-2 sm:px-2.5 text-center whitespace-nowrap">{t("field.barcode")}</th>
                )}
                {isColVisible("stockIn") && (
                  <th className="py-1.5 px-2 sm:px-2.5 text-center whitespace-nowrap">{t("sp.setStock")}</th>
                )}
                {isColVisible("stockOut") && (
                  <th className="py-1.5 px-2 sm:px-2.5 text-center whitespace-nowrap">{t("action.stockOut")}</th>
                )}
                {isColVisible("actions") && (
                  <th className="py-1.5 px-2 sm:px-2.5 text-center whitespace-nowrap">{t("field.actions")}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle text-ink ">
              {isLoading ? (
                /* Real column cells, not one grey bar across a colSpan. */
                <SkeletonRows rows={8} columns={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)} leadingThumbnail />
              ) : visibleItems.length > 0 ? (
                <>
                  {/* Spacer for the rows scrolled off the top. */}
                  {rowWindow.paddingTop > 0 && (
                    <tr aria-hidden style={{ height: rowWindow.paddingTop, borderTopWidth: 0 }} />
                  )}

                  {renderRows.map(({ part, idx }) => (
                    <PartRow
                      key={part.id || idx}
                      part={part}
                      idx={idx}
                      search={search}
                      t={t}
                      onPreviewImage={handlePreviewImage}
                      onPreviewBarcode={handlePreviewBarcode}
                      onStockIn={handleStockIn}
                      onStockOut={handleStockOut}
                      onSetStock={handleSetStock}
                      onEdit={handleEditPart}
                      onDelete={handleDeletePart}
                      onPrint={handlePrintPart}
                      isRibbonMode={isRibbonMode}
                      isSelected={checkedRow?.id === part.id}
                      onToggleSelect={(p) => setCheckedRow(checkedRow?.id === p.id ? null : p)}
                      isColVisible={isColVisible}
                    />
                  ))}

                  {rowWindow.paddingBottom > 0 && (
                    <tr aria-hidden style={{ height: rowWindow.paddingBottom, borderTopWidth: 0 }} />
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)} className="p-0">
                    <EmptyState
                      icon={Box}
                      title={t("sp.empty")}
                      action={
                        search || band !== "all" || filterKey !== "::" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch("");
                              setBand("all");
                              setFilters({});
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-ink bg-surface border border-prominent hover:bg-cushion transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                          >
                            {t("state.clearSearch")}
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}

              {/* Placeholder rows for the batch being fetched */}
              {isLoadingMore && (
                <SkeletonRows rows={3} columns={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)} leadingThumbnail />
              )}

              {/* Infinite-scroll sentinel */}
              {!isLoading && items.length > 0 && (
                <tr ref={sentinelRef}>
                  <td colSpan={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)} className="py-4 text-center">
                    <InfiniteScrollStatus
                      isLoadingMore={isLoadingMore}
                      reachedEnd={reachedEnd}
                      limitReached={limitReached}
                      count={items.length}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Status Bar */}
        <div className="p-3 md:p-4 shrink-0 border-t border-subtle bg-cushion/50 flex items-center gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-semibold text-ink tabular-nums whitespace-nowrap">
              {t("sp.loadedOf", {
                loaded: String(items.length),
                total: String(Math.max(totalCount, items.length)),
              })}
            </span>
            {totalCount > 0 && (
              <ProgressBar
                value={(items.length / Math.max(totalCount, items.length)) * 100}
                tone="accent"
                className="w-24 shrink-0"
              />
            )}
          </div>

          {band !== "all" && (
            <Badge tone={BAND_TONE[band]} dot>
              {items.length} / {totalCount}
            </Badge>
          )}

          {term && (
            <span className="text-xs text-ink-secondary truncate">
              &ldquo;{term}&rdquo;
            </span>
          )}

          {checkedRow && (
            <span className="text-xs font-medium text-accent ml-auto">
              1 {isKhmer ? "បានជ្រើសរើស" : "selected"}: {checkedRow.itemName}
            </span>
          )}
        </div>

        {/* ── FULL-SIZE IMAGE / BARCODE ── */}
        <MediaLightbox
          open={lightbox !== null}
          onClose={() => setLightbox(null)}
          title={
            lightbox?.kind === "barcode"
              ? t("sp.viewBarcode")
              : lightbox?.part.itemName ?? t("sp.viewImage")
          }
          caption={
            lightbox
              ? lightbox.part.serialNumber ?? lightbox.part.partNumber ?? ""
              : undefined
          }
          part={lightbox?.part}
          kind={lightbox?.kind}
        >
          {lightbox?.kind === "barcode" ? (
            <div className="scale-[2.2] origin-center py-8">
              <BarcodeSvg
                value={lightbox.part.serialNumber ?? lightbox.part.partNumber ?? ""}
              />
            </div>
          ) : lightbox?.part.pictureUrl ? (
            <img
              src={getImageUrl(lightbox.part.pictureUrl)}
              alt={lightbox.part.itemName ?? ""}
              className="max-h-[60vh] max-w-full object-contain"
            />
          ) : (
            <Box className="w-16 h-16 text-ink-muted" />
          )}
        </MediaLightbox>

        {/* ── CREATE / EDIT DIALOG ── */}
        {activeModal === "edit" && (
          <ModalWrapper
            open
            onClose={() => setActiveModal(null)}
            maxWidth="max-w-2xl"
            zIndex={120}
            placement="center"
            backdropVariant="heavy"
          >
            <div className="bg-surface border border-subtle rounded-2xl flex flex-col max-h-[var(--av-modal-inner-maxh)]">
              <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
                <h3 className="font-bold text-ink text-base">
                  {formState.id ? t("sp.edit") : t("sp.addNew")}
                </h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded-lg text-ink-muted hover:bg-sunken "
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Image Box & Description */}
                  <div className="space-y-4">
                    <div
                      onClick={() => !formState.pictureUrl && imageFileInputRef.current?.click()}
                      className={`w-full h-44 rounded-xl border-2 border-dashed border-subtle bg-cushion flex flex-col items-center justify-center relative overflow-hidden p-3 transition-colors ${
                        !formState.pictureUrl ? "cursor-pointer hover:border-accent/50 hover:bg-cushion/80" : ""
                      }`}
                    >
                      {formState.pictureUrl ? (
                        <>
                          <img
                            src={getImageUrl(formState.pictureUrl)}
                            alt="preview"
                            className="max-h-36 max-w-full object-contain rounded-lg drop-shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormState({ ...formState, pictureUrl: "" });
                            }}
                            className="absolute top-2 right-2 p-1 rounded-full bg-ink/60 text-white hover:bg-ink transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center space-y-1.5 px-2">
                          <ImageIcon className="w-7 h-7 text-ink-muted mx-auto" />
                          <p className="text-xs font-semibold text-ink">{t("sp.noImageSelected")}</p>
                          <p className="text-[11px] text-ink-muted leading-tight max-w-[240px]">
                            {t("sp.imageGuidelines")}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-ink ">
                          {t("sp.pictureUrl")}
                        </label>
                        <button
                          type="button"
                          disabled={isUploadingImage}
                          onClick={() => imageFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-cushion hover:text-ink disabled:opacity-60"
                        >
                          {isUploadingImage ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          {t(isUploadingImage ? "upload.uploading" : "upload.fromDevice")}
                        </button>
                        <input
                          ref={imageFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handleImageFileSelected}
                          className="hidden"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder={t("sp.pictureUrlPlaceholder")}
                        value={formState.pictureUrl || ""}
                        onChange={(e) => setFormState({ ...formState, pictureUrl: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink ">
                        {t("field.description")}
                      </label>
                      <textarea
                        rows={3}
                        value={formState.description || ""}
                        onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20"
                        placeholder={t("sp.descriptionPlaceholder")}
                      />
                    </div>
                  </div>

                  {/* Right Column: Fields */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink ">
                        {t("sp.itemNameBrand")} *
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.itemName || ""}
                        onChange={(e) => setFormState({ ...formState, itemName: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink ">
                        {t("sp.partNumberSerial")} *
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.serialNumber || ""}
                        onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface font-mono outline-none focus:ring-2 focus:ring-accent/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink ">
                        {t("sp.useForCompat")}
                      </label>
                      <input
                        type="text"
                        value={formState.useFor || ""}
                        onChange={(e) => setFormState({ ...formState, useFor: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20"
                      />
                    </div>

                    <SparePartClassificationFields
                      value={{
                        categoryId: formState.categoryId ?? null,
                        typeId: formState.typeId ?? null,
                        brandId: formState.brandId ?? null,
                      }}
                      onChange={(c) => setFormState((prev) => ({ ...prev, ...c }))}
                      categoryOptions={taxonomy.categoryOptions}
                      brandOptions={taxonomy.brandOptions}
                      typeOptionsFor={taxonomy.typeOptionsFor}
                    />

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-ink ">
                          {t("sp.stockQuantity")}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formState.quantity ?? 0}
                          onChange={(e) => setFormState({ ...formState, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-ink ">
                          {t("sp.defaultPrice")}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formState.defaultPrice ?? 0.0}
                          onChange={(e) => setFormState({ ...formState, defaultPrice: Math.max(0.0, parseFloat(e.target.value) || 0.0) })}
                          className="w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-subtle flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-ink-secondary hover:bg-sunken rounded-xl transition-colors "
                  >
                    {t("action.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-5 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors shadow-sm shadow-accent/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{t("sp.save")}</span>
                  </button>
                </div>
              </form>
            </div>
          </ModalWrapper>
        )}

        {/* ── DELETE CONFIRM DIALOG ── */}
        {/*
          The hand-rolled delete dialog that was here is now the shared
          `av/ConfirmDialog`. Same strings, same `handleDelete` — what changes
          is everything around the decision: focus moves to CANCEL rather than
          nowhere (so a reflexive Enter does not delete a part), focus is
          trapped and restored, Escape and the backdrop both cancel, and the
          panel animates in and OUT instead of vanishing.

          It matters most on this action specifically. The old markup put no
          focus anywhere, so the first Tab landed on Cancel but Enter before
          that did nothing at all — and the confirm button was the visually
          dominant one in a dialog that can destroy a catalogue record.
        */}
        <ConfirmDialog
          open={activeModal === "delete" && selectedPart !== null}
          title={t("dialog.confirmDelete")}
          description={t("sp.deleteBody", { name: selectedPart?.itemName ?? "" })}
          confirmLabel={t("table.confirmDelete")}
          cancelLabel={t("action.cancel")}
          onConfirm={handleDelete}
          onCancel={() => setActiveModal(null)}
        />

        {/* ── STOCK IN DIALOG ── */}
        {activeModal === "stockIn" && selectedPart && (
          <ModalWrapper
            open
            onClose={() => setActiveModal(null)}
            maxWidth="max-w-md"
            zIndex={120}
            placement="center"
            backdropVariant="heavy"
          >
            <div className="bg-surface border border-subtle rounded-2xl p-6">
              <div className="flex items-center gap-3 border-b border-subtle pb-3 mb-4">
                <div className="p-2 bg-success-soft text-success-fg rounded-xl ">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-base">
                    {t("sp.stockInTitle")}
                  </h3>
                  <p className="text-xs text-ink-secondary truncate max-w-xs">
                    {selectedPart.itemName}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    {t("sp.quantityToAdd")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-sm border border-subtle rounded-xl bg-surface text-ink focus:ring-2 focus:ring-accent/20 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle ">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-ink-secondary hover:bg-sunken rounded-xl transition-colors "
                  >
                    {t("action.cancel")}
                  </button>
                  <button
                    onClick={handleStockInSubmit}
                    className="px-4 py-2 text-xs font-semibold text-white bg-success hover:bg-success rounded-xl transition-colors shadow-sm"
                  >
                    {t("sp.confirmStockIn")}
                  </button>
                </div>
              </div>
            </div>
          </ModalWrapper>
        )}

        {/* ── STOCK OUT DIALOG ── */}
        {activeModal === "stockOut" && selectedPart && (
          <ModalWrapper
            open
            onClose={() => setActiveModal(null)}
            maxWidth="max-w-md"
            zIndex={120}
            placement="center"
            backdropVariant="heavy"
          >
            <div className="bg-surface border border-subtle rounded-2xl p-6">
              <div className="flex items-center gap-3 border-b border-subtle pb-3 mb-4">
                <div className="p-2 bg-danger-soft text-danger-fg rounded-xl ">
                  <MinusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-base">
                    {t("sp.stockOutTitle")}
                  </h3>
                  <p className="text-xs text-ink-secondary truncate max-w-xs">
                    {selectedPart.itemName}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      {t("sp.currentStock")}
                    </label>
                    <div className="px-3 py-2 text-sm border border-subtle bg-cushion rounded-xl font-bold font-mono">
                       {selectedPart.quantity ?? 0}
                     </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      {t("sp.quantityToDeduct")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedPart.quantity ?? (selectedPart as SparePartItem & { Quantity?: number }).Quantity ?? 0}
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 text-sm border border-subtle rounded-xl bg-surface text-ink focus:ring-2 focus:ring-accent/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    {t("sp.reasonNote")} *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder={t("sp.reasonPlaceholder")}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle ">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-ink-secondary hover:bg-sunken rounded-xl transition-colors "
                  >
                    {t("action.cancel")}
                  </button>
                  <button
                    onClick={handleStockOutSubmit}
                    disabled={!reasonInput}
                    className="px-4 py-2 text-xs font-semibold text-white bg-danger hover:bg-danger rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("sp.confirmStockOut")}
                  </button>
                </div>
              </div>
            </div>
          </ModalWrapper>
        )}

        {/* ── SET STOCK / QUICK QUANTITY EDIT DIALOG ── */}
        {activeModal === "setStock" && selectedPart && (
          <ModalWrapper
            open
            onClose={() => setActiveModal(null)}
            maxWidth="max-w-md"
            zIndex={120}
            placement="center"
            backdropVariant="heavy"
          >
            <div className="bg-surface border border-subtle rounded-2xl p-6 shadow-2xl font-sans animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-subtle pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-accent-soft text-accent rounded-xl shadow-inner">
                    <Edit className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-base">
                      {isKhmer ? "កំណត់ចំនួនស្តុក" : "Set Stock Quantity"}
                    </h3>
                    <p className="text-xs text-ink-secondary truncate max-w-xs">
                      {selectedPart.itemName} ({selectedPart.serialNumber || selectedPart.partNumber || "N/A"})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-sunken transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Current vs New comparison card */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-sunken/80 rounded-xl border border-subtle">
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-surface border border-subtle">
                    <span className="text-[11px] font-medium text-ink-muted">
                      {isKhmer ? "ចំនួនចាស់ (Before)" : "Current Stock"}
                    </span>
                    <span className="font-mono text-lg font-bold text-ink-secondary">
                      {selectedPart.quantity ?? 0} <span className="text-[11px] font-normal">{isKhmer ? "គ្រឿង" : "pcs"}</span>
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-surface border border-accent/40 shadow-xs">
                    <span className="text-[11px] font-bold text-accent">
                      {isKhmer ? "ចំនួនថ្មី (New)" : "New Stock"}
                    </span>
                    <span className="font-mono text-lg font-extrabold text-accent">
                      {quantityInput} <span className="text-[11px] font-normal">{isKhmer ? "គ្រឿង" : "pcs"}</span>
                    </span>
                  </div>
                </div>

                {/* Delta Badge */}
                <div className="flex items-center justify-center">
                  {quantityInput > (selectedPart.quantity ?? 0) ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success-soft text-success-fg border border-success/30">
                      <Plus className="w-3.5 h-3.5" />
                      <span>+{quantityInput - (selectedPart.quantity ?? 0)} {isKhmer ? "គ្រឿង (បញ្ចូលស្តុក - Stock In)" : "pcs (Stock In)"}</span>
                    </span>
                  ) : quantityInput < (selectedPart.quantity ?? 0) ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-danger-soft text-danger-fg border border-danger/30">
                      <MinusCircle className="w-3.5 h-3.5" />
                      <span>-{(selectedPart.quantity ?? 0) - quantityInput} {isKhmer ? "គ្រឿង (ដកស្តុក - Stock Out)" : "pcs (Stock Out)"}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sunken text-ink-muted border border-subtle">
                      <span>{isKhmer ? "មិនមានការផ្លាស់ប្តូរ" : "No change"}</span>
                    </span>
                  )}
                </div>

                {/* Input with Quick Buttons */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    {isKhmer ? "បញ្ចូលចំនួនស្តុកថ្មី៖" : "Enter new stock quantity:"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-base font-mono font-bold border border-subtle rounded-xl bg-surface text-ink focus:ring-2 focus:ring-accent/20 outline-none"
                      autoFocus
                    />
                  </div>

                  {/* Quick delta buttons */}
                  <div className="flex items-center justify-between gap-1.5 mt-2">
                    {[-10, -5, -1, 1, 5, 10].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() => setQuantityInput((prev) => Math.max(0, prev + delta))}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                          delta > 0
                            ? "bg-success-soft text-success-fg border-success/30 hover:bg-success/20"
                            : "bg-danger-soft text-danger-fg border-danger/30 hover:bg-danger/20"
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason / Remarks */}
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    {isKhmer ? "កំណត់ចំណាំ / មូលហេតុ (Reason)" : "Remarks / Reason"}
                  </label>
                  <input
                    type="text"
                    placeholder={isKhmer ? "បញ្ជាក់មូលហេតុកែប្រែស្តុក..." : "e.g. Direct quantity edit..."}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface text-ink outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-ink-secondary hover:bg-sunken rounded-xl transition-colors"
                  >
                    {t("action.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSetStockSubmit}
                    className="px-4 py-2 text-xs font-bold text-white bg-accent hover:bg-accent/90 rounded-xl transition-colors shadow-sm"
                  >
                    {isKhmer ? "រក្សាទុកចំនួនស្តុក" : "Save Stock Quantity"}
                  </button>
                </div>
              </div>
            </div>
          </ModalWrapper>
        )}
      </div>
    </PageWrapper>
  );
}
