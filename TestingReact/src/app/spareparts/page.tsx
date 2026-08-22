"use client";

import React, { memo, useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import { useCompanionScanner } from "@/context/CompanionScannerContext";
import {
  fetchSparePartsInventory,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  insertManualStockOut,
  invalidateCachePrefix,
  SparePartItem
} from "@/services/api";
import { uploadImage, UploadError } from "@/services/upload";
import { uploadErrorTranslationKey } from "@/lib/uploadErrorMessage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useRealtimeResource } from "@/hooks/useRealtimeTickets";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useSearchAction } from "@/hooks/useSearchAction";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";
import { useActionHandler, type ActionValues } from "@/components/ActionBus";
import { Badge, ConfirmDialog, EmptyState, ProgressBar, SkeletonRows } from "@/components/av";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import MediaLightbox from "@/components/MediaLightbox";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { cn } from "@/lib/utils";

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
  onEdit,
  onDelete,
}: {
  part: SparePartItem;
  idx: number;
  search: string;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
  onPreviewImage: (part: SparePartItem) => void;
  onPreviewBarcode: (part: SparePartItem) => void;
  onStockIn: (part: SparePartItem) => void;
  onStockOut: (part: SparePartItem) => void;
  onEdit: (part: SparePartItem) => void;
  onDelete: (part: SparePartItem) => void;
}) {
  const image  = part.pictureUrl;
  const name   = part.itemName ?? "N/A";
  const partNo = part.serialNumber ?? part.partNumber ?? `SP-${idx + 100}`;
  const useFor = part.useFor ?? part.description ?? "N/A";
  const qty    = part.quantity ?? 0;
  const price  = part.defaultPrice ?? 0;

  const band = stockBand(qty);

  return (
    <tr key={part.id || idx} className="hover:bg-cushion/80 transition-colors">
      {/* Image Column */}
      <td className="py-2.5 px-3.5 text-center">
        <button
          type="button"
          onClick={() => onPreviewImage(part)}
          aria-label={`${t("sp.viewImage")} — ${name}`}
          className="group w-14 h-14 mx-auto rounded-lg border border-subtle bg-cushion flex items-center justify-center overflow-hidden shadow-2xs transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
        >
          {image ? (
            // arbitrary URL from the parts database; next/image would need every
            // possible host whitelisted in next.config and throws on any that
            // isn't, which would break real product photos.
            <img
              src={getImageUrl(image)}
              alt={name}
              width={56}
              height={56}
              loading="lazy"
              decoding="async"
              /* Zoom on the IMAGE inside a clipped box, never on
                 the box: scaling the cell's own container would
                 push the row's neighbours around on hover. */
              className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-110"
            />
          ) : (
            <Box className="w-6 h-6 text-ink-muted" />
          )}
        </button>
      </td>

      {/* Item Name */}
      <td className="py-3 px-3.5 font-semibold text-ink max-w-[220px] truncate" title={name}>
        <HighlightText text={name} query={search} />
      </td>

      {/* Part Number */}
      <td className="py-3 px-3.5 whitespace-nowrap">
        <code className="px-2 py-0.5 rounded bg-sunken border border-subtle text-[11px] font-mono text-ink font-semibold">
          <HighlightText text={partNo} query={search} />
        </code>
      </td>

      {/* Use For */}
      <td className="py-3 px-3.5 text-ink-secondary max-w-[200px] truncate" title={useFor}>
        <HighlightText text={useFor} query={search} />
      </td>

      {/* Default Price */}
      <td className="py-3 px-3.5 text-right font-mono font-semibold text-success whitespace-nowrap">
        ${Number(price).toFixed(2)}
      </td>

      {/* Quantity & Stock Level Bar */}
      <td className="py-3 px-3.5 text-center whitespace-nowrap">
        <div
          className="flex flex-col items-center justify-center gap-1 min-w-[100px]"
          /* Native tooltip rather than a custom one: it is the
             only kind that survives this cell being inside a
             scrolling container, costs no DOM, and is read by
             screen readers. */
          title={t("sp.stockLevel", { qty: String(qty) })}
        >
          <span className="font-mono text-sm font-extrabold text-ink tabular-nums">
            {qty}
          </span>
          <Badge tone={BAND_TONE[band]} dot>
            {t(BAND_LABEL[band])}
          </Badge>
          {/* `av/ProgressBar` animates transform: scaleX, so a
              stock change after a Stock In/Out eases instead of
              jumping — and never triggers layout the way an
              animated `width` did. */}
          <ProgressBar
            value={(Math.min(qty, STOCK_BAR_FULL) / STOCK_BAR_FULL) * 100}
            tone={BAND_TONE[band]}
            className="w-16 mt-0.5"
          />
        </div>
      </td>

      {/* Barcode Graphic */}
      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
        <button
          type="button"
          onClick={() => onPreviewBarcode(part)}
          aria-label={`${t("sp.viewBarcode")} — ${partNo}`}
          /* Fixed white, in both themes. A barcode is read by
             reflectance: on the dark surface the row otherwise
             uses, it would look right and fail to scan. */
          className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-[#FFFFFF] border border-subtle shadow-2xs transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
        >
          <BarcodeSvg value={partNo} />
        </button>
      </td>

      {/* Set Stock (Stock In) */}
      <td className="py-3 px-3.5 text-center whitespace-nowrap">
        <button
          onClick={() => onStockIn(part)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-success-soft hover:text-success-fg hover:border-success transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] shadow-2xs "
        >
          <PackageCheck className="w-3.5 h-3.5 text-success " />
          <span>{t("action.stockIn")}</span>
        </button>
      </td>

      {/* Stock Out */}
      <td className="py-3 px-3.5 text-center whitespace-nowrap">
        <button
          disabled={qty <= 0}
          onClick={() => onStockOut(part)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-danger bg-surface border border-danger rounded-xl hover:bg-danger-soft hover:border-danger transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed "
        >
          <MinusCircle className="w-3.5 h-3.5" />
          <span>{t("action.stockOut")}</span>
        </button>
      </td>

      {/* Edit / Delete Actions */}
      <td className="py-3 px-3.5 text-center whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onEdit(part)}
            /* A hover circle, not just a colour change: these
               are the only icon-only controls in the row, and
               a bare icon gives no indication of where the
               click target actually starts and ends. */
            className="grid place-items-center w-8 h-8 rounded-full text-ink-secondary transition-colors hover:bg-accent-soft hover:text-accent-soft-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            title={t("sp.edit")}
            aria-label={`${t("sp.edit")} — ${name}`}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(part)}
            /* Red on hover, unlike Edit's accent: this one is
               destructive and should read as such before the
               click, not only in the confirmation after it. */
            className="grid place-items-center w-8 h-8 rounded-full text-ink-secondary transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            title={t("sp.delete")}
            aria-label={`${t("sp.delete")} — ${name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function SparePartsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const pageSize = 25;

  const { openPairingModal } = useCompanionScanner();

  // Modal states
  const [activeModal, setActiveModal] = useState<"stockIn" | "stockOut" | "edit" | "delete" | null>(null);
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
  const term = debouncedSearch.trim();

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
    fetchPage: (pageNumber, size) => fetchSparePartsInventory(pageNumber, size, term),
    pageSize,
    resetKey: term,
    getId: (p) => p?.id,
  });

  /**
   * The rows actually rendered, after the stock-band chip.
   *
   * Applied here rather than inside `useInfiniteList` on purpose: the hook owns
   * paging and the sentinel, and filtering its `items` would make it think it
   * had fewer rows than it fetched and stop pulling pages. The chip narrows
   * the view; the list underneath keeps loading.
   */
  const visibleItems =
    band === "all" ? items : items.filter((p) => stockBand(p.quantity ?? 0) === band);

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

  // Live updates so another user's add/edit/delete (or a stock-out) shows up
  // here without a manual reload.
  const handleRealtimeUpdate = useCallback(() => {
    invalidateCachePrefix("spareparts");
    void loadData();
  }, [loadData]);

  useRealtimeResource("sparepart", handleRealtimeUpdate);

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
    let success = false;

    const userId = "00000000-0000-0000-0000-000000000000";

    if (formState.id) {
      // Update Mode
      success = await updateSparePart(formState as SparePartItem, userId);
    } else {
      // Create Mode
      success = await createSparePart(formState as SparePartItem);
    }

    if (success) {
      void loadData();
      setActiveModal(null);
    } else {
      // Optimistic client update fallback
      setItems((prev) =>
        formState.id
          ? prev.map((p) => (p.id === formState.id ? { ...p, ...formState } : p))
          : [...prev, { ...formState, id: "temp-" + Date.now() } as SparePartItem]
      );
      setActiveModal(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedPart?.id) return;
    const success = await deleteSparePart(selectedPart.id);
    if (success) {
      void loadData();
    } else {
      // Optimistic delete
      setItems((prev) => prev.filter((p) => p.id !== selectedPart.id));
    }
    setActiveModal(null);
  };

  const handleStockInSubmit = async () => {
    if (!selectedPart) return;
    const currentQty = selectedPart.quantity ?? 0;
    const updatedPart: SparePartItem = {
      ...selectedPart,
      quantity: currentQty + quantityInput,
    };

    const success = await updateSparePart(updatedPart);
    if (success) {
      void loadData();
    } else {
      // Optimistic update
      setItems((prev) => prev.map((p) => (p.id === selectedPart.id ? updatedPart : p)));
    }
    setActiveModal(null);
  };

  const handleStockOutSubmit = async () => {
    if (!selectedPart) return;
    const currentQty = selectedPart.quantity ?? 0;
    const success = await insertManualStockOut(selectedPart.id, quantityInput, reasonInput);
    if (success) {
      void loadData();
    } else {
      // Optimistic deduction fallback
      const updatedPart: SparePartItem = {
        ...selectedPart,
        quantity: Math.max(0, currentQty - quantityInput),
      };
      setItems((prev) => prev.map((p) => (p.id === selectedPart.id ? updatedPart : p)));
    }
    setActiveModal(null);
  };

  // No client-side re-filtering: the backend's /spareparts/search already
  // matches ItemName, SerialNumber, Description and UserFor. Filtering the
  // loaded rows again here (against the *undebounced* term) used to hide rows
  // mid-keystroke and cap results at whatever one page happened to contain.

  return (
    <PageWrapper
      titleKey="nav.sparePartInventory"
      subtitleKey="sub.spareParts"
    >
      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-subtle/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Search Header */}
        <div className="p-4 shrink-0 border-b border-subtle flex flex-wrap items-center justify-between gap-4 bg-cushion/50 ">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder={t("sp.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-accent w-64 md:w-96 transition-shadow"
              />
            </div>

            {/* Mobile Companion Barcode Scanner */}
            <button
              type="button"
              onClick={openPairingModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Scan Barcode with Phone"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Phone Scan</span>
            </button>

            <button
              onClick={loadData}
              className="p-2 text-ink-secondary hover:bg-sunken rounded-xl transition-colors "
              title={t("sp.reload")}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
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
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("sp.add")}</span>
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink bg-surface border border-prominent rounded-xl hover:bg-cushion transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring">
              <Download className="w-3.5 h-3.5" />
              <span>{t("action.export")}</span>
            </button>
          </div>

          {/* Stock-band chips. Scoped to the loaded rows — see `band` state. */}
          <div className="flex items-center gap-1.5 w-full">
            {(["all", "good", "critical", "out"] as const).map((key) => {
              const active = band === key;
              const count =
                key === "all"
                  ? items.length
                  : items.filter((p) => stockBand(p.quantity ?? 0) === key).length;

              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBand(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                    "border transition-colors",
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
          </div>
        </div>

        {/* Table Content — also the IntersectionObserver root for infinite scroll */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead>
              {/*
                Sticky header. This table scrolls 665 rows inside its own
                container, and without this the column names leave the screen
                after the first eight — every row after that is unlabelled
                numbers. `shadow-soft-sm` gives the separation from the body
                that a scrolled-under row needs; it is on permanently rather
                than toggled on scroll, because toggling it needs a scroll
                listener on a container that is already doing infinite-scroll
                intersection work, for a difference nobody looks at when the
                table is at rest.
              */}
              <tr className="sticky top-0 z-10 bg-cushion border-b border-subtle/80 text-[11px] font-bold text-ink-secondary uppercase tracking-wider shadow-soft-sm">
                <th className="py-3 px-3.5 text-center whitespace-nowrap">{t("field.image")}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{t("field.itemName")}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{t("field.partNumber")}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{t("field.useFor")}</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">{t("field.defaultPrice")}</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">{t("field.quantity")}</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">{t("field.barcode")}</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">{t("sp.setStock")}</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">{t("action.stockOut")}</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">{t("field.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle text-ink ">
              {isLoading ? (
                /* Real column cells, not one grey bar across a colSpan. The
                   old version collapsed ten columns into a single block, so
                   the table visibly snapped into its column widths the moment
                   data landed — the jump a skeleton exists to prevent. */
                <SkeletonRows rows={8} columns={10} leadingThumbnail />
              ) : visibleItems.length > 0 ? (
                <>
                  {/* Spacer for the rows scrolled off the top. `borderTopWidth`
                      is forced to 0 inline because the tbody's `divide-y` would
                      otherwise draw a hairline across an empty row — inline
                      beats the utility class without a specificity fight. */}
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
                      onEdit={handleEditPart}
                      onDelete={handleDeletePart}
                    />
                  ))}

                  {rowWindow.paddingBottom > 0 && (
                    <tr aria-hidden style={{ height: rowWindow.paddingBottom, borderTopWidth: 0 }} />
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={10} className="p-0">
                    <EmptyState
                      icon={Box}
                      title={t("sp.empty")}
                      action={
                        search || band !== "all" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch("");
                              setBand("all");
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

              {/* Placeholder rows for the batch being fetched, so the scroll
                  position has somewhere to land instead of the list ending
                  abruptly at the sentinel and jumping when rows arrive. */}
              {isLoadingMore && <SkeletonRows rows={3} columns={10} leadingThumbnail />}

              {/* Infinite-scroll sentinel — observing this row pulls the next batch. */}
              {!isLoading && items.length > 0 && (
                <tr ref={sentinelRef}>
                  <td colSpan={10} className="py-4 text-center">
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

        {/* Status Bar — infinite scroll replaces page controls (this page
            previously had none at all, capping it at the first page). */}
        <div className="p-3 md:p-4 shrink-0 border-t border-subtle bg-cushion/50 flex items-center gap-4">
          {/* How far through the catalogue this list has loaded. The bare
              "Loaded 25 of 665" sentence was also three hardcoded English
              fragments ("Loaded", "part"/"parts", "matching"), so it stayed
              English in the Khmer UI — it reads through t() now. */}
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

          {/* Only shown while a chip is narrowing the view, because that is the
              only time the number of rows on screen differs from the number
              loaded — and the difference is exactly what would otherwise be
              mistaken for a catalogue-wide count. */}
          {band !== "all" && (
            <Badge tone={BAND_TONE[band]} dot>
              {visibleItems.length} / {items.length}
            </Badge>
          )}

          {term && (
            <span className="text-xs text-ink-secondary truncate">
              &ldquo;{term}&rdquo;
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
                          Default Price ($)
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
      </div>
    </PageWrapper>
  );
}
