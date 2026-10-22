import { expect, test } from "@playwright/test";
import { setMockControls } from "./helpers";

test.use({ timezoneId: "Asia/Kathmandu" });

test("booking on a phone: no sideways scrolling, and the whole flow works", async ({ page }) => {
  await page.request.post("/api/demo/reset");
  await setMockControls(page, { latency: "fast" });
  await page.goto("/book/48");
  await page.getByRole("option", { disabled: false }).first().click();
  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: /^Book / }).click();
  await expect(page.getByRole("heading", { level: 1, name: "You're booked" })).toBeVisible();
});
