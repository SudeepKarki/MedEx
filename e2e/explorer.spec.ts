import { expect, test } from "@playwright/test";
import { resultsHeading, setMockControls, waitForResults } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setMockControls(page, { latency: "fast" });
});

test("the customer's story: check-ups in Bangkok under THB 5,000", async ({ page }) => {
  await page.goto("/services");
  await waitForResults(page);
  await expect(resultsHeading(page)).toContainText("2,853 services");

  await page.getByRole("checkbox", { name: /^Bangkok/ }).click();
  await page.getByRole("checkbox", { name: /^Health packages/ }).click();
  await expect(page).toHaveURL(/type=package&city=TH\.bangkok/);

  // Only THB is left, so the price inputs appear without choosing a currency
  const max = page.getByLabel("Max (THB)");
  await max.fill("5000");
  await max.press("Enter");
  await expect(page).toHaveURL(/currency=THB&max=5000/);
  await expect(resultsHeading(page)).toContainText("7 services from 2 providers");

  for (const card of await page.getByRole("article").all()) {
    await expect(card).toContainText("Bangkok, Thailand");
  }
});

test("facet counts predict exactly what selecting the option gives", async ({ page }) => {
  await page.goto("/services?city=TH.bangkok");
  await waitForResults(page);
  const option = page.getByRole("checkbox", { name: /^Lab tests/ });
  const label = await page.locator(`label[for="${await option.getAttribute("id")}"]`).innerText();
  const predicted = label.match(/([\d,]+)\s*results?/)?.[1];
  await option.click();
  await expect(resultsHeading(page)).toContainText(`${predicted} services`);
});

test("the URL restores the exact view on reload, share, back and forward", async ({
  page,
  context,
}) => {
  await page.goto("/services");
  await waitForResults(page);
  await page.getByRole("checkbox", { name: /^Nepal/ }).click();
  await page.getByRole("combobox", { name: "Sort by" }).click();
  await page.getByRole("option", { name: "Highest rated" }).click();
  await page.getByRole("link", { name: "Page 2" }).click();
  await expect(page).toHaveURL(/country=NP&sort=rating&page=2/);
  const heading = await resultsHeading(page).innerText();
  const firstProvider = await page.getByRole("article").first().getByRole("heading").innerText();

  await page.reload();
  await waitForResults(page);
  await expect(resultsHeading(page)).toHaveText(heading);
  await expect(page.getByRole("article").first().getByRole("heading")).toHaveText(firstProvider);

  const shared = await context.newPage();
  await shared.goto(page.url());
  await waitForResults(shared);
  await expect(shared.getByRole("article").first().getByRole("heading")).toHaveText(firstProvider);

  await page.goBack();
  await expect(page).toHaveURL(/country=NP&sort=rating$/);
  await page.goBack();
  await expect(page).toHaveURL(/country=NP$/);
  await page.goForward();
  await page.goForward();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("article").first().getByRole("heading")).toHaveText(firstProvider);
});

test("search: one history entry per search, and the box follows back/forward", async ({ page }) => {
  await page.goto("/services");
  await waitForResults(page);
  const box = page.getByRole("searchbox", { name: /Search services/ });
  await box.pressSequentially("thyroid ultrasound", { delay: 40 });
  await expect(page).toHaveURL(/q=thyroid%20ultrasound/);
  await page.goBack();
  await expect(page).toHaveURL(/\/services$/);
  await expect(box).toHaveValue("");
  await page.goForward();
  await expect(box).toHaveValue("thyroid ultrasound");
});

test("a filtered link never flashes the unfiltered list first", async ({ page }) => {
  const headings: string[] = [];
  await page.exposeFunction("recordHeading", (text: string) => headings.push(text));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const h = document.querySelector("#results-heading");
      if (h?.textContent)
        (window as unknown as { recordHeading: (t: string) => void }).recordHeading(h.textContent);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.goto("/services?type=insurance&country=IN");
  await waitForResults(page);
  expect(headings.length).toBeGreaterThan(0);
  expect(headings.some((h) => h.includes("2,853"))).toBe(false);
});

test("an old link with unknown values degrades gracefully", async ({ page }) => {
  await page.goto("/services?provider=48,99999&category=package.nope&page=999");
  await waitForResults(page);
  await expect(page.getByText("Some filters in this link are no longer available")).toBeVisible();
  await expect(page).toHaveURL(/\?provider=48$/);
});

test("API failure shows a retry that recovers without a reload", async ({ page }) => {
  await setMockControls(page, {
    latency: "fast",
    rules: { "explorer.services": { mode: "always", kind: 500 } },
  });
  await page.goto("/services?type=wellness");
  await expect(page.getByRole("heading", { name: "Something went wrong on our side" })).toBeVisible(
    {
      timeout: 20_000,
    },
  );
  // Turn the failure off in the dev panel, then retry
  await page.getByRole("button", { name: /mock api controls/i }).click();
  await page.getByRole("combobox", { name: "GET /api/service behaviour" }).click();
  await page.getByRole("option", { name: "Works" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Try again" }).click();
  await waitForResults(page);
  await expect(page).toHaveURL(/type=wellness/);
});

test("empty results offer specific ways out", async ({ page }) => {
  await page.goto("/services?type=insurance&city=NP.pokhara&home=1");
  await waitForResults(page);
  await expect(page.getByText("No services match all your filters")).toBeVisible();
  await page.getByRole("button", { name: /Remove the service type filter/ }).click();
  await expect(resultsHeading(page)).toContainText("59 services");
});

test("keyboard only: filter, expand a card, and hear the new count", async ({ page }) => {
  await page.goto("/services?city=TH.bangkok&type=lab_test");
  await waitForResults(page);
  const checkbox = page.getByRole("checkbox", { name: /^Available as a home test/ });
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/home=1/);
  await expect(page.getByRole("status").filter({ hasText: /services? from/ })).toHaveText(
    /services? from \d+ providers?\./,
  );

  const card = page.getByRole("article").first();
  const toggle = card.getByRole("button", { name: /View all \d+ matching services|Show fewer/ });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveText(/Show fewer/);
  // Focus moved to the first newly revealed service
  await expect(card.locator("li:focus")).toHaveCount(1);
});

test.describe("regressions found in code review", () => {
  async function throttle(page: import("@playwright/test").Page, rate: number) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  }

  test("two quick clicks on a slow device both end up in the URL", async ({ page }) => {
    await page.goto("/services");
    await waitForResults(page);
    await throttle(page, 4);
    await page.getByRole("checkbox", { name: /^Lab tests/ }).click();
    await page.getByRole("checkbox", { name: /^Health packages/ }).click({ delay: 0 });
    await expect(page).toHaveURL(/type=package,lab_test/);
    await expect(page.getByRole("checkbox", { name: /^Lab tests/ })).toBeChecked();
  });

  test("typing then sorting keeps the search in the URL", async ({ page }) => {
    await page.goto("/services");
    await waitForResults(page);
    await throttle(page, 4);
    await page.getByRole("searchbox", { name: /Search services/ }).fill("thyroid");
    await page.getByRole("combobox", { name: "Sort by" }).click();
    await page.getByRole("option", { name: "Price: low to high" }).click();
    await expect(page).toHaveURL(/q=thyroid.*sort=price-asc/);
    await page.reload();
    await waitForResults(page);
    await expect(page.getByRole("searchbox", { name: /Search services/ })).toHaveValue("thyroid");
  });

  test("removing a filter chip keeps focus in the chip row", async ({ page }) => {
    await page.goto("/services?type=package,lab_test&city=TH.bangkok");
    await waitForResults(page);
    const chips = page.getByRole("button", { name: /, remove filter$/ });
    await expect(chips).toHaveCount(3);
    await chips.first().focus();
    await page.keyboard.press("Enter");
    await expect(chips).toHaveCount(2);
    await expect(chips.first()).toBeFocused();
    // Removing the rest moves focus to the results heading, never to <body>
    await page.keyboard.press("Enter");
    await expect(chips).toHaveCount(1);
    await expect(chips.first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(chips).toHaveCount(0);
    await expect(resultsHeading(page)).toBeFocused();
  });

  test("each filter group has an accessible name", async ({ page }) => {
    await page.goto("/services");
    await waitForResults(page);
    for (const name of ["Location", "Service type", "Price", "Category", "Provider"]) {
      await expect(page.getByRole("group", { name, exact: true })).toHaveCount(1);
    }
  });

  test("a very long search with an emoji doesn't break the page", async ({ page }) => {
    await page.goto(`/services?q=${"a".repeat(99)}%F0%9F%98%80`);
    await expect(resultsHeading(page)).toBeVisible();
    await expect(page.getByText("No services match all your filters")).toBeVisible();
  });
});
