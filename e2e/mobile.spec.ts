import { expect, test } from "@playwright/test";
import { resultsHeading, setMockControls, waitForResults } from "./helpers";

test("mobile drawer shows the pending result count before applying", async ({ page }) => {
  await setMockControls(page, { latency: "fast" });
  await page.goto("/services");
  await waitForResults(page);

  await page.getByRole("button", { name: /^Filters/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filters" });
  await drawer.getByRole("checkbox", { name: /^Bangkok/ }).click();
  await drawer.getByRole("checkbox", { name: /^Health packages/ }).click();

  await expect(drawer.getByRole("button", { name: /^Show 31 services$/ })).toBeVisible();
  await expect(page).toHaveURL(/\/services$/); // nothing applied yet

  await drawer.getByRole("button", { name: /^Show 31 services$/ }).click();
  await expect(page).toHaveURL(/type=package&city=TH\.bangkok/);
  await expect(resultsHeading(page)).toContainText("31 services");
});
