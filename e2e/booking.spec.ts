import { devices, expect, test, type Page } from "@playwright/test";
import { setMockControls } from "./helpers";

// One shared in-memory booking store on the mock server: run these one at a time.
test.describe.configure({ mode: "serial" });
// The brief's customer: lives in Kathmandu, booking in Bangkok
test.use({ timezoneId: "Asia/Kathmandu" });

const RIVERSIDE = 48;
const WONGSAKUL = "2a2f07eb-7886-4f83-82ab-ca56f415da44"; // 10:00–16:00, 30 + 10 min
const EXISTING = "BK-20261008-0042";

interface Day {
  date: string;
  status: { kind: string };
}

/** Dates come from the mock API (the fixture is relative to today), never hard-coded. */
async function days(page: Page, providerId: number, query = ""): Promise<Day[]> {
  const res = await page.request.get(`/api/providers/${providerId}/availability?${query}`);
  return ((await res.json()) as { days: Day[] }).days;
}
/** A bookable date after today (today's times may have started by the time the test clicks). */
async function laterAvailableDate(page: Page, providerId: number, query = "") {
  const all = await days(page, providerId, query);
  return all.slice(1).find((d) => d.status.kind === "available")!.date;
}
/** The date with the most bookable starts, so "closest alternatives" always has some to offer. */
async function roomiestDate(page: Page, providerId: number, query = "") {
  const all = (await days(page, providerId, query)).slice(1) as { date: string; status: { kind: string; bookableStarts?: number } }[];
  return all.reduce((best, d) => ((d.status.bookableStarts ?? 0) > (best.status.bookableStarts ?? 0) ? d : best)).date;
}
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const summary = (page: Page) => page.getByRole("complementary", { name: "Summary" });
const freeOption = (page: Page) => page.getByRole("option", { disabled: false });

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/demo/reset");
  await setMockControls(page, { latency: "fast" });
});

test("every time says whose clock it is on: the hospital's first, the customer's alongside", async ({ page }) => {
  const date = await laterAvailableDate(page, RIVERSIDE, `specialistId=${WONGSAKUL}`);
  await page.goto(`/book/${RIVERSIDE}?specialist=${WONGSAKUL}&date=${date}`);

  await expect(page.getByText("All times are Thailand time")).toBeVisible();
  await expect(page.getByText(/Thailand is 1 h 15 min ahead of you/)).toBeVisible();
  // The data has a country, not a city: no claim about where the hospital is beyond that
  await expect(page.getByText("Riverside International Hospital · Thailand")).toBeVisible();
  // 10:00 AM in Bangkok is 8:45 AM in Kathmandu, whether or not it's free
  await expect(page.getByRole("option", { name: /^10:00 AM Thailand time/ })).toHaveAccessibleName(
    /^10:00 AM Thailand time, 8:45 AM your time in Kathmandu/,
  );

  await freeOption(page).first().click();
  await expect(summary(page)).toContainText("Thailand time");
  await expect(summary(page)).toContainText(/your time in Kathmandu/);
});

test("the customer can say they're somewhere else, and the second clock follows", async ({ page }) => {
  const date = await laterAvailableDate(page, RIVERSIDE, `specialistId=${WONGSAKUL}`);
  await page.goto(`/book/${RIVERSIDE}?specialist=${WONGSAKUL}&date=${date}`);
  await page.getByRole("button", { name: "Change" }).click();
  const select = page.getByLabel("Your time zone");
  // Arrowing through the list applies as it goes, but doesn't close it or lose focus
  await select.focus();
  await page.keyboard.press("ArrowDown");
  await expect(select).toBeFocused();
  await select.selectOption("Asia/Bangkok");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Change" })).toBeFocused();
  await expect(page.getByText("Thailand time is the same as yours")).toBeVisible();
  await expect(page.getByRole("option", { name: /^10:00 AM Thailand time/ })).not.toHaveAccessibleName(/your time/);
});

test("the calendar is one keyboard stop, moves by day, week and month, and says why a day is unavailable", async ({
  page,
}) => {
  const all = await days(page, RIVERSIDE);
  const today = all[0]!.date;
  const date = all.slice(1).find((d) => d.status.kind === "available")!.date;
  await page.goto(`/book/${RIVERSIDE}?date=${date}`);

  const grid = page.getByRole("grid");
  const cell = (d: string) => grid.locator(`[data-date="${d}"]`);
  await expect(cell(date)).toHaveAttribute("aria-selected", "true");
  await expect(cell(today)).toHaveAccessibleName(/today/);

  await cell(date).focus();
  await page.keyboard.press("ArrowRight");
  await expect(cell(addDays(date, 1))).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(cell(addDays(date, 8))).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  await expect(cell(date)).toBeFocused();

  // Riverside is closed on Sundays: focusable, explained, not selectable
  const sunday = all.find((d) => d.status.kind === "closed")!.date;
  const sundayCell = page.locator(`[data-date="${sunday}"]`);
  if (!(await sundayCell.count())) await page.keyboard.press("PageDown");
  await expect(sundayCell).toHaveAccessibleName(/Closed on Sundays/);
  await expect(sundayCell).toHaveAttribute("aria-disabled", "true");
  await sundayCell.focus();
  await page.keyboard.press("Enter");
  await expect(sundayCell).toHaveAttribute("aria-selected", "false");
  await expect(page.getByText(/· Closed on Sundays/)).toBeVisible(); // the reason, for sighted users too

  // Bookings open 90 days ahead: the last month ends in days that aren't open yet
  const heading = page.getByRole("heading", { level: 3 }).first();
  const before = await heading.textContent();
  await grid.locator('[tabindex="0"]').focus();
  await page.keyboard.press("PageDown");
  await expect(heading).not.toHaveText(before!);
});

test("a public holiday says so, and offers the next free day", async ({ page }) => {
  const closure = (await days(page, RIVERSIDE)).find((d) => d.status.kind === "closure")!.date;
  await page.goto(`/book/${RIVERSIDE}?date=${closure}`);
  await expect(page.getByText("Reason given: Public holiday.")).toBeVisible();
  await page.getByRole("button", { name: /^Next free day:/ }).click();
  await expect(page.getByRole("option").first()).toBeVisible();
});

test("the time grid: arrows move, Enter chooses, booked times are announced but can't be chosen", async ({
  page,
}) => {
  const date = await laterAvailableDate(page, RIVERSIDE, `specialistId=${WONGSAKUL}`);
  await page.goto(`/book/${RIVERSIDE}?specialist=${WONGSAKUL}&date=${date}`);
  const listbox = page.getByRole("listbox");
  const options = listbox.getByRole("option");
  await listbox.locator('[tabindex="0"]').focus();

  await page.keyboard.press("Home");
  await expect(options.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(options.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(options.last()).toBeFocused();
  await expect(listbox.locator('[tabindex="0"]')).toHaveCount(1); // still a single tab stop

  const free = freeOption(page).first();
  await free.focus();
  await page.keyboard.press("Enter");
  await expect(free).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/time=/);

  const booked = page.getByRole("option", { name: /booked$/ }).first();
  if (await booked.count()) {
    await booked.focus();
    await page.keyboard.press("Enter");
    await expect(booked).toHaveAttribute("aria-selected", "false");
    await expect(free).toHaveAttribute("aria-selected", "true");
  }
});

test("a specialist whose hours run past closing: only the overlap is offered, and it's explained", async ({ page }) => {
  await page.goto(`/book/${RIVERSIDE}`);
  await page.getByRole("radio", { name: /Dr\. N\. Rana/ }).check();
  const date = await laterAvailableDate(page, RIVERSIDE, "specialistId=0d113411-a562-4427-bcf5-96aff364e228");
  await page.locator(`[data-date="${date}"]`).click();
  await expect(page.getByText(/sees patients 6:00 PM – 9:00 PM, but the provider closes at/)).toBeVisible();
  // Nothing at or after 8:00 PM (Riverside's latest closing)
  await expect(page.getByRole("option", { name: /^8:\d\d PM Thailand/ })).toHaveCount(0);
  await expect(page.getByRole("option", { name: /^7:40 PM Thailand/ })).toHaveCount(1); // the last that ends by 8
  // Fridays close at 5 PM, before Dr. Rana starts: the calendar says why, not just "no times"
  const friday = page.getByRole("gridcell", { name: /^Friday, .*Outside opening hours$/ }).first();
  await expect(friday).toHaveAttribute("title", /on Fridays the provider is only open 8:00 AM – 5:00 PM/);
});

test("a group of 3 can only start where 3 times in a row are free", async ({ page }) => {
  const date = await laterAvailableDate(page, RIVERSIDE, `specialistId=${WONGSAKUL}&people=3`);
  await page.goto(`/book/${RIVERSIDE}?specialist=${WONGSAKUL}&people=3&date=${date}`);
  await freeOption(page).first().click();
  await expect(page.getByRole("option", { name: /included in your group booking/ })).toHaveCount(2);
  await expect(summary(page)).toContainText("3 appointments back to back");
  // The three starts are 40 min apart (30 min + 10 min buffer)
  const run = (await summary(page).getByText(/back to back:/).textContent()) ?? "";
  const times = [...run.matchAll(/(\d{1,2}):(\d\d) ([AP]M)/g)]
    .slice(0, 3)
    .map(([, h, m, p]) => ((Number(h) % 12) + (p === "PM" ? 12 : 0)) * 60 + Number(m));
  expect(times[1]! - times[0]!).toBe(40);
  expect(times[2]! - times[1]!).toBe(40);
});

test("someone else got there first: choices are kept and the closest times are offered", async ({ page }) => {
  await setMockControls(page, { latency: "fast", rules: { "booking.create": { mode: "once", kind: 409 } } });
  const date = await roomiestDate(page, RIVERSIDE, `specialistId=${WONGSAKUL}&people=2`);
  await page.goto(`/book/${RIVERSIDE}?specialist=${WONGSAKUL}&people=2&date=${date}`);
  await freeOption(page).first().click();
  await summary(page).getByRole("button", { name: /^Book / }).click();

  const alert = summary(page).getByRole("heading", { name: /was just taken/ });
  await expect(alert).toBeFocused();
  await expect(summary(page).getByRole("button", { name: /^Book / })).toBeDisabled();
  // Everything else they chose is still chosen
  await expect(page.getByRole("radio", { name: /Dr\. A\. Wongsakul/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: "2 people" })).toBeChecked();
  await expect(page.locator(`[data-date="${date}"]`)).toHaveAttribute("aria-selected", "true");

  const alternative = summary(page).getByRole("button", { name: /^Choose .* Thailand time/ }).first();
  await alternative.click();
  const book = summary(page).getByRole("button", { name: /^Book / });
  await expect(book).toBeFocused();
  await book.click();
  await expect(page.getByRole("heading", { level: 1, name: "You're booked" })).toBeVisible();
});

test("a reply that never arrives: choices lock, nothing can be booked twice, and checking finds the booking", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await setMockControls(page, { latency: "fast", rules: { "booking.create": { mode: "once", kind: "lost-response" } } });
  const date = await laterAvailableDate(page, RIVERSIDE, `specialistId=${WONGSAKUL}`);
  await page.goto(`/book/${RIVERSIDE}?specialist=${WONGSAKUL}&date=${date}`);
  await freeOption(page).first().click();
  await summary(page).getByRole("button", { name: /^Book / }).click();
  await expect(summary(page).getByRole("button", { name: "Booking…" })).toBeDisabled();

  await expect(summary(page).getByRole("heading", { name: "We don't know yet if it went through" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("radio", { name: "2 people" })).toBeDisabled();
  await expect(summary(page).getByRole("button", { name: /^Book / })).toBeDisabled();

  // A server error while checking proves nothing: it stays locked rather than inviting a second booking
  await page.getByRole("button", { name: /mock api controls/i }).click();
  await page.getByRole("combobox", { name: "POST /api/bookings behaviour" }).click();
  await page.getByRole("option", { name: "Fail once" }).click();
  await page.getByRole("combobox", { name: "POST /api/bookings failure type" }).click();
  await page.getByRole("option", { name: "HTTP 500" }).click();
  await page.keyboard.press("Escape");
  await summary(page).getByRole("button", { name: "Check now" }).click();
  await expect(summary(page).getByText(/We still couldn't find out whether your earlier request went through/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "2 people" })).toBeDisabled();

  // The same request key comes back with the booking that was made, not a 409 against itself
  await summary(page).getByRole("button", { name: "Check now" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "You're booked" })).toBeVisible();
});

test("if the times fail to load, nothing can be booked unchecked, and Try again keeps every choice", async ({ page }) => {
  await setMockControls(page, { latency: "fast", rules: { "booking.slots": { mode: "always", kind: 500 } } });
  const date = await laterAvailableDate(page, RIVERSIDE, `specialistId=${WONGSAKUL}&people=2`);
  // A time carried in the URL can't be confirmed while we can't see whether it's still free
  await page.goto(`/book/${RIVERSIDE}?specialist=${WONGSAKUL}&people=2&date=${date}&time=10:00`);
  await expect(page.getByText(/we couldn't load the times/)).toBeVisible({ timeout: 15_000 });
  await expect(summary(page).getByRole("button", { name: /^Book / })).toBeDisabled();
  await expect(summary(page)).toContainText("we can't check this one is still free");

  await page.getByRole("button", { name: /mock api controls/i }).click();
  await page.getByRole("combobox", { name: "GET /api/providers/:id/slots behaviour" }).click();
  await page.getByRole("option", { name: "Works" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("radio", { name: "2 people" })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Dr\. A\. Wongsakul/ })).toBeChecked();
});

test("offline: choices still work, but confirming waits for the connection", async ({ page }) => {
  const date = await laterAvailableDate(page, RIVERSIDE, `specialistId=${WONGSAKUL}`);
  await page.goto(`/book/${RIVERSIDE}?specialist=${WONGSAKUL}&date=${date}`);
  await freeOption(page).first().click();
  await page.getByRole("button", { name: /mock api controls/i }).click();
  await page.getByRole("switch", { name: /Simulate offline/ }).click();
  await page.keyboard.press("Escape");
  await expect(summary(page).getByRole("button", { name: /^Book / })).toBeDisabled();
  await expect(summary(page)).toContainText("You're offline. Reconnect to confirm");
});

test("rescheduling shows the old and new time side by side, then moves it", async ({ page }) => {
  await page.goto(`/bookings/${EXISTING}/reschedule`);
  await expect(page.getByRole("heading", { level: 1, name: "Move your appointment" })).toBeVisible();
  await expect(summary(page)).toContainText("From (current)");
  await expect(summary(page)).toContainText("11:20 AM");

  const date = await laterAvailableDate(page, RIVERSIDE, `specialistId=${WONGSAKUL}&exceptBooking=${EXISTING}`);
  await page.locator(`[data-date="${date}"]`).click();
  await freeOption(page).first().click();
  await expect(summary(page)).toContainText("To (new)");
  await expect(summary(page)).toContainText(/(later|earlier|Same day)/);
  await summary(page).getByRole("button", { name: /^Move / }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your appointment has moved" })).toBeVisible();
  await expect(page.getByText(/Moved from/)).toBeVisible();
});

test("time zones typed by hand are read and disclosed", async ({ page }) => {
  await page.goto("/book");
  await expect(page.getByText(/listed as “UTC\+05:45”, which we read as Nepal time \(UTC\+5:45\)/)).toBeVisible();
  await expect(page.getByText(/listed as “Nepal Standard Time”, which we read as Nepal time/)).toBeVisible();
  await expect(page.getByText(/listed as “\(GMT\+5:45\)”/)).toBeVisible();
  await expect(page.getByText(/haven't listed a time zone, so we're using India time \(UTC\+5:30\)/)).toBeVisible();

  // "Asia/Katmandu " (old spelling, trailing space) is simply Nepal time: the same clock as this customer
  await page.goto("/book/121");
  await expect(page.getByText("Nepal time is the same as yours")).toBeVisible();
  await expect(page.getByText("Lumbini Polyclinic · Nepal")).toBeVisible(); // not "Kathmandu": that's the zone, not the place
});

test.describe("a customer in Bangkok booking late evening in India", () => {
  test.use({ timezoneId: "Asia/Bangkok" });

  test("times after midnight on their clock say 'next day'", async ({ page }) => {
    const date = await laterAvailableDate(page, 131);
    await page.goto(`/book/131?date=${date}`);
    // 11:00 PM in India is 12:30 AM the next day in Bangkok
    await expect(page.getByRole("option", { name: /^11:00 PM India time/ })).toHaveAccessibleName(
      /12:30 AM, \w{3} \d{1,2} \w{3} your time in Bangkok/,
    );
    await expect(page.getByText("next day").first()).toBeVisible();
  });
});

// Here rather than in the mobile project: every test in this file shares the mock server's one booking store
test.describe("on a phone", () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("booking on a phone: no sideways scrolling, and the whole flow works", async ({ page }) => {
    await page.goto(`/book/${RIVERSIDE}`);
    await freeOption(page).first().click();
    const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(width).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: /^Book / }).click();
    await expect(page.getByRole("heading", { level: 1, name: "You're booked" })).toBeVisible();
  });
});
