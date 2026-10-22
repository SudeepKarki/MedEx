"use client";

import { create } from "zustand";
import type { LineEdit } from "../domain/view";

type EditField = "quantity" | "wellnessPricingId" | "removing";

/**
 * Edits the customer has made that the server hasn't confirmed yet. The
 * screen always shows these (optimistic UI); the server's answer either
 * confirms them (`settle`) or rolls them back with a reason (`fail`).
 */
interface CartEditsState {
  edits: Record<string, LineEdit>;
  saving: Record<string, true>;
  errors: Record<string, string>;
  /** Learned from 409 answers, so the stepper stops where the server will. */
  maxQuantities: Record<string, number>;

  setEdit: (lineId: string, patch: LineEdit) => void;
  /** The server now has `sent`; drop the edit unless the customer has asked for something newer. */
  settle: (lineId: string, field: EditField, sent: unknown) => void;
  /** The server refused: undo the edit and say why. */
  fail: (lineId: string, field: EditField, message: string) => void;
  clearEdit: (lineId: string) => void;
  setSaving: (lineId: string, saving: boolean) => void;
  setMax: (lineId: string, max: number) => void;
  dismissError: (lineId: string) => void;
  reset: () => void;
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function dropField(edit: LineEdit | undefined, field: EditField): LineEdit | undefined {
  if (!edit) return undefined;
  const next = { ...edit };
  delete next[field];
  return Object.keys(next).length ? next : undefined;
}

export const useCartEdits = create<CartEditsState>()((set) => ({
  edits: {},
  saving: {},
  errors: {},
  maxQuantities: {},

  setEdit: (lineId, patch) =>
    set((s) => ({
      edits: { ...s.edits, [lineId]: { ...s.edits[lineId], ...patch } },
      errors: without(s.errors, lineId),
    })),
  settle: (lineId, field, sent) =>
    set((s) => {
      const edit = s.edits[lineId];
      if (!edit || edit[field] !== sent) return s;
      const next = dropField(edit, field);
      return { edits: next ? { ...s.edits, [lineId]: next } : without(s.edits, lineId) };
    }),
  fail: (lineId, field, message) =>
    set((s) => {
      const next = dropField(s.edits[lineId], field);
      return {
        edits: next ? { ...s.edits, [lineId]: next } : without(s.edits, lineId),
        errors: { ...s.errors, [lineId]: message },
      };
    }),
  clearEdit: (lineId) => set((s) => ({ edits: without(s.edits, lineId) })),
  setSaving: (lineId, saving) =>
    set((s) => ({ saving: saving ? { ...s.saving, [lineId]: true } : without(s.saving, lineId) })),
  setMax: (lineId, max) => set((s) => ({ maxQuantities: { ...s.maxQuantities, [lineId]: max } })),
  dismissError: (lineId) => set((s) => ({ errors: without(s.errors, lineId) })),
  reset: () => set({ edits: {}, saving: {}, errors: {}, maxQuantities: {} }),
}));
