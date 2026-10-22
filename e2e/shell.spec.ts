import { expect, test } from "@playwright/test";

test("the app shell renders and the mock API controls open", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeVisible();

  await page.getByRole("button", { name: /mock api controls/i }).click();
  await expect(page.getByRole("dialog", { name: "Mock API controls" })).toBeVisible();
  await page.getByRole("switch", { name: /Simulate offline/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/You're offline/)).toBeVisible();
});
