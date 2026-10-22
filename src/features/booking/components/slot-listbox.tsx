"use client";

import { MoonIcon, SunIcon, SunriseIcon, UserIcon } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { SlotState } from "../domain/availability";
import { formatClock } from "../domain/plain-date";
import { PERIOD_LABELS, type Period } from "../domain/slots";
import { dayShiftLabel, formatCustomerTime, type DualTime } from "../domain/two-clocks";

export interface SlotOption {
  key: string;
  specialistId: string;
  startMinutes: number;
  state: SlotState;
  selectable: boolean;
  /** Short visible reason when it can't be chosen ("Booked"). */
  reason: string | null;
  /** Longer reason for screen readers. */
  spokenReason: string | null;
  time: DualTime;
  selected: boolean;
  /** One of the later back-to-back times of the selected group booking. */
  inRun: boolean;
}

export interface SlotGroup {
  period: Period;
  options: SlotOption[];
}

const PERIOD_ICONS = { morning: SunriseIcon, afternoon: SunIcon, evening: MoonIcon } satisfies Record<Period, unknown>;

/**
 * One specialist's times for a day, as a single-select listbox with period
 * groups. One tab stop; ←/→ step through the times, ↑/↓ move to the row
 * above/below as laid out on screen, Home/End jump to the ends, Enter or
 * Space chooses. Booked and started times stay focusable, so a screen reader
 * hears that they exist and why they can't be chosen.
 */
export function SlotListbox({
  label,
  groups,
  providerLabel,
  customerLabel,
  showCustomer,
  disabled,
  onChoose,
}: {
  label: string;
  groups: SlotGroup[];
  providerLabel: string;
  customerLabel: string;
  showCustomer: boolean;
  disabled: boolean;
  onChoose: (option: SlotOption) => void;
}) {
  const id = useId();
  const options = groups.flatMap((g) => g.options);
  const [active, setActive] = useState<string | null>(null);
  const activeKey = options.some((o) => o.key === active)
    ? active
    : (options.find((o) => o.selected) ?? options.find((o) => o.selectable) ?? options[0])?.key;
  const elements = useRef(new Map<string, HTMLElement>());

  const focus = (key: string | undefined) => {
    if (!key) return;
    setActive(key);
    elements.current.get(key)?.focus();
  };

  /** The option in the next row up/down whose centre is nearest horizontally. */
  const verticalNeighbour = (from: string, direction: 1 | -1) => {
    const origin = elements.current.get(from)?.getBoundingClientRect();
    if (!origin) return undefined;
    const centre = origin.left + origin.width / 2;
    let best: { key: string; top: number; dx: number } | undefined;
    for (const option of options) {
      const rect = elements.current.get(option.key)?.getBoundingClientRect();
      if (!rect) continue;
      const dy = (rect.top - origin.top) * direction;
      if (dy < origin.height / 2) continue;
      const dx = Math.abs(rect.left + rect.width / 2 - centre);
      if (!best || (rect.top - best.top) * direction < -1 || (Math.abs(rect.top - best.top) <= 1 && dx < best.dx)) {
        best = { key: option.key, top: rect.top, dx };
      }
    }
    return best?.key;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!activeKey) return;
    const index = options.findIndex((o) => o.key === activeKey);
    let next: string | undefined;
    switch (event.key) {
      case "ArrowRight":
        next = options[Math.min(index + 1, options.length - 1)]?.key;
        break;
      case "ArrowLeft":
        next = options[Math.max(index - 1, 0)]?.key;
        break;
      case "ArrowDown":
        next = verticalNeighbour(activeKey, 1) ?? activeKey;
        break;
      case "ArrowUp":
        next = verticalNeighbour(activeKey, -1) ?? activeKey;
        break;
      case "Home":
        next = options[0]?.key;
        break;
      case "End":
        next = options[options.length - 1]?.key;
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const option = options[index];
        if (option?.selectable && !disabled) onChoose(option);
        return;
      }
      default:
        return;
    }
    event.preventDefault();
    focus(next);
  };

  return (
    <div
      role="listbox"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-4"
    >
      {groups.map((group) => {
        const Icon = PERIOD_ICONS[group.period];
        const free = group.options.filter((o) => o.selectable).length;
        const groupId = `${id}-${group.period}`;
        return (
          <div key={group.period} role="group" aria-labelledby={groupId} className="flex flex-col gap-2">
            <div role="presentation" id={groupId} className="flex items-center gap-2 text-sm font-medium">
              <Icon aria-hidden className="size-4 text-muted-foreground" />
              {PERIOD_LABELS[group.period]}
              <span className="font-normal text-muted-foreground">
                · {free === 0 ? "none free" : `${free} free`}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))] gap-2">
              {group.options.map((option) => (
                <SlotChip
                  key={option.key}
                  option={option}
                  providerLabel={providerLabel}
                  customerLabel={customerLabel}
                  showCustomer={showCustomer}
                  tabbable={option.key === activeKey}
                  disabled={disabled}
                  register={(el) => {
                    if (el) elements.current.set(option.key, el);
                    else elements.current.delete(option.key);
                  }}
                  onFocus={() => setActive(option.key)}
                  onChoose={() => option.selectable && !disabled && onChoose(option)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SlotChip({
  option,
  providerLabel,
  customerLabel,
  showCustomer,
  tabbable,
  disabled,
  register,
  onFocus,
  onChoose,
}: {
  option: SlotOption;
  providerLabel: string;
  customerLabel: string;
  showCustomer: boolean;
  tabbable: boolean;
  disabled: boolean;
  register: (el: HTMLElement | null) => void;
  onFocus: () => void;
  onChoose: () => void;
}) {
  const shift = dayShiftLabel(option.time.dayShift);
  const spoken = [
    `${formatClock(option.startMinutes)} ${providerLabel} time`,
    showCustomer ? `${formatCustomerTime(option.time)} your time in ${customerLabel}` : null,
    option.inRun ? "included in your group booking" : null,
    option.spokenReason,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      ref={register}
      role="option"
      aria-selected={option.selected}
      aria-disabled={!option.selectable || disabled || undefined}
      aria-label={spoken}
      tabIndex={tabbable ? 0 : -1}
      onFocus={onFocus}
      onClick={onChoose}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/60",
        option.selectable
          ? "cursor-pointer bg-card hover:border-primary hover:bg-accent/50"
          : "cursor-not-allowed bg-muted/50 text-muted-foreground",
        option.state === "current" && "border-dashed border-warning bg-warning-muted text-warning-foreground",
        option.inRun && "border-primary bg-accent text-accent-foreground",
        option.selected && "border-primary bg-primary text-primary-foreground hover:bg-primary",
      )}
    >
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          option.state === "booked" && "line-through decoration-muted-foreground/60",
        )}
      >
        {formatClock(option.startMinutes)}
      </span>
      {option.selectable || option.inRun ? (
        showCustomer && (
          <span
            className={cn(
              "flex flex-wrap items-center justify-center gap-x-1 text-xs tabular-nums",
              option.selected ? "text-primary-foreground/90" : "text-muted-foreground",
            )}
          >
            <UserIcon aria-hidden className="size-3" />
            {formatClock(option.time.customer.minutes)}
            {shift && (
              <span
                className={cn(
                  "rounded px-1 text-[11px] font-medium",
                  option.selected ? "bg-primary-foreground/20" : "bg-warning-muted text-warning-foreground",
                )}
              >
                {shift}
              </span>
            )}
          </span>
        )
      ) : (
        <span className="text-xs">{option.reason}</span>
      )}
    </div>
  );
}
