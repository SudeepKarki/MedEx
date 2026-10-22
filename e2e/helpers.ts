import type { Page } from "@playwright/test";

/** Configure the mock API through the same persisted store the dev panel uses. */
export async function setMockControls(
  page: Page,
  state: { latency?: string; simulateOffline?: boolean; rules?: Record<string, unknown> },
) {
  await page.addInitScript((s) => {
    localStorage.setItem(
      "medex.mock-controls",
      JSON.stringify({
        state: { latency: "fast", simulateOffline: false, rules: {}, ...s },
        version: 1,
      }),
    );
  }, state);
}

export const resultsHeading = (page: Page) => page.locator("#results-heading");

export async function waitForResults(page: Page) {
  await resultsHeading(page)
    .filter({ hasText: /services? from/ })
    .waitFor();
}
