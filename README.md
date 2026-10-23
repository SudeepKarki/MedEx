# MedEx: Senior Frontend Engineer take-home

This branch, `dev`, runs all three exercises in one app. It merges the three task branches on top of the shared foundation from `main`.

| Exercise | Open | Branch | README |
| --- | --- | --- | --- |
| Task 1: Service Explorer with live faceted filters | `/services` | `task-1-service-explorer` | [docs/task-1-service-explorer.md](docs/task-1-service-explorer.md) |
| Task 2: Multi-provider cart and split checkout | `/cart` | `task-2-cart-checkout` | [docs/task-2-cart-checkout.md](docs/task-2-cart-checkout.md) |
| Task 3: Appointment booking across time zones | `/book` | `task-3-booking-time-zones` | [docs/task-3-booking-time-zones.md](docs/task-3-booking-time-zones.md) |

Each exercise's README (its decisions, trade-offs, data findings and what's left out) is in `docs/`, copied from its branch. Each task branch is still the place to review one exercise on its own; `main` holds only the shared foundation.

## Run it

```bash
pnpm install && pnpm dev     # http://localhost:3000
```

Requires Node 20.9+ and pnpm 10.

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server (Turbopack) |
| `pnpm build && pnpm start` | Production build |
| `pnpm test` | All 183 unit tests: 62 for Task 1, 39 for Task 2, 75 for Task 3, and 7 shared money tests |
| `pnpm e2e` | All 49 Playwright flows against one production build: 15 for Task 1, 18 for Task 2, 15 for Task 3, and the shell smoke test. The suites run in parallel. |
| `pnpm perf` | Task 1's performance budget checks, run on their own |
| `pnpm check` | Typecheck, lint and unit tests together |

Playwright needs a Chromium. Run `pnpm exec playwright install chromium`, or point `PLAYWRIGHT_CHROMIUM_PATH` at one you already have.

## What changed when merging

The exercises were built separately, so a few things collided once they shared one app:

- **`/api/providers`** is Task 1's provider list. Task 3's list of bookable providers (an extra, not in its brief) moved to **`/api/booking/providers`**. Task 3's `/api/providers/:id`, `/slots` and `/availability` are unchanged.
- **`POST /api/demo/reset`** existed in Tasks 2 and 3. It now takes **`?scope=cart`** or **`?scope=booking`** (no scope resets both). Each exercise's **Reset demo** action and e2e suite reset only their own data, so the suites can run side by side.
- **The header** lists every exercise. On phones the links get a row of their own below the bar: with everything in one row the bar was about 480 px wide, which made phones zoom the whole page out. That row scrolls with the page, so the sticky bar keeps its height.
- **Shared files** (the Mock API panel, its protocol, the error page, the e2e helpers) take `main`'s newest versions, which already include what each exercise needed.
- **An animated MedEx logo** in the header (from the `Logo` branch, so only here). It loops as it does on medex.co, even when the device asks for reduced motion: a deliberate trade-off against WCAG 2.2.2, which asks for a way to pause endless motion.
- Bugs found here were fixed on their own branch and merged again: Task 3's two clocks didn't fit on a 320 px phone, and Task 3's phone e2e flow could collide with the other booking flows when they ran side by side (they share one booking store).

## Stack and why

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Cache Components, React Compiler) | MedEx's stack. Route handlers make a realistic mock API with no extra tooling. The compiler memoises automatically, so unchanged subtrees skip re-rendering. |
| UI | **shadcn/ui** on Radix + **Tailwind CSS 4** | Accessible primitives (focus management, ARIA, keyboard) that we own and can change. |
| Server state | **TanStack Query** | Caching, retries, offline pausing and request de-duplication, so components don't hand-roll them. |
| Client state | **Zustand** | Small stores that can be read outside React. The API client reads the dev-panel settings this way. |
| Forms | **React Hook Form + Zod** | Uncontrolled inputs keep typing cheap, and the schemas validate at the boundary. |
| Money | **big.js** | Exact decimal maths. Floats round 5970.605 down to .60. |
| Tests | **Vitest + Testing Library**, Playwright | Fast unit tests for domain logic, plus browser tests for flows. |

## Look and feel

The app follows medex.co's design:

- **Colours and type:** medex.co's plum purple (#862888) as the primary colour, magenta (#b82ea2) for focus rings and accents, the pink-to-violet gradient behind the header, and orange-red for listing prices, darkened to #cf3818 so it meets 4.5:1. The typeface is Manrope. A plum-black dark theme uses an orchid primary. The contrast ratio of every text pairing is noted in `globals.css`.
- **One width:** every page lines up with the header (`page-container`). Narrow pages (checkout, booking details) keep a narrow column aligned to the same left edge.
- **Landing page:** the three exercises, each with a photo from Unsplash (credited in the footer), served through `next/image`.
- **What it costs:** the heavier styling (a wider typeface, larger prices, card shadows) adds rendering time. Task 1's budget still holds on this laptop, but on a slower CPU the first filter, which reveals the price controls, is slower than on the task branch:

| Filter → results painted | 1× (this laptop) | 2× slower CPU | 4× slower CPU |
| --- | --- | --- | --- |
| `task-1-service-explorer` branch | 33–68 ms | 61–122 ms | 108–259 ms |
| With this theme | 32–65 ms | 62–153 ms | 128–393 ms |

Typing stays under 50 ms per keystroke at every speed, and CLS stays 0. Movement right after a click is 0.34 in raw layout-shift score (0.13 on the task branch). As there, it's cards changing height as the results change, and it isn't counted as CLS because it follows the click. Measured with `pnpm perf`, as described in Task 1's README.

## Shared foundation

```
src/
  app/                    routes; app/api/* are the mock endpoints
  components/
    ui/                   shadcn/ui primitives (generated, then adjusted: memoised cn,
                          44 px touch targets, indeterminate checkbox, labelled slider thumbs)
    form/                 lightweight controls for hot paths: native checkbox/radio,
                          two-thumb native range slider, popover mounted on first open
    app/                  shell: providers, header, live announcer, offline banner
    dev/                  the "Mock API" panel (also shows live performance readouts)
  lib/
    money/                decimal parsing, half-up display rounding, per-currency totals
    api/                  typed fetch client and customer-facing error messages
    mock-controls/        dev-panel ↔ mock-server protocol and store
    dev-metrics/          timing readouts (e.g. "filter → results painted") for the panel
  server/mock/            server-only: fixture loading, latency/failure wrapper
data/                     the fictional JSON fixtures from the brief
```

**The JSON is never imported by UI code.** Fixtures are read only by `src/server` and served through route handlers under `/api`. An ESLint rule (`no-restricted-imports`) fails the build if a component imports `data/*.json` or `@/server/*`.

### Mock API controls

Every mock endpoint goes through `withMockControls`, which adds realistic latency (350–900 ms by default) and can fail on demand. You can control it in three ways:

- **In the app:** open the **Mock API** button in the header. From there you can:
  - pick a network speed (instant through very slow),
  - simulate being offline,
  - make any endpoint fail once or always, with HTTP 500 (or another status), a network error, or a timeout.
- **With curl:** add query flags, for example `curl 'localhost:3000/api/…?_latency=3000&_fail=500'`.
- **With headers:** send `x-mock-latency: slow` or `x-mock-fail: 409`.

Transient failures (network, timeout, 5xx) are retried automatically once. "Fail once" shows that recovery. "Fail always" shows the error state and its Retry button.

Two more panel features:

- **"Fail 2nd call".** Lets one call through and fails the next, which reproduces "the second of three orders fails".
- **Scenario failures.** Endpoints can offer named scenarios they implement themselves, such as "order placed, reply lost". Pages can also register **demo actions**, like "Reset demo".

### Accessibility baseline

- Skip link.
- One pair of live regions for screen-reader announcements, mounted once so their updates are always announced.
- Visible focus rings, at least 3:1 against the page.
- 44 px touch targets on touch screens.
- `prefers-reduced-motion` respected, except by the header logo (see above).
- AA colour contrast in light and dark themes (ratios are noted in `globals.css`).
- `app/error.tsx` turns any unexpected render error into a recoverable message instead of a blank page.

### Performance building blocks

These came out of profiling Task 1 (3,200 items, live counts) and are shared so later tasks start fast:

- **Memoised `cn()`.** Re-merging the same Tailwind classes on every render was about 25% of the JavaScript time per interaction.
- **Native checkboxes and radios** where dozens re-render together. They're cheap, fully accessible, and support `indeterminate`.
- **A two-thumb slider built from native range inputs.** Radix's slider measures the DOM on mount and forced a page-wide reflow.
- **Popovers that mount on first open**, for long lists of rows where most are never opened.

## AI tools

This was built with **Claude Code** (Anthropic's AI coding agent) working under my direction:

- **I chose:** the stack (Next.js, shadcn/ui, Tailwind, Zustand, React Hook Form), the branch-per-task structure, and to merge everything into `dev`.
- **The agent:** wrote the foundation, the three exercises and their tests; did this merge and resolved its conflicts; and ran every test suite on the merged app. Each exercise's README says where AI was used for it.
- **Before submitting,** agents checked each exercise line by line against its brief, and each finding was verified before it was fixed. Each exercise's README lists them under "Found in a final check against the brief".

<!-- TODO(author): describe your own review/changes here before submitting. -->
