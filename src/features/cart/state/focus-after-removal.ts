"use client";

import { create } from "zustand";
import type { GroupView } from "../domain/types";

/**
 * Where keyboard focus goes after an item disappears. Removal is optimistic,
 * so the element is gone on the next render; the target is chosen *before*
 * removing and applied after the re-render (see useApplyPendingFocus).
 */
export const usePendingFocus = create<{ target: string | null; set: (t: string | null) => void }>()(
  (set) => ({ target: null, set: (target) => set({ target }) }),
);

/** Next item in the group, else the previous one, else the next group, else the cart heading. */
export function focusTargetAfterRemoving(groups: readonly GroupView[], lineId: string): string {
  const gi = groups.findIndex((g) => g.lines.some((l) => l.id === lineId));
  const group = groups[gi];
  if (!group) return "cart-heading";
  const li = group.lines.findIndex((l) => l.id === lineId);
  const sibling = group.lines[li + 1] ?? group.lines[li - 1];
  if (sibling) return `line-${sibling.id}`;
  const neighbour = groups[gi + 1] ?? groups[gi - 1];
  return neighbour ? `group-${neighbour.type}` : "cart-heading";
}

export function focusById(target: string) {
  const el = document.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(target)}"]`);
  el?.focus();
  return Boolean(el);
}
