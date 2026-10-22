"use client";

import { useEffect } from "react";
import { create } from "zustand";

export interface DevAction {
  id: string;
  label: string;
  description: string;
  run: () => void | Promise<void>;
}

interface DevActionsState {
  actions: Record<string, DevAction>;
  register: (actions: readonly DevAction[]) => () => void;
}

/**
 * Task-specific buttons for the Mock API panel ("Reset demo data", …).
 * Not persisted: actions are functions registered by the page that owns them.
 */
export const useDevActions = create<DevActionsState>()((set) => ({
  actions: {},
  register: (actions) => {
    set((s) => ({
      actions: { ...s.actions, ...Object.fromEntries(actions.map((a) => [a.id, a])) },
    }));
    return () =>
      set((s) => {
        const next = { ...s.actions };
        for (const a of actions) delete next[a.id];
        return { actions: next };
      });
  },
}));

export function useRegisterDevActions(actions: readonly DevAction[]) {
  const register = useDevActions((s) => s.register);
  useEffect(() => register(actions), [register, actions]);
}
