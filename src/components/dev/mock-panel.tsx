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
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 left-4 z-40 shadow-md"
          aria-label="Open mock API controls"
        >
          <FlaskConicalIcon aria-hidden />
          Mock API
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

          <Button variant="outline" onClick={state.reset} className="self-start">
            <RotateCcwIcon aria-hidden />
            Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function parseFailureKind(value: string): FailureKind {
  if (value === "network" || value === "timeout") return value;
  return Number(value);
}
