import { expect, test, type Page } from "@playwright/test";
import { setMockControls, waitForResults } from "./helpers";

/**
 * Measures the brief's performance budget with all 3,200 services loaded:
 *  - filter change → results and facet counts painted (budget ~100 ms)
 *  - typing in the search box never blocks (Event Timing: input → next paint)
 *  - no layout shift while results update (Layout Instability API)
 *
 * By default it runs unthrottled: the machine it was developed on (AMD Ryzen 5
 * 7235HS) *is* a mid-range laptop. Set CPU_SLOWDOWN=2 or 4 to emulate slower
 * hardware; budgets are only asserted at 1×, the other runs just report.
 */
const CPU_SLOWDOWN = Number(process.env.CPU_SLOWDOWN ?? 1);

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
}

/**
 * Clicks a filter like a person would (real mouse events) and times from the
 * click event's own timestamp until the result count changed and the next
 * frame was painted.
 */
async function timeFilterClick(page: Page, name: RegExp): Promise<number> {
  await page.evaluate(() => {
    const w = window as unknown as { __filterMs: number | null };
    w.__filterMs = null;
    const heading = document.querySelector("#results-heading")!;
    const before = heading.textContent;
    let start = 0;
    document.addEventListener("click", (e) => (start = e.timeStamp), {
      once: true,
      capture: true,
    });
    const observer = new MutationObserver(() => {
      if (heading.textContent === before) return;
      observer.disconnect();
      requestAnimationFrame(() => setTimeout(() => (w.__filterMs = performance.now() - start)));
    });
    observer.observe(heading, { subtree: true, characterData: true, childList: true });
  });
  await page.getByRole("checkbox", { name }).click();
  await page.waitForFunction(
    () => (window as unknown as { __filterMs: number | null }).__filterMs !== null,
  );
  return page.evaluate(() => (window as unknown as { __filterMs: number }).__filterMs);
}

test.describe.configure({ mode: "serial" });

test("performance budget with all services loaded", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "perf");
  await setMockControls(page, { latency: "fast" });
  await page.addInitScript(() => {
    const w = window as unknown as {
      __cls: number;
      __shift: number;
      __events: { name: string; duration: number }[];
    };
    w.__cls = 0;
    w.__shift = 0;
    w.__events = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        w.__shift += entry.value; // all movement, even right after input
        if (!entry.hadRecentInput) w.__cls += entry.value; // what CLS counts
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__events.push({ name: e.name, duration: e.duration });
    }).observe({ type: "event", durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  await page.goto("/services");
  await waitForResults(page);
  await throttle(page);
  await page.evaluate(() => {
    const w = window as unknown as { __cls: number; __shift: number };
    w.__cls = 0;
    w.__shift = 0;
  });

  const clicks: Record<string, number> = {};
  for (const [label, name] of [
    // Each step must change the result count (that's what the timer waits for)
    ["Country: Thailand", /^Thailand/],
    ["Type: Lab tests", /^Lab tests/],
    ["Type: Health packages", /^Health packages/],
    ["Home test", /^Available as a home test/],
    ["City: Kathmandu", /^Kathmandu/],
  ] as const) {
    clicks[label] = await timeFilterClick(page, name);
    await page.waitForTimeout(150);
  }

  await page.evaluate(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
  });
  await page
    .getByRole("searchbox", { name: /Search services/ })
    .pressSequentially("comprehensive health check", { delay: 60 });
  await page.waitForTimeout(800);
  const typing = await page.evaluate(() =>
    (window as unknown as { __events: { name: string; duration: number }[] }).__events.filter((e) =>
      ["keydown", "keypress", "keyup", "input", "beforeinput"].includes(e.name),
    ),
  );
  const { cls, shift } = await page.evaluate(() => {
    const w = window as unknown as { __cls: number; __shift: number };
    return { cls: w.__cls, shift: w.__shift };
  });

  const worstKey = typing.reduce((max, e) => Math.max(max, e.duration), 0);
  const rows: [string, string][] = [
    ...Object.entries(clicks).map(([k, v]): [string, string] => [
      `Filter → painted: ${k}`,
      `${v.toFixed(0)} ms`,
    ]),
    [
      "Typing: keystroke events over 50 ms (of ~100)",
      String(typing.filter((e) => e.duration > 50).length),
    ],
    [
      "Typing: worst keystroke → next paint",
      typing.length ? `${worstKey.toFixed(0)} ms` : "< 16 ms",
    ],
    ["Layout shift: CLS (not caused by input)", cls.toFixed(4)],
    ["Layout shift: all movement, incl. after input", shift.toFixed(4)],
  ];
  console.log(
    `\nPerformance at ${CPU_SLOWDOWN}× CPU slowdown\n` +
      rows.map(([a, b]) => `  ${a.padEnd(52)} ${b}`).join("\n"),
  );

  if (CPU_SLOWDOWN !== 1) return;
  for (const ms of Object.values(clicks)) expect(ms).toBeLessThan(100);
  expect(worstKey).toBeLessThan(50);
  expect(cls).toBeLessThan(0.01);
});
