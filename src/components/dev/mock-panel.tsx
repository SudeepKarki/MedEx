"use client";

import { FlaskConicalIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsClient } from "@/hooks/use-is-client";
import { useDevMetrics } from "@/lib/dev-metrics/store";
import { useDevActions } from "@/lib/mock-controls/dev-actions";
import {
  LATENCY_PRESETS,
  describeFailureKind,
  isLatencyPreset,
  type FailureKind,
  type FailureMode,
} from "@/lib/mock-controls/protocol";
import { useMockControls } from "@/lib/mock-controls/store";

const FAILURE_MODES: { value: FailureMode; label: string }[] = [
  { value: "off", label: "Works" },
  { value: "once", label: "Fail once" },
  { value: "second", label: "Fail 2nd call" },
  { value: "always", label: "Fail always" },
];

/**
 * Reviewer-facing panel for the mock API: latency presets, offline simulation
 * and per-endpoint failure injection. Not part of the customer experience.
 */
export function MockPanel() {
  const isClient = useIsClient();
  const state = useMockControls();
  const endpoints = Object.values(state.endpoints);
  const activeCount =
    Object.values(state.rules).filter((r) => r.mode !== "off").length +
    (state.simulateOffline ? 1 : 0) +
    (state.latency !== "realistic" ? 1 : 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Open mock API controls">
          <FlaskConicalIcon aria-hidden />
          <span className="hidden sm:inline">Mock API</span>
          {isClient && activeCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Mock API controls</SheetTitle>
          <SheetDescription>
            Slow down or break specific calls to see loading, error and offline states. Settings are
            saved in this browser.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <section aria-labelledby="mock-latency" className="flex flex-col gap-2">
            <h3 id="mock-latency" className="text-sm font-semibold">
              Network speed
            </h3>
            <ToggleGroup
              type="single"
              variant="outline"
              value={state.latency}
              onValueChange={(value) => isLatencyPreset(value) && state.setLatency(value)}
              className="flex-wrap"
              aria-label="Network speed"
            >
              {Object.entries(LATENCY_PRESETS).map(([key, preset]) => (
                <ToggleGroupItem key={key} value={key} className="text-xs">
                  {preset.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {(() => {
                const [min, max] = LATENCY_PRESETS[state.latency].range;
                return max === 0 ? "No delay." : `Each call takes ${min}–${max} ms.`;
              })()}
            </p>
          </section>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="mock-offline" className="flex flex-col items-start gap-1">
              <span className="font-semibold">Simulate offline</span>
              <span className="text-xs font-normal text-muted-foreground">
                Requests fail and the app shows its offline state.
              </span>
            </Label>
            <Switch
              id="mock-offline"
              checked={state.simulateOffline}
              onCheckedChange={state.setSimulateOffline}
            />
          </div>

          <Separator />

          <section aria-labelledby="mock-endpoints" className="flex flex-col gap-4">
            <div>
              <h3 id="mock-endpoints" className="text-sm font-semibold">
                Endpoints
              </h3>
              <p className="text-xs text-muted-foreground">
                &ldquo;Fail once&rdquo; is absorbed by the app&apos;s automatic retry for transient
                errors; use &ldquo;Fail always&rdquo; to see the error state, then switch back and
                press Retry.
              </p>
            </div>
            {endpoints.length === 0 && (
              <p className="text-sm text-muted-foreground">
                This page doesn&apos;t call any mock endpoints yet.
              </p>
            )}
            {endpoints.map((endpoint) => {
              const rule = state.rules[endpoint.id] ?? {
                mode: "off" as const,
                kind: endpoint.failureKinds[0] ?? 500,
              };
              return (
                <div key={endpoint.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <code className="text-xs font-semibold">{endpoint.label}</code>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={rule.mode}
                      onValueChange={(mode) =>
                        state.setRule(endpoint.id, { mode: mode as FailureMode })
                      }
                    >
                      <SelectTrigger aria-label={`${endpoint.label} behaviour`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FAILURE_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(rule.kind)}
                      onValueChange={(kind) =>
                        state.setRule(endpoint.id, { kind: parseFailureKind(kind) })
                      }
                      disabled={rule.mode === "off"}
                    >
                      <SelectTrigger
                        aria-label={`${endpoint.label} failure type`}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {endpoint.failureKinds.map((kind) => (
                          <SelectItem key={String(kind)} value={String(kind)}>
                            {describeFailureKind(kind)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </section>

          <DemoActions />

          <PerformanceReadout />

          <Button variant="outline" onClick={state.reset} className="self-start">
            <RotateCcwIcon aria-hidden />
            Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DemoActions() {
  const actions = Object.values(useDevActions((s) => s.actions));
  if (actions.length === 0) return null;
  return (
    <section aria-labelledby="mock-demo" className="flex flex-col gap-2">
      <h3 id="mock-demo" className="text-sm font-semibold">
        Demo data
      </h3>
      {actions.map((action) => (
        <div key={action.id} className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{action.description}</p>
          <Button variant="outline" size="sm" onClick={() => void action.run()}>
            {action.label}
          </Button>
        </div>
      ))}
    </section>
  );
}

function PerformanceReadout() {
  const metrics = Object.values(useDevMetrics((s) => s.metrics));
  const reset = useDevMetrics((s) => s.reset);
  if (metrics.length === 0) return null;
  return (
    <section aria-labelledby="mock-perf" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 id="mock-perf" className="text-sm font-semibold">
          Performance (this session)
        </h3>
        <Button variant="ghost" size="xs" onClick={reset}>
          Clear
        </Button>
      </div>
      <dl className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-xs tabular-nums">
        <dt className="font-medium text-muted-foreground">Measure</dt>
        <dd className="font-medium text-muted-foreground">Last</dd>
        <dd className="font-medium text-muted-foreground">Worst</dd>
        {metrics.map((m) => (
          <div key={m.label} className="contents">
            <dt>{m.label}</dt>
            <dd className="text-right">
              {m.value.toFixed(1)} {m.unit}
            </dd>
            <dd className="text-right">
              {m.max.toFixed(1)} {m.unit}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function parseFailureKind(value: string): FailureKind {
  return /^\d+$/.test(value) ? Number(value) : value;
}
