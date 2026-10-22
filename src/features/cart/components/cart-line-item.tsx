"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { durationLabel } from "../domain/labels";
import type { GroupView, LineView } from "../domain/types";
import { useCartEdits } from "../state/cart-edits";
import { focusTargetAfterRemoving, usePendingFocus } from "../state/focus-after-removal";
import { changeQuantity, chooseDuration, removeLine } from "../state/line-sync";
import { DurationPicker } from "./duration-picker";
import { QuantityStepper } from "./quantity-stepper";

export function CartLineItem({
  line,
  groups,
  locked,
}: {
  line: LineView;
  groups: readonly GroupView[];
  /** The group is in an active checkout: show, don't edit. */
  locked: boolean;
}) {
  const queryClient = useQueryClient();
  const dismissError = useCartEdits((s) => s.dismissError);
  const setPendingFocus = usePendingFocus((s) => s.set);

  const remove = () => {
    setPendingFocus(focusTargetAfterRemoving(groups, line.id));
    removeLine(queryClient, line.id);
  };

  const error = line.error && (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="flex-1">{line.error}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss message"
        onClick={() => dismissError(line.id)}
        className="text-destructive"
      >
        <XIcon aria-hidden />
      </Button>
    </p>
  );

  if (!line.product) {
    return (
      <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3
              tabIndex={-1}
              data-focus-id={`line-${line.id}`}
              className="scroll-mt-24 font-medium outline-none"
            >
              Service no longer available
            </h3>
            <p className="text-sm text-muted-foreground">
              The provider has removed this service, so it can&apos;t be booked or paid for. It
              isn&apos;t included in any order.
            </p>
          </div>
          <Button variant="outline" onClick={remove} disabled={line.saving}>
            <Trash2Icon aria-hidden />
            Remove
          </Button>
        </div>
        {error}
      </li>
    );
  }

  const product = line.product;
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-1">
          <h3
            tabIndex={-1}
            data-focus-id={`line-${line.id}`}
            className="scroll-mt-24 leading-snug font-medium outline-none"
          >
            {product.title}
          </h3>
          <p className="text-sm text-muted-foreground">{product.providerName}</p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          {line.lineTotal ? (
            <p className="text-base font-semibold tabular-nums">
              {formatMoney(line.lineTotal, product.currency)}
            </p>
          ) : (
            <p className="text-sm font-medium text-warning-foreground">Price not set yet</p>
          )}
          {line.unitPrice && line.quantity > 1 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatMoney(line.unitPrice, product.currency)} each
            </p>
          )}
          {line.chosenOption && (
            <p className="text-xs text-muted-foreground">
              {durationLabel(line.chosenOption.durationMinutes)}
            </p>
          )}
        </div>
      </div>

      {product.wellnessOptions.length > 0 && (
        <DurationPicker
          line={line}
          disabled={locked}
          onChoose={(optionId) => chooseDuration(queryClient, line.id, optionId)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <QuantityStepper
          label={product.title}
          value={line.quantity}
          max={line.maxQuantity}
          disabled={locked}
          onChange={(quantity) => changeQuantity(queryClient, line.id, quantity)}
        />
        <div className="flex items-center gap-3">
          {/* Fixed width so the row doesn't shift when it appears */}
          <span className="min-w-14 text-right text-xs text-muted-foreground" aria-hidden>
            {line.saving ? "Saving…" : ""}
          </span>
          <Button
            variant="ghost"
            onClick={remove}
            disabled={locked}
            className="text-muted-foreground"
          >
            <Trash2Icon aria-hidden />
            Remove<span className="sr-only"> {product.title}</span>
          </Button>
        </div>
      </div>
      {error}
    </li>
  );
}
