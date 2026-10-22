"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_LATENCY,
  type EndpointRule,
  type FailureKind,
  type LatencyPreset,
  type MockEndpointDefinition,
} from "./protocol";

/**
 * Dev-panel settings. Zustand rather than React context because the HTTP client
 * reads these outside React (`useMockControls.getState()`), and persisted to
 * localStorage so "make services fail" survives the reload you do to see it.
 */
interface MockControlsState {
  latency: LatencyPreset;
  /** Pretend the browser is offline without touching DevTools. */
  simulateOffline: boolean;
  rules: Record<string, EndpointRule>;
  /** Registered by each feature so the panel can list its endpoints. */
  endpoints: Record<string, MockEndpointDefinition>;

  setLatency: (latency: LatencyPreset) => void;
  setSimulateOffline: (offline: boolean) => void;
  setRule: (endpointId: string, rule: Partial<EndpointRule>) => void;
  registerEndpoints: (definitions: readonly MockEndpointDefinition[]) => void;
  /** Returns the failure to inject for this call (if any) and consumes "once" rules. */
  takeFailure: (endpointId: string) => FailureKind | null;
  reset: () => void;
}

export const useMockControls = create<MockControlsState>()(
  persist(
    (set, get) => ({
      latency: DEFAULT_LATENCY,
      simulateOffline: false,
      rules: {},
      endpoints: {},

      setLatency: (latency) => set({ latency }),
      setSimulateOffline: (simulateOffline) => set({ simulateOffline }),
      setRule: (endpointId, rule) =>
        set((state) => {
          const fallbackKind = state.endpoints[endpointId]?.failureKinds[0] ?? 500;
          const current = state.rules[endpointId] ?? { mode: "off", kind: fallbackKind };
          const next = { ...current, ...rule };
          // Arming "second" lets exactly one call through first
          if (rule.mode === "second") next.skip = 1;
          return { rules: { ...state.rules, [endpointId]: next } };
        }),
      registerEndpoints: (definitions) =>
        set((state) => {
          const missing = definitions.filter((d) => !state.endpoints[d.id]);
          if (missing.length === 0) return state;
          return {
            endpoints: {
              ...state.endpoints,
              ...Object.fromEntries(missing.map((d) => [d.id, d])),
            },
          };
        }),
      takeFailure: (endpointId) => {
        const rule = get().rules[endpointId];
        if (!rule || rule.mode === "off") return null;
        if (rule.mode === "second" && (rule.skip ?? 0) > 0) {
          set((s) => ({
            rules: { ...s.rules, [endpointId]: { ...rule, skip: (rule.skip ?? 1) - 1 } },
          }));
          return null;
        }
        if (rule.mode === "once" || rule.mode === "second") {
          get().setRule(endpointId, { mode: "off" });
        }
        return rule.kind;
      },
      reset: () => set({ latency: DEFAULT_LATENCY, simulateOffline: false, rules: {} }),
    }),
    {
      name: "medex.mock-controls",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Endpoint definitions come from code, not storage.
      partialize: ({ latency, simulateOffline, rules }) => ({ latency, simulateOffline, rules }),
    },
  ),
);
