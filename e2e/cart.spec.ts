import { expect, test, type Page } from "@playwright/test";
import { setMockControls } from "./helpers";

// One shared in-memory cart on the mock server: run these one at a time.
test.describe.configure({ mode: "serial" });

const visibleH1 = (page: Page) => page.locator("h1:visible");

async function resetServer(page: Page) {
  await page.request.post("/api/demo/reset?scope=cart");
}

async function serverOrders(page: Page) {
  const body = (await (await page.request.get("/api/demo/orders")).json()) as {
    orders: { groupType: string; status: string }[];
  };
  return body.orders;
}

/** Sign in as the demo customer, optionally removing device items first. */
async function signIn(page: Page, removeFromDevice: string[] = []) {
  await page.goto("/cart");
  await page.getByRole("heading", { name: "On this device" }).waitFor();
  for (const title of removeFromDevice) {
    await page.getByRole("button", { name: `Remove ${title}` }).click();
  }
  await page.getByRole("button", { name: "Sign in to check out" }).click();
  await page.getByRole("button", { name: "Continue as Asha" }).click();
  await page.getByRole("heading", { name: /We added|We combined|signed in/ }).waitFor();
}

test.beforeEach(async ({ page }) => {
  await resetServer(page);
  await setMockControls(page, { latency: "fast" });
});

test("signing in merges the device cart and says exactly what changed", async ({ page }) => {
  await signIn(page);
  const summary = page.getByRole("region", { name: /We added 1 item/ });
  await expect(summary).toContainText("Liver Function Profile: your account had 2");
  await expect(summary).toContainText("Lipid Profile was added");
  await expect(summary).toContainText("90-minute option you picked on this device");
  await expect(summary).toContainText("1 item from this device is no longer available");
  // Same product on both: the larger quantity, never the sum
  await expect(
    page.getByRole("group", { name: "Quantity of Liver Function Profile" }).locator("output"),
  ).toHaveText("3");
});

test("five quick taps end on the right quantity without flickering", async ({ page }) => {
  await setMockControls(page, { latency: "realistic" });
  await signIn(page);
  const stepper = page.getByRole("group", { name: "Quantity of Liver Function Profile" });
  // Record every value the screen ever shows
  await stepper.locator("output").evaluate((el) => {
    const w = window as unknown as { __seen: string[] };
    w.__seen = [el.textContent ?? ""];
    new MutationObserver(() => w.__seen.push(el.textContent ?? "")).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  const plus = page.getByRole("button", { name: "Add one more Liver Function Profile" });
  for (let i = 0; i < 5; i++) await plus.click({ delay: 0 });
  await expect(stepper.locator("output")).toHaveText("8");
  await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 15_000 });

  const seen = await page.evaluate(() =>
    (window as unknown as { __seen: string[] }).__seen.map(Number),
  );
  // Only ever goes up: no jumping back to an intermediate server value
  expect(seen).toEqual([...seen].sort((a, b) => a - b));
  const cart = await (await page.request.get("/api/cart")).json();
  const liver = cart.cart.groups
    .flatMap((g: { items: { quantity: number; product: { title?: string } }[] }) => g.items)
    .find((i: { product: { title?: string } }) => i.product.title === "Liver Function Profile");
  expect(liver.quantity).toBe(8);
});

test("asking for more than allowed settles on the limit and says why", async ({ page }) => {
  await signIn(page);
  const stepper = page.getByRole("group", { name: "Quantity of Liver Function Profile" });
  const plus = page.getByRole("button", { name: "Add one more Liver Function Profile" });
  for (let i = 0; i < 8; i++) await plus.click(); // 3 → 11; the server allows 10
  await expect(
    page.getByRole("main").getByRole("alert").filter({ hasText: "at most 10" }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("alert").filter({ hasText: "We've set it to 10" }),
  ).toBeVisible();
  await expect(stepper.locator("output")).toHaveText("10");
  await expect(plus).toBeDisabled(); // learned the limit
});

test("a wellness order can't be checked out until a duration is chosen", async ({ page }) => {
  await signIn(page, ["Signature Facial"]);
  const wellness = page.getByRole("region", { name: /Wellness/ });
  await expect(wellness).toContainText("Price not set yet");
  await expect(wellness).toContainText("1 item without a price yet");
  await expect(wellness.getByRole("link", { name: /Check out wellness only/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByRole("link", { name: /Check out 2 of 3 orders/ })).toBeVisible();

  await wellness.getByRole("radio", { name: /60 min/ }).check();
  await expect(wellness).toContainText("THB 1,800.00");
  await expect(page.getByRole("link", { name: /Check out all 3 orders/ })).toBeVisible();
});

test("a server error shows what's actually saved instead of guessing", async ({ page }) => {
  await setMockControls(page, {
    latency: "fast",
    rules: { "cart.quantity": { mode: "always", kind: 500 } },
  });
  await signIn(page);
  const stepper = page.getByRole("group", { name: "Quantity of CBC Profile" });
  await page.getByRole("button", { name: "Add one more CBC Profile" }).click();
  await expect(
    page.getByRole("main").getByRole("alert").filter({ hasText: "Showing what\'s saved" }),
  ).toBeVisible();
  await expect(stepper.locator("output")).toHaveText("1");
});

test("an unavailable item is marked, never ordered, and easy to remove", async ({ page }) => {
  await signIn(page);
  const unavailable = page.getByRole("region", { name: /No longer available/ });
  await expect(unavailable).toContainText("can't be booked or paid for");
  await unavailable.getByRole("button", { name: "Remove" }).click();
  await expect(unavailable).toHaveCount(0);
  // Focus lands on a real heading, not <body>
  await expect(page.locator(":focus")).toHaveAttribute(
    "data-focus-id",
    /group-|line-|cart-heading/,
  );
});

test("partial failure: the second order is declined, retrying places only that one", async ({
  page,
}) => {
  await setMockControls(page, {
    latency: "fast",
    rules: { checkout: { mode: "second", kind: 402, skip: 1 } },
  });
  await signIn(page);
  await page.getByRole("link", { name: /Check out all 3 orders/ }).click();
  await page.getByRole("button", { name: "Place 3 orders" }).click();

  await expect(visibleH1(page)).toHaveText("2 of 3 orders placed", { timeout: 30_000 });
  const declined = page.getByRole("article").filter({ hasText: "Not placed" });
  await expect(declined).toHaveCount(1);
  await expect(declined).toContainText("You haven't been charged for this order");
  expect((await serverOrders(page)).length).toBe(2);

  await declined.getByRole("button", { name: /Try again/ }).click();
  await expect(visibleH1(page)).toHaveText("All 3 orders are placed", { timeout: 30_000 });
  const orders = await serverOrders(page);
  expect(orders).toHaveLength(3);
  expect(new Set(orders.map((o) => o.groupType)).size).toBe(3); // one per group, no duplicates
});

test("a lost reply doesn't cause a second order", async ({ page }) => {
  test.setTimeout(60_000);
  await setMockControls(page, {
    latency: "fast",
    rules: { checkout: { mode: "once", kind: "lost-response" } },
  });
  await signIn(page);
  await page.goto("/cart/checkout?groups=package");
  await page.getByRole("button", { name: "Place order" }).click();
  // The server placed the order but the browser never heard back (12 s timeout);
  // the runner asks again with the same key and gets that order.
  await expect(visibleH1(page)).toHaveText("Your order is placed", { timeout: 40_000 });
  const orders = await serverOrders(page);
  expect(orders).toHaveLength(1);
});

test("reloading mid-checkout picks up where it left off", async ({ page }) => {
  await signIn(page);
  await setMockControls(page, { latency: "slow" });
  await page.goto("/cart/checkout");
  await page.getByRole("button", { name: "Place 3 orders" }).click();
  await expect(page.getByText(/Placing order…|Waiting for your bank/).first()).toBeVisible();
  await page.reload();
  await expect(visibleH1(page)).toHaveText("Placing your orders");
  await expect(visibleH1(page)).toHaveText("All 3 orders are placed", { timeout: 60_000 });
  expect(await serverOrders(page)).toHaveLength(3);
});

test("a card payment that fails after the order was accepted is explained and recoverable", async ({
  page,
}) => {
  await setMockControls(page, {
    latency: "fast",
    rules: { checkout: { mode: "once", kind: "declined-later" } },
  });
  await signIn(page);
  await page.goto("/cart/checkout?groups=package");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(visibleH1(page)).toHaveText("Your order wasn't placed", { timeout: 30_000 });
  await expect(page.getByRole("article")).toContainText("its items are still in your cart");

  await page.getByRole("button", { name: "Pay at the clinic instead" }).click();
  await expect(visibleH1(page)).toHaveText("Your order is placed", { timeout: 30_000 });
  await expect(page.getByRole("article")).toContainText("Booked · pay at the clinic");
  await expect(page.getByRole("article")).toContainText("Tamarind Medical Centre");
});

test("orders can use different payment methods", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Check out all 3 orders/ }).click();
  const packages = page.getByRole("region", { name: /Health packages/ });
  await packages.getByRole("radio", { name: /Pay at the clinic/ }).check();
  await page.getByRole("button", { name: "Place 3 orders" }).click();
  await expect(visibleH1(page)).toHaveText("All 3 orders are placed", { timeout: 30_000 });
  await expect(page.getByRole("article").filter({ hasText: "Health packages" })).toContainText(
    "pay at the clinic",
  );
  await expect(page.getByRole("article").filter({ hasText: "Lab tests" })).toContainText("Paid");
});

test.describe("regressions found in code review", () => {
  test("an unconfirmed order is never reported as 'not placed', and its items stay locked", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await setMockControls(page, {
      latency: "fast",
      rules: { checkout: { mode: "always", kind: "lost-response" } },
    });
    await signIn(page);
    await page.goto("/cart/checkout?groups=package");
    await page.getByRole("button", { name: "Place order" }).click();
    // The order IS placed on the server; the browser just never hears back
    await expect(visibleH1(page)).toHaveText("We're still checking 1 order", { timeout: 30_000 });
    await expect(page.getByText("wasn't placed")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);

    // Back in the cart the packages are locked, not editable
    await page.goto("/cart");
    await expect(page.getByText("Your checkout is still in progress")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add one more Comprehensive Health Check" }),
    ).toHaveCount(0); // ordered lines left the cart, or are locked

    // The connection recovers (switched in the Mock API panel, after the last
    // navigation, since the test's init script re-applies its rules on every load)
    await page.goto("/cart/checkout");
    await page.getByRole("button", { name: /mock api controls/i }).click();
    await page.getByRole("combobox", { name: "POST /api/checkout behaviour" }).click();
    await page.getByRole("option", { name: "Works" }).click();
    await page.keyboard.press("Escape");
    // The resumed runner may get there first; otherwise ask now
    const placed = visibleH1(page).filter({ hasText: "Your order is placed" });
    const checkNow = page.getByRole("button", { name: "Check now" });
    await expect(placed.or(checkNow)).toBeVisible({ timeout: 45_000 });
    if (await checkNow.isVisible()) await checkNow.click();
    await expect(visibleH1(page)).toHaveText("Your order is placed", { timeout: 30_000 });
    expect(await serverOrders(page)).toHaveLength(1);
  });

  test("a second tab agrees with the first and never duplicates or contradicts it", async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await setMockControls(page, { latency: "slow" });
    await page.goto("/cart/checkout");
    await page.getByRole("button", { name: "Place 3 orders" }).click();
    await expect(page.getByText(/Placing order…|Waiting for your bank/).first()).toBeVisible();

    const other = await context.newPage();
    await other.goto("/cart/checkout");
    await expect(visibleH1(other)).toHaveText("All 3 orders are placed", { timeout: 60_000 });
    await expect(visibleH1(page)).toHaveText("All 3 orders are placed", { timeout: 60_000 });
    await expect(other.getByText("Nothing was charged")).toHaveCount(0);
    expect(await serverOrders(page)).toHaveLength(3);
  });

  test("leaving the cart doesn't stop a checkout", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/cart/checkout");
    await page.getByRole("button", { name: "Place 3 orders" }).click();
    await page.getByRole("link", { name: "MedEx" }).click(); // to the home page
    await expect
      .poll(async () => (await serverOrders(page)).filter((o) => o.status === "paid").length, {
        timeout: 30_000,
      })
      .toBe(3);
  });

  test("checking out another group after a finished checkout starts a new review", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/cart/checkout?groups=package");
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(visibleH1(page)).toHaveText("Your order is placed", { timeout: 30_000 });
    await page.goto("/cart");
    await page.getByRole("link", { name: /Check out lab tests only/ }).click();
    await expect(visibleH1(page)).toHaveText("Review your order");
    await expect(page.locator(":focus")).toHaveText("Review your order");
  });

  test("a removal queued behind a failed change is still sent", async ({ page }) => {
    await setMockControls(page, {
      latency: "realistic",
      rules: { "cart.quantity": { mode: "once", kind: 500 } },
    });
    await signIn(page);
    await page.getByRole("button", { name: "Add one more CBC Profile" }).click();
    await page.getByRole("button", { name: "Remove CBC Profile" }).click();
    await expect(page.getByRole("heading", { name: "CBC Profile" })).toHaveCount(0);
    await expect
      .poll(async () => {
        const cart = await (await page.request.get("/api/cart")).json();
        return JSON.stringify(cart).includes("CBC Profile");
      })
      .toBe(false);
  });
});
