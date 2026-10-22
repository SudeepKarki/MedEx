"use client";

import { onlineManager, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { announce } from "@/components/app/live-announcer";
import type { Booking } from "../api/client";
import { classifyConfirmFailure, type ConfirmFailure } from "../domain/confirm";
import { useConfirmAttempts, type PendingConfirm } from "../state/confirm-attempt";
import { invalidateAvailability, bookingKeys } from "./queries";

type ConfirmRequest = PendingConfirm["request"];

/**
 * Sends a booking (or a move) so that the customer can never end up with a
 * result they don't know about:
 * - one idempotency key per attempt, reused when re-checking, so a booking
 *   that went through is returned rather than made twice;
 * - an unanswered attempt is remembered (even across a reload) and blocks
 *   confirming anything else until it's been checked;
 * - it's re-checked automatically when the connection comes back.
 */
export function useConfirm({
  scope,
  providerId,
  send,
  onConfirmed,
}: {
  scope: string;
  providerId: number;
  send: (request: ConfirmRequest, idempotencyKey: string) => Promise<Booking>;
  onConfirmed: (booking: Booking) => void;
}) {
  const queryClient = useQueryClient();
  const pending = useConfirmAttempts((s) => s.pending[scope]) ?? null;
  const [failure, setFailure] = useState<ConfirmFailure | null>(null);

  const mutation = useMutation({
    mutationFn: (request: ConfirmRequest) => {
      const attempt = useConfirmAttempts.getState().begin(scope, request);
      return send(request, attempt.key);
    },
    // Never queued while offline: the client reports "offline" straight away instead
    networkMode: "always",
    retry: false,
    onMutate: () => setFailure(null),
    onSuccess: (booking) => {
      useConfirmAttempts.getState().settle(scope);
      invalidateAvailability(queryClient, providerId);
      queryClient.setQueryData(bookingKeys.booking(booking.bookingId), booking);
      onConfirmed(booking);
    },
    onError: (error) => {
      const result = classifyConfirmFailure(error);
      if (result.kind === "unknown") useConfirmAttempts.getState().markUnknown(scope);
      else useConfirmAttempts.getState().settle(scope);
      if (result.kind === "taken") invalidateAvailability(queryClient, providerId);
      setFailure(result);
      announce(
        result.kind === "taken" ? `That time was just taken. ${result.message}` : result.message,
        "assertive",
      );
    },
  });

  const unknown = pending?.status === "unknown" && !mutation.isPending ? pending : null;
  const { mutate, isPending } = mutation;

  // Back online with an unanswered attempt: find out what happened
  useEffect(() => {
    if (!unknown) return;
    const check = () => {
      if (onlineManager.isOnline() && !isPending) mutate(unknown.request);
    };
    return onlineManager.subscribe((online) => online && check());
  }, [unknown, isPending, mutate]);

  return {
    confirm: (request: ConfirmRequest) => mutate(request),
    /** Re-send the unanswered attempt with its original key. */
    check: () => unknown && mutate(unknown.request),
    isSending: isPending,
    /** An attempt we have no answer for (from this page or before a reload). */
    unknown,
    failure: unknown ? null : failure,
    clearFailure: () => setFailure(null),
  };
}
