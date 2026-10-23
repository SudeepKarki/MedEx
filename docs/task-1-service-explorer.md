# MedEx: Task 1, Service Explorer with live faceted filters

> "I need a full-body check-up near Bangkok, under 5,000 THB, and I'd like to compare a few hospitals side by side before I commit."

This is a Next.js 16 page where customers browse 3,200 services from 67 providers, grouped by provider. It has:

- live facet counts and a multi-currency price filter,
- URL-driven state,
- a mobile filter drawer,
- side-by-side comparison of providers,
- a report of every data-quality decision made.

> This is the README of the `task-1-service-explorer` branch, where this exercise lives on its own on top of the shared foundation. On `main` all three exercises run in one app and it applies as written, except: `pnpm test` and `pnpm e2e` run every exercise's tests (see the main [README](../README.md)), and the header's animated logo loops even when the device asks for reduced motion. The shared error page offers **Go to the home page** rather than a new search, and on phones the header's links sit on a row of their own.

---

## Run it

```bash
pnpm install && pnpm dev          # → http://localhost:3000/services
```

You need Node 20.9+ and pnpm 10.

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build && pnpm start` | Production build. Use this for anything performance-related. |
| `pnpm test` | 69 unit tests (Vitest): pricing, data cleaning, URL codec, location tree, facet engine, the discount badge |
| `pnpm e2e` | 15 Playwright flows against a production build |
| `pnpm perf` | Performance budget check: filter → paint, keystroke → paint, layout shift |
| `pnpm check` | Typecheck, lint and unit tests |

Playwright needs a Chromium. Run `pnpm exec playwright install chromium`, or point `PLAYWRIGHT_CHROMIUM_PATH` at one you already have.

### Seeing every state

Click **Mock API** in the header. From there you can:

- switch network speed (instant → very slow),
- **simulate offline**,
- make any of the three endpoints **fail once or always** (HTTP 500/503, network error, timeout).

The settings persist across reloads, so you can break the services endpoint and reload to see the error state. The same panel shows live performance readouts.

| State | How to see it |
| --- | --- |
| Loading (skeletons) | Any first load. Use "Slow 3G" to watch it longer. |
| Slow | "Very slow": after 4 s a message explains that it's still loading. |
| Error + retry | `GET /api/service` → "Fail always", reload. Set it back to "Works" and press **Try again**. |
| Offline | "Simulate offline", then reload. Switch it off and the page loads by itself. |
| Empty | [`/services?type=insurance&city=NP.pokhara&home=1`](http://localhost:3000/services?type=insurance&city=NP.pokhara&home=1) |
| Partial failure | `GET /api/providers` → **Fail always**, then reload. The page says "We couldn't load the providers. Everything else is ready, so only that will be fetched again", and **Try again** fetches only that. |
| Partial data | The **Data quality report** link under the results lists what was hidden or adjusted, and why. |
| Unexpected crash | Caught by `app/error.tsx`, which shows a calm message, **Try again** and a link to a new search. The filters survive, because they're in the URL. |
| The story | [`/services?type=package&city=TH.bangkok&currency=THB&max=5000`](http://localhost:3000/services?type=package&city=TH.bangkok&currency=THB&max=5000) |

You can also break endpoints from curl: `curl 'localhost:3000/api/service?_fail=503&_latency=2000'`.

---

## What's built, against the brief

| # | Requirement | Where / how |
| --- | --- | --- |
| 1 | Results grouped by provider: rating (or a sensible "no rating" state), ≤ 3 services, "View all N", count respects filters | `ProviderCard`. Unrated providers show "New on MedEx · no reviews yet". "View all 14 matching services" expands inline and moves focus to the first revealed service. |
| 2 | Filters: type, category→subcategory, searchable provider, city/country, price range, home test, free text | `components/filters/*`, `SearchBox` |
| 3 | Live facet counts given all other filters; zero options clearly unavailable | `domain/engine.ts` (single pass, see below). Zero options are **disabled, not hidden**. |
| 4 | Final price with the formula; struck-through original; honest wellness price; price filter never mixes currencies | `domain/pricing.ts`, `PriceTag`, `PriceFacet` |
| 5 | Sort: relevance (defined below), price ↑, price ↓, rating | `rankProviders` in `engine.ts` |
| 6 | URL is the source of truth: reload, share, back/forward; no flash of unfiltered list | `domain/url-state.ts`, `hooks/use-url-filters.ts`, e2e tests |
| 7 | Mobile drawer whose "Show results" counts the pending selection | `MobileFilterDrawer` (draft held in React Hook Form) |
| 8 | ~100 ms per filter change, non-blocking typing, no layout shift, plus how it was measured | [Performance](#performance) |
| 9 | Skeletons, empty state with a way out, API failure with retry, failure on demand | `components/states/*`, Mock API panel |
| 10 | Keyboard and screen readers, including announcing result-count changes | [Accessibility](#accessibility) |
| — | *Story:* "compare a few hospitals side by side" | Tick **Compare** on up to 3 cards, then **Compare side by side**. |

---

## Stack and why

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Cache Components, React Compiler), React 19, TypeScript | MedEx's stack. Route handlers serve the three mock endpoints, and the compiler skips re-rendering what didn't change while the customer types. |
| UI | **shadcn/ui** on Radix + **Tailwind CSS 4**, with native inputs where dozens render together | Accessible dialogs, popovers and the drawer, with code we own. The ~60 facet checkboxes and the price slider are native inputs: profiling showed scripted ones were far slower. |
| View state | **The URL**, through one codec (`url-state.ts`) | The brief makes it the source of truth. One canonical form means one copy of the state. |
| Server state | **TanStack Query** | Three parallel requests, retrying only what failed, paused while offline. |
| Client state | **Zustand** | The compare selection and the Mock API settings: read outside React and kept across reloads. |
| Forms | **React Hook Form** + **Zod** | The mobile drawer's pending filters, and validating the price inputs. |
| Money | **big.js** | Exact decimals: floats round some of the data's half-cent prices the wrong way. |
| Tests | **Vitest**, **Playwright** | Unit tests for pricing, the URL codec and the facet engine; browser tests for the flows, plus a performance budget. |

## Architecture

```
data/task1-service-explorer.json
        │  (server only: an ESLint rule blocks UI imports of data/ and src/server)
        ▼
src/server/service-explorer/repository.ts ── route handlers ── withMockControls (latency, failures)
        │   GET /api/category/active · /api/providers · /api/service   (production field names, raw)
        ▼
api/use-catalog.ts       TanStack Query: 3 parallel requests, retry only what failed, offline-aware
        ▼
domain/catalog.ts        Zod (lenient) → visibility rules → prices → data-quality issues   (once)
domain/engine.ts         createIndex (once) → computeView(index, filters)                  (~1 ms)
        ▲                                     │
URL ── domain/url-state.ts ── filters ────────┘──► facets, results page, "without facet" counts
        ▲
UI: FilterPanel (controlled) · ResultsList · MobileFilterDrawer (RHF draft) · Compare
```

Everything in `domain/` is pure TypeScript with no React, which keeps it easy to test and to reuse. A teammate adding a filter works through these, and TypeScript flags the places that must list every filter (the defaults, `clearFacet`, `withoutFacet`, the empty-state labels):

1. `filters.ts`: a field on `ExplorerFilters` and its default; if it can be removed on its own, a `FacetId` with its cases in `clearFacet` and `activeFacets`;
2. `url-state.ts`: its URL parameter, and `sanitizeFilters` if a stored value can go stale;
3. `engine.ts`: a dimension, with one `case` in each of `passes()` and `countFacet()`, its counts in `Facets`, and its `withoutFacet` entry;
4. the UI: a facet component, its chip label and its empty-state suggestion.

The mobile drawer picks up every filter by itself.

### Where state lives

| State | Lives in | Why |
| --- | --- | --- |
| Filters, sort, page | **The URL** (`useSearchParams` to read, `history.pushState` to write) | The brief requires it, and there is no second copy to get out of sync. Writes are *updaters* applied to the live address bar (see "The URL"). |
| Search box text while typing | Local `useState` (`useSearchDraft`) | Typing must never wait. It's written to the URL after a 300 ms pause. |
| Server data | **TanStack Query** cache | Caching, retries and offline pausing come for free. |
| Mobile drawer's pending filters | **React Hook Form** | It's a draft form applied on submit. `useWatch` drives the live count. |
| Price range inputs | **React Hook Form + Zod** | Validation: whole numbers, max ≥ min. |
| Compare selection, Mock API settings | **Zustand** (persisted) | Read outside React (the API client), and they survive reloads. Not part of the "view", so they're not in the URL. |
| "View all" expanded, provider-list search | Component state | UI-local. |

### Why filter on the client?

The brief says "with all 3,200 services loaded", and live counts across seven facets need the whole set. So the three endpoints are loaded once (about 1.7 MB raw, about 150 KB gzipped) and then everything runs locally: filtering, counting, ranking and paging. A useful side effect is that **once loaded, the explorer keeps working offline**.

In production I'd move `computeView` behind a `GET /service/search` endpoint, or a search engine with aggregations, returning one page plus the facets. The engine is already a pure function of `(data, filters)`, so it would move server-side unchanged and the first page could be server-rendered.

---

## Key decisions

### Facet counts (the part the brief singles out)

A count answers one question: **"how many results would I get if I picked this option, keeping every *other* filter?"**

Within a facet, options are OR-ed. Across facets, they're AND-ed.

`computeView` makes **one pass** over the services. For each service it finds which filter dimensions the service fails:

| Fails | Counts towards |
| --- | --- |
| **None** | Results, and every facet's counts |
| **Exactly one** | Only that dimension's options (picking another option there would bring it in) |
| **Two or more** | Nothing (no single change brings it in) |

That is O(services × dimensions), about 1 ms for 3,200 services, and correct with any combination of filters.

The same pass also gives `withoutFacet` counts ("results if you removed the price filter"). The empty state uses them to offer specific ways out with numbers attached.

**How I know it's right:** `engine.test.ts` brute-forces the defining property on the real data. For every service type, category, country, city, provider and currency, and the home-test option, across 14 filter combinations (12 of them random but reproducible), the displayed count must equal the result count you actually get by selecting that option. (Subcategories aren't in the brute force; they have their own tests.) An e2e test checks the same property through the UI.

### Zero-count options: disabled, not hidden

- **No layout shift.** The type, category and location lists keep their order and length as other filters change, so nothing moves under the cursor. With disjunctive counts, the facet you're clicking never changes its own counts, so focus never lands on an option that disappears. The provider list is the exception: with 64 providers and six shown until it's expanded, it puts the chosen ones first and then those with results, so it does reorder.
- **The customer still learns what exists.** "Wellness 0" in Pokhara is information. A vanishing option is a mystery.
- **A selected option stays enabled even at zero**, so it can always be unticked. The empty state also offers to remove it.
- **One exception:** a provider with no visible services at all (Golden Mile International Hospital) is left out of the provider list entirely, since it could only ever lead to an empty page.

### Prices across THB, NPR and INR

There are no exchange rates, so a price range only means something inside one currency.

- **Price facet:** first pick a currency (each with a live count), then a range. The range uses min/max inputs plus a two-thumb slider over a histogram of the matching prices.
- **When only one currency remains** (e.g. after picking Bangkok), the range inputs appear immediately for that currency. The story needs no extra step.
- **Choosing a currency hides other currencies, and the page says so:** "Showing services priced in Nepalese rupee only. 751 services priced in other currencies are hidden, because we don't convert between currencies."
- **Sorting by price with several currencies** sorts *within* each currency and never interleaves them. Blocks are ordered by number of providers and separated by a "Priced in Nepalese rupee (NPR)" heading, with a notice explaining why. Each card's first service is the one used for ordering, so the list looks sorted.
- **Amounts always show the ISO code** ("THB 1,845.00"), because "Rs" is ambiguous between NPR and INR.

### The final price

- **Exact arithmetic.** The brief's formula runs on exact decimals (`big.js`) and is rounded half-up to 2 dp **only for display**.
  - The data contains 25 prices that land exactly on a half-cent (e.g. 10,899.975). Float maths gets several of them wrong.
- **Filtering and sorting** compare the *displayed* (rounded) amount in integer minor units, so the filter always agrees with what's on screen.
- **The struck-through price is like-for-like.** It shows what you'd pay *without the discount*: list price plus the service charge on it.
  - Striking through the raw `price` would be misleading. 31 visible services (39 in the file) have a discount *and* a service charge where the final price is **higher** than `price`, e.g. 8,760.00 → 8,934.00.
  - An ⓘ popover shows the full breakdown (price, discount, service charge, you pay).
  - The badge beside it agrees with the two prices shown: "30% off" when they're 30% apart. With a fixed service charge they aren't (a 30% discount plus THB 233 makes THB 6,193.00 → 4,405.00), so it says how much less you pay: "THB 1,788.00 off".
- **"Free":** a 0.00 price shows as "Free", not as missing.
- **Wellness:**
  - shows "from THB 1,800.00 · for 60 min · 3 durations", with a popover listing every duration;
  - with a price range active, it headlines the cheapest duration *inside* the range, e.g. "1 of 3 durations in your range";
  - matches a range if any duration fits;
  - never shows a single "price".
- **The home-test visit fee** is shown next to the badge ("+THB 331.00 visit fee"). It's not added to the price, because it's optional.

### Relevance ("Best match")

- **With a search,** each service gets a text score: title phrase prefix +40; phrase inside title +30; each word matching the start of a title word +10, a category word +5, or the provider name +2.
- **Each provider** scores its best service, plus up to 10 points of quality.
- **Quality is a Bayesian-average rating:** `(50·mean + rating·reviews) / (50 + reviews)`. This means:
  - a 4.8 from 83 reviews doesn't automatically beat a 4.7 from 1,203 reviews;
  - providers with no reviews sit at the marketplace average instead of the bottom.
- **Without a search,** relevance is that quality score.
- **Ties** go to more matching services, then name, for stable pagination.
- **"Highest rated"** is plain rating, with ties broken by review count and unrated providers last.

### Search

- **Word-prefix matching** on normalised text (case, accents, punctuation): "thyr" finds "Thyroid", but "hyroid" doesn't match the middle of a word.
- **Compound words match however they're written.** Hyphenated words are indexed split and joined, and so is each pair of neighbouring words, so "check-up", "check up" and "checkup" all find both the "Check-Up" titles and the "Health Check Up" category.
- **Searched fields:** service title, provider name, category and subcategory.
- **Every word must match** somewhere.

### The URL

```
/services?q=thyroid&type=package,lab_test&category=package.ultrasound&sub=package.ultrasound.thyroid
         &provider=48,100&country=NP&city=TH.bangkok&currency=THB&min=1000&max=5000&home=1
         &sort=price-asc&page=2
```

- **Canonical.** There is one fixed key order, lists are sorted, defaults are omitted, and commas are left unescaped so links stay readable. The same view always gives the same URL, and a non-canonical URL is tidied with `replaceState`.
- **Discrete changes push** a history entry; **typing replaces** within a burst. Back undoes a whole search, not one letter.
- **No lost clicks.**
  - Next.js updates `useSearchParams` in a transition, so during a burst of clicks React state can be a step behind the address bar.
  - Every change is therefore an *updater* (`(current) => next`), applied to the filters in `window.location` at that moment plus the search box's live text. It is never built from possibly stale props.
  - The same applies to the corrections (canonical form, removed values, page clamping).
  - E2E tests prove it under 4× CPU throttling: two quick clicks both land, and typing then sorting keeps the search.
- **Stale or hand-edited links degrade.** Malformed values are dropped while parsing. Values the data doesn't know (a provider that left, `page=999`) are removed or clamped, with a toast that names what was removed.
- **No flash of an unfiltered list.** The explorer reads the URL inside `<Suspense>`, so the prerendered shell is a skeleton. The first client render already uses the URL's filters, and an e2e test watches every heading the page ever renders.
- **Providers are identified by numeric id**, because their slugs are inconsistent in the data (see below).

### Categories and the two "ultrasound"s

A category key is `type.slug` (`package.ultrasound` vs `lab_test.ultrasound`), because a slug is only unique within its type.

A subcategory key includes its parent: `lab_test.blood-tests.thyroid`. "thyroid" is a child of **three** different parents.

In the filter, categories are grouped under their service type. The chips and the remove-filter labels disambiguate duplicates as "Ultrasound (Lab tests)".

Choosing a category reveals its subcategories, which narrow within that category only. Narrowing package-ultrasound doesn't narrow lab-test-ultrasound.

---

## What I did with the data's mistakes

Every decision below is recorded at load time as a `DataIssue`. You can check it in the **Data quality report** under the results, and the tests in `catalog.test.ts` assert it.

| Found in the data | What the customer sees | Why |
| --- | --- | --- |
| **Vitamin D Test**: amount discount 600.00 on a 450.00 price, so the final price would be −150.00 | "Price on request". Excluded from price filters and listed last when sorting by price. | Never show a negative price. Clamping to 0 would advertise it as free, and guessing (60.00? 6%?) would invent a price. Flagged for the provider. |
| **Free Dental Consultation** at 0.00 | "Free" | A legitimate price, not missing data. |
| Title `"  hba1c   TEST (Diabetes) "` | "hba1c TEST (Diabetes)" | Whitespace is trimmed and collapsed. Casing is left as typed, because auto-casing would break HbA1c, BRCA1/2 and IgE. Search finds it either way. |
| **"Seasonal Offers"** has `status:false` but is still returned by `/category/active`. It has 46 services, 41 of which would otherwise be visible. | Hidden, with its services | Visibility rule 3. The client checks status even on an endpoint named "active". |
| 2 **inactive providers** (161, 162) with 108 otherwise-live services | Hidden | Visibility rule 2. |
| 198 services with `status:false` | Hidden | Visibility rule 1. |
| 22 services **without a category** (20 visible) | Shown; found by search and other filters, not under a category | The rule says "if it has one". |
| Two top-level **`ultrasound`** slugs; **`thyroid`** under three parents | Distinct options, labelled by type | Keys include type and parent (see above). |
| 5 providers with **`rating: null`, 0 reviews** | "New on MedEx · no reviews yet" | Not "0 stars". Average for relevance, last for "Highest rated". |
| **Slug mismatch**: `username: monsoon-spa-and-retreat` vs `slug: monsoon-spa-retreat` (2 providers) | Nothing | URLs use numeric provider ids. |
| **Golden Mile International Hospital**: active, no services | Not in the provider filter | It could only lead to an empty page. |
| 31 visible services (39 in the file) where discount + charge ⇒ final > `price` | Struck-through price includes the charge | See "The final price". |
| 25 final prices exactly on a half-cent | Correct half-up rounding | Exact decimals, rounded once. |
| 645 cases among visible services (747 in the file) of the **same title twice at one provider** | Both shown | Different ids, and often different prices or durations. Merging would hide real options. Worth deduplicating at the source. |
| Titles that don't fit their category (e.g. "Physiotherapy" under Vaccination › Travel Vaccines) | Shown as entered | Can't be fixed reliably on the client. Belongs in a data-quality job upstream. |
| Defensive cases not in this file: unknown type/provider/category, unparseable money, unknown discount type, wellness without valid durations, duplicate durations, out-of-range ratings, home test without a fee | Skipped, hidden or "Price on request", each with an issue recorded | The data is hand-entered, so the next file will have new mistakes. Unknown category ⇒ hidden: if we can't confirm it's active, we fail closed. |

---

## Performance

**Budget:**

- a filter change updates results and counts within about 100 ms;
- typing never blocks;
- no layout shift.

**What I did:**

- **Single-pass engine:** about 1 ms for 3,200 services.
- **Only the search text is deferred** (`useDeferredValue`), so a click renders once and a keystroke paints first.
- **React Compiler** on, plus a stable filter-panel handler, so typing skips the filter panel and the results.
- **Native inputs** for the ~60 facet checkboxes and radios.
- **Price popovers mount on first open.**
- **A native two-thumb range slider.** Radix's slider measured the DOM on mount and forced a page-wide reflow.
- **Memoised Tailwind class merging.** It was about 25% of the JavaScript time.
- **Result cards keyed by position**, so updates patch text rather than rebuild the DOM.
- **Skeletons shaped like the content**, `scrollbar-gutter: stable`, and a filter-chip row that keeps its height.

**How I measured.** I used `pnpm perf` (`e2e/performance.spec.ts`) on a production build, with Chromium and real mouse and keyboard input:

- **Filter → painted** is timed from the click event's timestamp until the result count changed and the next frame painted.
- **Typing** uses the browser's **Event Timing API**: each keystroke's input → next paint.
- **Layout shift** uses the **Layout Instability API**.

During the work I also used Chrome traces and CPU profiles (`next build --no-mangling`) to find the hot spots.

**Results.** The machine is an AMD Ryzen 5 7235HS laptop, which is itself mid-range hardware. 2× and 4× rows use Chrome's CPU throttling.

| | 1× (this laptop) | 2× slower CPU | 4× slower CPU |
| --- | --- | --- | --- |
| Filter → results painted (5 different filters) | 33–68 ms | 61–122 ms | 108–259 ms |
| Worst keystroke → next paint | 32 ms | 32 ms | 96 ms |
| Keystrokes over 50 ms (of ~100) | 0 | 0 | 1 |
| CLS (layout shift not caused by input) | 0.000 | 0.000 | 0.000 |

The checkbox itself paints its new state in about 3 ms, because it's a native control. The rest of the time is React rendering in 5 ms slices (Next.js runs `pushState` updates as a transition), plus layout and paint.

**Honest caveats:**

- The first filter that reveals the price-range controls is the slowest case.
- On a 2× slower machine the worst filter changes go past the budget.
- Moving facet computation server-side and virtualising nothing (pages are 10 cards) would be my next lever, along with fewer Radix components per card.
- Layout movement *right after a click* (cards changing height as results change) is 0.13 in raw layout-shift score. It isn't counted as CLS, because it follows the user's input.

---

## Accessibility

**Keyboard**
- Every control is a native input or a real button or link, so everything works without a mouse.
- Pagination items are real `<a href>` links: shareable, and open in a new tab.
- **Escape** clears the search box.
- Focus is managed:
  - "View all" moves focus to the first revealed service;
  - removing a chip moves focus to the next chip, or to the results heading when none are left;
  - changing page focuses the results heading;
  - the error state focuses its heading;
  - dialogs and the drawer trap focus and restore it on close.

**Screen readers**
- Result-count changes are announced through one app-wide polite live region, debounced so typing doesn't spam ("38 services from 5 providers.").
- Each filter is a `fieldset`/`legend`, and category groups are labelled by type.
- Options read as "Lab tests, 1,155 results".
- Prices are announced as one sentence: "THB 1,845.00, reduced from THB 2,460.00".
- Ratings are announced as "Rated 4.7 out of 5 from 1,203 reviews".
- The struck-through amounts and icons are hidden from assistive tech.

**Contrast and touch**
- Text meets WCAG AA (4.5:1) in light and dark. The ratios are noted in `globals.css`. Focus rings are at least 3:1.
- Touch targets are 44 px on touch screens, the small ⓘ and **Clear** buttons included.
- `prefers-reduced-motion` is respected.
- A skip link is provided.

**Not yet audited** with a real screen reader (NVDA or VoiceOver) end to end. The e2e test checks the live-region text and keyboard flows only.

---

## Assumptions

- **Counts are services, not providers.** The heading says both: "7 services from 2 providers".
- **Pages are pages of provider cards**, 10 per page.
- **Price bounds are whole currency units, inclusive,** compared with the displayed (rounded) final price.
- **"View all N" expands inline** and isn't stored in the URL. The brief lists filters, sort and page as URL state.
- **The comparison is a working selection,** so it's kept in session storage rather than the URL.
- **An inactive *subcategory* hides its services**, like an inactive category would. The file has none.
- **City or country is one OR-ed filter.** Ticking a country selects all its cities; unticking one city of a ticked country keeps the others.

## Left out, and what I'd do next

- **Server-side search and facets** (see "Why filter on the client?") and SSR of the first results page for SEO and first paint.
- **Synonyms and typo tolerance** ("checkup" ⇄ "health check", "thyorid"). Matching is prefix-only today.
- **Provider detail pages:** "View all" would deep-link to `/providers/:id?…filters`.
- **A real screen-reader pass,** and an axe check wired into the e2e suite.
- **Data quality upstream:** the issues listed in the report would make a good provider-facing "fix your listing" queue.
- **Visual regression tests** for the card and price states.
- **Two screen-reader details:** the drawer's "Show N results" count is read when the button is focused rather than announced as it changes, and after **Try again** succeeds nothing takes focus.

## Tests

- **Unit tests (Vitest, 69):**
  - the price formula and its edge cases (negative, free, unparseable, mid-calculation rounding, like-for-like strike price);
  - catalog cleaning against the real data (visibility counts, ultrasound and thyroid keys, unrated providers, malformed records);
  - the URL codec (round-trip, canonical form, junk tolerance, stale-value sanitising, emoji-safe truncation);
  - the country/city tree (absorbing, splitting and collapsing selections);
  - the engine (brute-force facet counts, ultrasound, price filter across currencies and wellness durations, sorting, search, empty-state counts, pagination);
  - the discount badge (it must agree with the two prices shown);
  - money formatting and rounding.
- **E2E (Playwright, 15):** see [`e2e/explorer.spec.ts`](../e2e/explorer.spec.ts) and [`e2e/mobile.spec.ts`](../e2e/mobile.spec.ts). Plus `pnpm perf`.
  - Five of them are regression tests for issues found in a code review: lost clicks under CPU throttling, the search dropped by a quick sort, chip-removal focus, unnamed filter groups, and a long search with an emoji crashing the page.

### Found in a final check against the brief

Before submitting, the app was checked line by line against the brief (an agent per exercise, each finding then verified by hand). Fixed:

- **"checkup" and "check-up" missed the "Health Check Up" category**, which is written as two words: 232 results instead of 253 for the story's own wording. Neighbouring words are now also indexed joined (unit test).
- **"30% off" sat next to prices 28.9% apart.** With a percentage discount and a fixed service charge (231 of the 1,515 discounted prices), the badge and the struck-through price didn't agree. The badge now gives the difference when the percentage doesn't match (unit tests).
- **The mobile drawer listed the filters by hand**, so a new filter would compile but be ignored there. It now takes them from the defaults.
- **The brute-force facet test checked 6 sample providers.** It now checks all of them.
- **Extra-small buttons (ⓘ, Clear) were 24 px on touch screens, and focus rings on native checkboxes, radios and slider thumbs were about 2:1.** They're now 44 px and at least 3:1 (shared foundation).
- **This README:** statements that had drifted from the code, and how to see the partial-failure state.

## AI tools

This exercise was built with **Claude Code** (Anthropic's AI coding agent) working under my direction:

- **I set:** the stack (Next.js, shadcn/ui, Tailwind, Zustand, React Hook Form) and the branch structure.
- **The agent:**
  - profiled the JSON to find the data problems,
  - proposed and implemented the architecture,
  - wrote the code, unit tests and e2e tests,
  - drove a headless browser to check each state,
  - profiled and optimised the performance,
  - drafted this README;
  - checked the finished app against the brief and fixed what it found ([Found in a final check against the brief](#found-in-a-final-check-against-the-brief)).
- **A second agent** reviewed the finished code adversarially. Its 10 findings were verified and fixed, each with a regression test where one could be written:
  - stale-state URL writes losing clicks,
  - an emoji truncation crash,
  - unnamed filter groups,
  - chip focus,
  - a city-toggle edge case,
  - fractional slider steps,
  - card expansion after reordering,
  - a chatty live region,
  - non-canonical URL checks,
  - two README counts.

<!-- TODO(author): before submitting, describe your own review, the changes you made, and anything you'd decide differently. You'll be asked to explain and extend this code live. -->
