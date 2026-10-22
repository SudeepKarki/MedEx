"use client";

import { useCheckoutRunner } from "../hooks/use-checkout-runner";

/** Headless: keeps an in-progress checkout moving on every /cart page. */
export function CheckoutRunner() {
  useCheckoutRunner();
  return null;
}
