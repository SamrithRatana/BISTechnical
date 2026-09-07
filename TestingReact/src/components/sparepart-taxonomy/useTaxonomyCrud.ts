"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useI18n } from "@/i18n/LanguageProvider";
import { firstValidationMessage } from "@/i18n/validationMessage";
import type { ValidationResult } from "@/validation";
import type { ApiWriteResult } from "@/services/types";
import { taxonomyFailureMessage } from "./taxonomyFeedback";

interface TaxonomyCrudOptions<TRow extends { id: string; name: string }, TForm> {
  /** The blank form for "add". */
  emptyForm: TForm;
  /** The form pre-filled from an existing row for "edit". */
  toForm: (row: TRow) => TForm;
  /** The shared rule for this lookup (`validateTaxonomyName` etc.). */
  validate: (form: TForm) => ValidationResult;
  create: (form: TForm) => Promise<ApiWriteResult>;
  update: (id: string, form: TForm) => Promise<ApiWriteResult>;
  remove: (id: string) => Promise<ApiWriteResult>;
  /** Called after any successful write so the list refetches. */
  onChanged: () => void;
}

/**
 * The add / edit / delete state machine every taxonomy page shares: which
 * dialog is open, which row it is about, the form, the busy flag, and how a
 * result turns into a toast. The pages differ only in their fields.
 *
 * The delete target is kept after the confirm closes so the dialog's exit
 * animation still shows the row's name rather than "Delete ?".
 */
export function useTaxonomyCrud<TRow extends { id: string; name: string }, TForm>(
  options: TaxonomyCrudOptions<TRow, TForm>
) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<TRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TForm>(options.emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<TRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const openAdd = useCallback(() => {
    setEditing(null);
    setForm(options.emptyForm);
    setFormOpen(true);
  }, [options.emptyForm]);

  const openEdit = useCallback(
    (row: TRow) => {
      setEditing(row);
      setForm(options.toForm(row));
      setFormOpen(true);
    },
    [options]
  );

  const closeForm = useCallback(() => setFormOpen(false), []);

  const submit = useCallback(async () => {
    const check = options.validate(form);
    if (!check.isValid) {
      toast.error(firstValidationMessage(check, t));
      return;
    }
    setBusy(true);
    try {
      const result = editing ? await options.update(editing.id, form) : await options.create(form);
      if (result.ok) {
        toast.success(t("spTax.saved"));
        setFormOpen(false);
        options.onChanged();
      } else {
        toast.error(taxonomyFailureMessage(result, t));
      }
    } catch (err: unknown) {
      // The API clients catch into a result; this covers a caller-supplied
      // function that throws, so a form submit never becomes an unhandled
      // rejection with the dialog stuck on "Saving…".
      console.error("Taxonomy save failed:", err);
      toast.error(t("spTax.saveFailed", { detail: "" }).trim());
    } finally {
      setBusy(false);
    }
  }, [editing, form, options, t]);

  const requestDelete = useCallback((row: TRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }, []);

  const cancelDelete = useCallback(() => setDeleteOpen(false), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const result = await options.remove(deleteTarget.id);
      if (result.ok) {
        toast.success(t("spTax.deleted"));
        setDeleteOpen(false);
        options.onChanged();
      } else {
        // "In use" stays open so the count is read against the row's name;
        // any other refusal closes, the toast carries the reason.
        toast.error(taxonomyFailureMessage(result, t));
        if (result.code !== "inUse") setDeleteOpen(false);
      }
    } catch (err: unknown) {
      console.error("Taxonomy delete failed:", err);
      toast.error(t("spTax.saveFailed", { detail: "" }).trim());
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  }, [deleteTarget, options, t]);

  return {
    editing,
    formOpen,
    form,
    setForm,
    openAdd,
    openEdit,
    closeForm,
    submit,
    /** The row the confirm dialog is about — kept through the exit animation. */
    deleteTarget,
    deleteOpen,
    requestDelete,
    cancelDelete,
    confirmDelete,
    busy,
  };
}
