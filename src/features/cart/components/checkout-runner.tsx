"use client";

import { useCheckoutRunner } from "../hooks/use-checkout-runner";

/** Headless: keeps an in-progress checkout moving, whichever page the customer is on. */
export function CheckoutRunner() {
  useCheckoutRunner();
  return null;
}
