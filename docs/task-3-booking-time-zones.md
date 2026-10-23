# MedEx: Task 3, Appointment booking across time zones

> "I live in Kathmandu. I'm booking a check-up at a hospital in Bangkok for when I travel there next month. Which time is the appointment, mine or theirs?"

A date and time picker for booking an appointment with a provider in another time zone. It covers choosing a specialist, booking for up to four people, and rescheduling an existing booking.

**The answer to the customer's question, everywhere on the page:** every time is the provider's ("10:40 AM Thailand time"), because that's the clock the customer has to be there by. Their own time is shown under it, labelled "your time", with "next day" when it falls on a different date for them.

> This is the README of the `task-3-booking-time-zones` branch, where this exercise lives on its own on top of the shared foundation from `main`. On `dev` all three exercises run in one app and it applies as written, except: the bookable-provider list is `GET /api/booking/providers` (`/api/providers` is Task 1's list), and **Reset demo bookings** is `POST /api/demo/reset?scope=booking`. Also, `pnpm test` and `pnpm e2e` run every exercise's tests (see the main [README](../README.md)), and the header's animated logo loops even when the device asks for reduced motion.

---

## Run it

```bash
pnpm install && pnpm dev          # → http://localhost:3000/book
```

You need Node 20.9+ and pnpm 10.

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build && pnpm start` | Production build |
| `pnpm test` | 75 booking unit tests (Vitest): time zones, slot rule, availability, two clocks, group runs, confirm outcomes, the mock server's booking logic |
| `pnpm e2e` | 15 booking flows in Playwright (14 desktop, 1 phone) against a production build, plus the shell smoke test |
| `pnpm check` | Typecheck, lint and unit tests |

Playwright needs a Chromium. Run `pnpm exec playwright install chromium`, or point `PLAYWRIGHT_CHROMIUM_PATH` at one you already have. The e2e tests pin the browser's zone to `Asia/Kathmandu` (the brief's customer), and one test to `Asia/Bangkok`.

### Try every scenario

The failures are driven from the **Mock API** button in the header. Its **Demo data → Reset demo bookings** action restores the fixture's booked slots and the existing booking.

| Scenario | How |
| --- | --- |
| The brief's story | Open `/book/48` (Riverside, in Thailand). Your device's zone is detected; press **Change** on "Your time" to pretend you're in Kathmandu. |
| Someone else got there first (409) | `POST /api/bookings` → **Fail once** + **HTTP 409**, then book any time. The slot really is taken on the server, so the grid shows it booked. |
| The reply never arrives | `POST /api/bookings` → **Fail once** + **Booking made, reply lost**. The server books it, then holds the reply past the browser's 12 s timeout. |
| Server error / dropped connection | `POST /api/bookings` → **HTTP 500** or **Network error** |
| The times won't load | `GET /api/providers/:id/slots` → **Fail always** (the calendar: `…/availability`). Then switch back to **Works** and press **Try again**. |
| Slow network | Network speed **Slow 3G** or **Very slow** |
| Offline | **Simulate offline** |
| Reschedule | `/bookings/BK-20261008-0042/reschedule` (also linked from `/book`) |
| Late evening, after midnight for you | `/book/131` (India) with your zone set to Bangkok, or `/book/121` (Nepal) with it set to Tokyo |
| A group | Choose 2–4 people on any provider |

---

## What's built, against the brief

| # | Requirement | Where / how |
| --- | --- | --- |
| 1 | 90-day calendar; past, closed (weekly or closure) and full days visibly unavailable, with the reason | `BookingCalendar`. Every day's accessible name includes its reason ("Closed on Sundays", "Closed: Public holiday", "Fully booked", "No 3 back-to-back times", "Outside opening hours", "In the past", "Bookings open 90 days ahead"). Sighted customers see it on hover or tap, in the line under the grid; on a day when the specialist's hours miss opening hours altogether, the day's tooltip gives the full sentence. Closed days are hatched, days with no free times struck through, and past days and days beyond the window faded, so colour isn't the only signal. A legend names each. |
| 2 | Two clocks: provider's time first, the customer's alongside, never confusing | [Two clocks](#two-clocks) |
| 3 | Slots grouped (morning, afternoon, evening); booked ones visible but not selectable | `SlotListbox`. One listbox per specialist, with period groups. Booked times are struck through and labelled "Booked". |
| 4 | Today: slots that have started are unavailable, by the provider's clock | The server's clock, sent with the provider, slots and availability responses, decides "now"; it is read on the provider's wall clock and re-checked every minute while the page is open. [Today and the edges of the day](#today-and-the-edges-of-the-day) |
| 5 | Specialists narrow the slots; consultation hours outside opening hours are explained | `SpecialistPicker` (each card shows the specialist's hours and next free day). Under the slots: "Dr. N. Rana sees patients 6:00 PM – 9:00 PM, but the provider closes at 8:00 PM on Mondays, so only 6:00 PM – 8:00 PM can be booked." |
| 6 | Group bookings: up to 4 people, N consecutive free slots with the same specialist; only possible starts offered | [Group bookings](#group-bookings-and-buffers) |
| 7 | 409: keep everything, explain, offer the closest alternatives | [Confirming safely](#confirming-safely) |
| 8 | Reschedule from `existingBooking`, old → new unmistakable | `/bookings/:id/reschedule`. A "From (current)" card, struck through once a new time is chosen, then "To (new)", plus "2 days earlier, 1 h 20 min earlier in the day". The button says "Move to Fri 23 Oct, 10:00 AM". |
| 9 | Skeletons for calendar and slots; empty days and dead-end specialists explained with a way forward; retry keeps selections; slow and offline clear; never confirm an unknown result | [States](#states) |
| 10 | Keyboard and screen readers for calendar and slot grid | [Accessibility](#accessibility) |
| 11 | Unit tests for the time-zone and slot logic, including the awkward cases | [Tests](#tests) |

---

## Every time zone in the file

`timezone` is free text typed by the provider. `domain/timezone.ts` → `resolveProviderZone()` reads it in this order:

1. trim it;
2. a valid **IANA name**;
3. an **offset** in any common spelling (`UTC+05:45`, `GMT+5:45`, `(GMT+5:45)`, `+0545`). If it agrees with the country's zone at that moment, use the country's IANA zone, so a future rule change in that country is followed. Otherwise use a fixed offset.
4. a **Windows zone name** (a small table of the region's zones);
5. otherwise, the **country's zone** (TH, NP, IN).

| Provider | Stored value | Read as | Customer sees |
| --- | --- | --- | --- |
| Riverside International Hospital (TH) | `"Asia/Bangkok"` | Asia/Bangkok | nothing extra |
| Lumbini Polyclinic (NP) | `"Asia/Katmandu "` | Asia/Kathmandu (old spelling, trailing space) | nothing extra: it's a valid name |
| Himal Neo Clinic (NP) | `" UTC+05:45"` | Asia/Kathmandu (offset matches NP) | "Their time zone is listed as “UTC+05:45”, which we read as Nepal time (UTC+5:45)." |
| Pashupati Medical Centre (NP) | `"(GMT+5:45)"` | Asia/Kathmandu (offset matches NP) | the same kind of note |
| Annapurna Diagnostics (NP) | `"Nepal Standard Time"` | Asia/Kathmandu (Windows name) | the same kind of note |
| Aravali Hospital (IN) | `""` | Asia/Kolkata (country fallback) | "They haven't listed a time zone, so we're using India time (UTC+5:30), from their country." |

The note is shown wherever we *interpreted* the value, so a customer (or support) can spot it if we read it wrong.

Three details:

- **ICU reports `Asia/Kathmandu` as `Asia/Katmandu`**, its canonical name. Comparisons map it back to the modern spelling.
- **A zone's city isn't the provider's location.** Lumbini Polyclinic is on "Asia/Kathmandu" but isn't in Kathmandu, and the data only has a country. So a provider's clock is named by its country ("Nepal time", "Thailand time", "India time") whenever it's that country's zone, and by the zone's own name otherwise. The customer's clock keeps its city ("your Kathmandu time"): that comes from their own device.
- **Offsets aren't timeless.** Nepal was UTC+5:30 until 1986. So offsets are always computed for a real moment, never for "epoch 0": each slot's own date for the second clock, and today when reading an offset a provider typed in.

## Two clocks

- **The provider's clock comes first, labelled with its place.**
  - At the top: two live clocks, "Appointment time · Thailand" and "Your time · Kathmandu".
  - Under them, in bold: **All times are Thailand time**, the time at Riverside International Hospital. Thailand is 1 h 15 min ahead of you; your Kathmandu time is shown under each one.
- **Every bookable time chip has both.** "10:40 AM", then a person icon and "9:25 AM". A screen reader hears "10:40 AM Thailand time, 9:25 AM your time in Kathmandu" (booked and started chips say "Booked" or "Started" visually; their spoken name still has both times).
- **The day can differ.** For a customer in Bangkok, Aravali's 11:00 PM (India) is "12:30 AM · next day". Summaries spell it out: "12:30 AM, Sat 21 Nov your time".
- **One clock when one is enough.** If the customer's clock reads the same as the provider's (a Kathmandu customer at Lumbini), each time is shown once, without a second "your time" under it, and the page says so: "Nepal time is the same as yours". Both clocks stay at the top.
- **The customer's zone is changeable.** It's detected from the device. Someone planning from abroad can pick another from the list (all IANA zones); it applies as they move through the list, **Done** closes it and returns focus to **Change**, and the choice is remembered.
- **Daylight saving is handled per slot.** The customer's time is computed for each slot's own date, so a London customer sees the right time on both sides of 25 October.
- **The confirmation page** repeats it: "Please arrive by Thailand time. Your phone may show a different time if it's still set to Kathmandu."

## Today and the edges of the day

- **Dates and times are plain values, not JavaScript `Date`s.** A date is `"2026-10-27"` and a time is minutes after midnight on the provider's wall clock. A booking is "27 Oct, 10:40 at Riverside", which is what the API sends. Instants only appear when converting for the second clock.
- **"Today" is the provider's today.**
  - `dayOffset` 0 is converted to a date when the mock server starts, separately for each provider, from that provider's today. At 11:00 PM in Kathmandu it's already tomorrow in Bangkok, so their "today" can differ.
  - The calendar starts on the provider's today, and the 90-day window is that day plus 89 (today counts as day 1).
  - The provider's today is part of the calendar's cache key, so a page left open past the provider's midnight moves the window on by itself.
- **"Now" comes from the server, not the device.**
  - The provider, slots and availability responses carry the server's time (`now`). The client keeps its offset from the device clock, so a wrong device clock doesn't matter. Until one of them has arrived (the provider list on `/book`), the device clock stands in.
  - A slot that has *started* by the provider's clock is unavailable ("Started"). This is re-evaluated each minute while the page is open, so a slot can't be booked after it starts just because the page was loaded earlier.
  - The server checks it again when booking (409 `SLOT_UNAVAILABLE`).
- **Late-evening slots** (Aravali 9:00–11:30 PM IST, Lumbini 8:00–10:30 PM NPT) are "evening" on the provider's clock and say "next day" for customers far enough east: Aravali's from Bangkok, Lumbini's from Tokyo.
- **When today is over,** the day says "No times left today", with the provider's current time ("It's already 10:19 PM there (Thailand time), and the rest of today's times have started or are booked."), and offers the next free day.

## The slot rule

`domain/slots.ts` → `planSlots()`:

- Slots start at `consultation.startTime` and repeat every `durationInMinutes + bufferInMinutes`.
- The last slot is the last one that still *ends* by `consultation.endTime`.
- A slot is offered only if it lies entirely inside that day's opening hours (start ≥ opening, end ≤ closing). The buffer after a slot doesn't need to fit; it's the specialist's turnaround, not the patient's time.
- The grid is always anchored at the consultation start, even when the first slots fall before opening. Dr. Chaiyaporn (7:00–12:00, 45 + 15) is offered 8:00, 9:00, 10:00 and 11:00, never "8:00, 9:00 shifted to opening".
- Slots outside opening hours are kept as `outsideHours`, which is what the explanation is built from.

### Group bookings and buffers

- A booking for N people takes **N consecutive slots on the grid** with the same specialist: each person has their own appointment, back to back, with the normal buffer between them.
  - Dr. Wongsakul (30 + 10) for 3 people from 10:00 is 10:00, 10:40 and 11:20. It finishes at 11:50, and the summary says so.
  - "Consecutive" means neighbouring grid indices, not "no gap in time". A gap that's just the buffer is the normal spacing. A slot missing because it falls outside opening hours breaks the run.
- Only starts with N free slots in a row are offered. Others are shown as "Not 3 in a row" (spoken: "free, but there aren't 3 free times in a row from here").
- Choosing a start highlights the following N−1 times as "included in your group booking".
- If a day has free times but no run long enough, it says so ("No 3 back-to-back times on Mon 26 Oct") and offers the next day that has one.

## Confirming safely

`hooks/use-confirm.ts`, `state/confirm-attempt.ts`, `domain/confirm.ts`.

- **One idempotency key per attempt.** `POST /bookings` carries an optional `idempotencyKey`. The server stores its first definitive answer per key (201 or 409; a 500 decided nothing and isn't stored) and replays it. Reusing a key for a *different* booking gets a 422.
- **Every failure is classified for the customer:**
  - **taken** (409): someone else got it. Nothing was booked.
  - **failed** (500, or offline before sending): nothing was booked; try again.
  - **unknown** (dropped connection, timeout, unreadable reply): it *may* have been booked.
  - Once an attempt has been unknown, **only the server's decision settles it** (a booking, a 409 or another 4xx). A 500 or being offline while checking proves nothing about the first send, so it stays unknown and locked. Treating that 500 as "nothing was booked" would have let the customer book a second time.
- **An unknown result locks everything.**
  - "We don't know yet if it went through". The choices are disabled ("so you can't book twice by accident") and the confirm button is disabled.
  - **Check now** re-sends *the same request with the same key*. The server returns the booking it already made, or makes it now. It never makes a second one, and never answers a 409 against itself.
  - It's re-checked automatically when the connection comes back.
  - The attempt is kept in sessionStorage, so a reload mid-request still knows it's unresolved and restores the choices that were sent. Its own time isn't called "booked by someone else" meanwhile: it may well be theirs.
- **409 keeps everything.**
  - The specialist, group size and date stay chosen. The taken time is struck through in the summary: "10:40 AM was just taken. Nothing was booked, and everything else you chose is kept."
  - Focus moves to that message.
  - The slots are refetched, and the **closest free times** (same specialist; any specialist if they chose "Any") are offered as buttons. Picking one moves focus straight to the confirm button. If that day has nothing left, it offers the next free day.
- **Offline:** choosing still works from what's loaded, but the confirm button is disabled: "You're offline. Reconnect to confirm; your choices are kept."
- **Never against a guess.** A time can only be confirmed once that day's slots have loaded, so a time carried in the URL is always checked first. If they fail to load: "We couldn't load this day's times, so we can't check this one is still free."
- **A 409 for a time that's gone rather than taken** (it started while they were deciding) says "10:40 AM can't be booked any more" instead of blaming someone else.
- **Rescheduling** (`PUT /bookings/:id`) is idempotent by nature: moving to where it already is returns 200. So the same "unknown → check again" path is safe.

## States

- **Loading:** skeletons shaped like the page, the calendar and the slot grid. After 2.5 s the calendar and slot-grid skeletons add "Still loading. The connection seems slow…"; offline, they say straight away "You're offline. This will load as soon as you're back online."
- **Updating:** changing the specialist or group size keeps the old calendar on screen, faded, with "Updating…", instead of flashing skeletons.
- **A day with nothing to book:** one sentence on why, then a way forward:
  - closed on Sundays, a closure ("Reason given: Public holiday."), fully booked, today over, or no run long enough for the group;
  - each offers **Next free day: …**.
- **A specialist with nothing in 90 days:** their card says "No free times in the next 90 days" *before* it's chosen. Choosing them anyway offers the other specialists with their next free day.
  - None of the fixture's specialists is in this state, even for a group of 4, so this path is covered by reading the code rather than by a demo.
- **Partial failure:** the calendar and the times load separately. If one fails, it shows its own error and **Try again**; everything else, and every choice made, stays.
- **Slow confirm:** "Booking…", and after 3 s "Still waiting for Riverside International Hospital's booking system… please keep this page open."
- **Offline:** the site banner, plus the confirm button's reason.

## Accessibility

- **Calendar: an ARIA grid (the APG date-picker pattern).**
  - One tab stop. ←/→ move by day, ↑/↓ by week, Home/End to the week's ends, PageUp/PageDown by month, Enter or Space chooses.
  - Unavailable days stay focusable and are `aria-disabled`, so a screen reader hears why ("Sunday, 25 October 2026, Closed on Sundays"). Today is `aria-current="date"`.
  - The month heading is a polite live region.
- **Slots: a single-select listbox per specialist, with period groups.**
  - One tab stop per specialist. ←/→ step through the times; ↑/↓ move to the row above or below as laid out on screen, at any width; Home/End; Enter or Space chooses. Selection doesn't follow focus, so arrowing through times doesn't change the booking.
  - Booked and started times stay focusable (`aria-disabled`) and are announced as such.
  - Choosing a time is announced: "Chosen: 10:40 AM Thailand time, 9:25 AM your time, with Dr. A. Wongsakul." When the customer's date differs, it's included ("12:30 AM, Sat 24 Oct your time").
- **Pickers:** specialists and group size are native radio groups with legends.
- **Focus:** after a 409 or an unknown result, focus moves to the message. After choosing an alternative, focus moves to the confirm button.
- **Phones:** once a time is chosen, a sticky bar shows it (both clocks) with **Review**, hidden while the summary is on screen. Buttons and options are at least 44 px on touch screens, small buttons included. Calendar days are 44 px tall but narrower on small phones (about 30 px on a 320 px screen), above WCAG 2.2's 24 px minimum.
- Contrast is AA in both themes, and focus rings are at least 3:1. Reduced motion is respected.

## Stack and why

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router), React 19, TypeScript | MedEx's stack. Route handlers make the mock API with no extra tooling. |
| Dates and time zones | **No date library:** `Intl.DateTimeFormat` with IANA zones, plus plain values (`"2026-10-27"`, minutes after midnight) | The data is wall-clock times at the provider. Plain values can't drift into the device's zone the way a JavaScript `Date` can, and `Intl` already knows every zone and its history. |
| UI | **shadcn/ui** on Radix + **Tailwind CSS 4** | Accessible primitives (dialogs, popovers, focus handling) whose code we own. The calendar and the time grid are hand-built ARIA widgets (a grid and listboxes), so the two clocks, the reasons and the keyboard model fit exactly. |
| Server state | **TanStack Query** | Caching, retries, offline pausing, and keeping the old calendar on screen while a new one loads. |
| The customer's choices | **React Hook Form**, mirrored into the URL | A form, submitted once. In the URL, a reload, a failed request or a 409 never loses it. |
| Client state | **Zustand** | Small stores read outside React: the server-clock offset, the customer's zone, an unanswered confirm. |
| Validation | **Zod** | Lenient parsing of API responses at the boundary. |
| Tests | **Vitest**, **Playwright** | Unit tests for the time-zone and slot logic; browser tests for the flows. |

## Architecture

```
data/task3-booking.json ── src/server/booking/store.ts  (in-memory: providers, taken slots, bookings, replies per key)
                             │  dayOffsets → dates at start-up, per provider's today
                             │  logic.ts: slotsFor · availabilityFor · createBooking · moveBooking   (unit-tested)
                             ▼
   /api/booking/providers · /api/providers/:id · /:id/slots · /:id/availability · /api/bookings · /api/bookings/:id
                             │  (withMockControls: latency + on-demand failures)
                             ▼
features/booking/api/client.ts   lenient Zod parsing → normalizeProvider() (the same code the server uses)
     │
     ├── TanStack Query: provider · availability (90 days) · slots (one day, all specialists) · booking
     ├── React Hook Form: the customer's choices (specialist, people, date, time) ⇄ the URL
     ├── Zustand: server-clock offset · customer's zone [localStorage] · unanswered confirm [sessionStorage]
     ▼
domain/  plain-date · timezone · slots · availability (describeDay) · two-clocks · alternatives · confirm   (pure, unit-tested)
components/  booking-flow (one flow for book + reschedule) · booking-calendar · slot-listbox · booking-summary …
```

### Where state lives

| State | Lives in | Why |
| --- | --- | --- |
| Provider, availability, slots, booking | **TanStack Query** | Server state: caching, retries, offline pausing. Changing the group size keeps the previous calendar while the new one loads. |
| The customer's choices | **React Hook Form**, mirrored into the URL | It's a form, submitted once. In the URL, a reload, a failed request or a 409 never loses it, and a link can be shared. |
| "Now" | **Zustand** `server-clock`: the offset from the device clock | Read outside React by the API client; one shared minute ticker. |
| The customer's time zone | **Zustand** `customer-zone`, persisted | A preference for this device. |
| An unanswered confirm | **Zustand** `confirm-attempt`, sessionStorage | Must be written *before* the request goes out and survive a reload, so the same key is reused. |
| Everything else (what's bookable, why not, group runs, alternatives) | **Derived on render** with `describeDay()` | One pure function the server and client share, so they agree. |

### Mock API

| Endpoint | Notes |
| --- | --- |
| `GET /api/providers/:id` | The provider as stored (time zone exactly as typed), closures as dates, and `now` |
| `GET /api/providers/:id/slots?date=&specialistId=` | The brief's shape: `{ date, slots: [{ specialistId, startTime, endTime, isBooked }] }`. The client asks for all specialists at once and filters, so switching specialist doesn't refetch. |
| `GET /api/providers/:id/availability?specialistId=&people=&exceptBooking=` | *Not in the brief:* the 90 days at a glance, each with its status and reason, plus each specialist's next free day. Without it the calendar would need 90 slot requests. |
| `POST /api/bookings` | 201 `{ bookingId, booking }` · 409 `SLOT_TAKEN` / `SLOT_UNAVAILABLE` · optional `idempotencyKey` |
| `PUT /api/bookings/:id` `{ date, startTime }` | 200 · 409. The specialist and group size stay as booked. |
| *Extras:* `GET /api/booking/providers`, `GET /api/bookings/:id`, `POST /api/demo/reset?scope=booking` | Provider list, the reschedule flow's starting point, reset |

**Failures act like real ones.**

- **409** first books the slot for "someone else", so a refetch really shows it taken.
- **"Booking made, reply lost"** books it and then holds the reply until the browser gives up.
- **500** fails before deciding anything.
- **Network error** never reaches the server.

## What I found in the data

| Finding | What the customer sees |
| --- | --- |
| Five of six time zones aren't clean IANA names (see the [table](#every-time-zone-in-the-file)) | Read as described; a note where we interpreted |
| **`existingBooking` isn't in `bookedSlots`** | Its slot is still occupied: occupancy is computed from the bookings themselves, not only from `bookedSlots` |
| **`existingBooking` can land on a day the provider is closed.** It's `dayOffset: 3` from Riverside's today, so whenever today is a Thursday it falls on a Sunday. | The booking still stands. The reschedule page says "Your current appointment is on Sunday, 25 October 2026, but Riverside International Hospital's listed hours say it's closed that day. Your booking still stands; you may want to move it or check with them." |
| **Dr. N. Rana (6–9 PM) works past closing**: 8 PM Mon–Thu, 5 PM Fri, 1 PM Sat | 6:00–7:40 PM bookable Mon–Thu; nothing Fri/Sat. Each day says why: under the time grid, and in the calendar, where those days say "Outside opening hours" and their tooltip gives the full sentence ("…but on Fridays the provider is only open 8:00 AM – 5:00 PM, so there are no times to book.") |
| **Dr. P. Chaiyaporn (7 AM–12 PM) starts before opening** (8 AM; 9 AM Sat) | The 7:00 slot (and 8:00 on Saturdays) isn't offered; explained |
| **Late-evening hours** cross midnight for customers far enough east of the provider | "next day" on the second clock |
| `dayOffset`s count from each **provider's** today, which differs between providers near midnight | Converted per provider at server start |
| **Three bookings at 7:00 AM with Dr. Chaiyaporn** (`dayOffset` 2, 9 and 15), before Riverside opens | Ignored: 7:00 is never offered, so they block nothing. A real system would flag them for the hospital to check |
| **14 bookings on closure days**: 10 at Himal Neo Clinic on its "Staff training day" (`dayOffset` 4), 4 at Riverside on its public holiday (`dayOffset` 12) | The closure wins: the day shows as closed, with its reason. Those bookings are left for the provider to sort out with the customers |
| **Booked slots only cover the first 30 days** (`dayOffset` 0–29) | Days 30–89 look wide open. Fine for a fixture, and nothing in the code assumes it |
| Otherwise the booked slots are all on their specialist's grid, with no duplicates (checked) | — |

## Assumptions

- **The window is 90 days including today** (today + 89), on the provider's calendar.
- **Times on the hour boundary:** a slot that has started at exactly its start minute counts as started. A slot ending exactly at closing time is inside opening hours.
- **"Any specialist" is the default.** The brief's specialists have different specialities, so with "Any" the times are listed per specialist, never merged into one anonymous list.
- **Rescheduling keeps the specialist and the group size**, because `PUT` only takes `date` and `startTime`. To see someone else, the customer makes a new booking (the page says so).
- **A 500 from the booking API means nothing was booked.** That's this mock's contract (only definitive answers are stored per key). A real API that can fail after writing would need 500s treated as "unknown" too, which the code supports by changing one line in `classifyConfirmFailure`.
- **Times use the 12-hour clock** ("10:40 AM"), always with the place named next to them. It's one formatter (`formatClock`), so a 24-hour preference would be a small change.

## Left out, and what I'd do next

- **A screen-reader pass with NVDA and VoiceOver**, plus axe checks in the e2e suite. The roles and labels are tested, but not with real assistive technology.
- **An "Add to calendar" (.ics) file** with the provider's `TZID`, so the customer's phone shows it correctly wherever they are.
- **Cross-tab locking for an unanswered booking.** It's per tab (sessionStorage). A second tab could book a different time while the first is unresolved; Task 2's Web Locks runner would cover it.
- **Cancelling**, and choosing a different specialist when rescheduling (needs API support).
- **A specialist with nothing in the 90 days** says so, but not why (fully booked, or hours that never meet opening hours), and when rescheduling, which keeps the specialist, it has no way forward to offer. No specialist in the fixture is in this state.
- **Showing slots as the server lists them, not re-deriving them.** The client shares the server's slot rule, so they always agree here. Against a real API, the slot list from `/slots` should be the source of truth for which slots exist, and the client rule only used to explain.

## Tests

- **Unit (75 booking tests, plus 7 shared money tests):**
  - `timezone.test.ts` (21):
    - every stored value in the file;
    - offsets in every spelling, matched to the country or kept fixed;
    - ICU's `Asia/Katmandu`, and naming a provider's clock by its country;
    - conversions both ways, including DST gaps and overlaps;
    - "today" at the provider when the customer's date differs.
  - `slots.test.ts` (11):
    - the brief's example grid;
    - the last slot that still ends in time;
    - partial and no overlap with opening hours;
    - group runs with buffers and gaps;
    - periods;
    - the explanations for hours that aren't offered.
  - `availability.test.ts` (8): every day status, started slots by the provider's clock, a reschedule's own slots (including ones that have already started).
  - `two-clocks.test.ts` (7): Bangkok on a Kathmandu clock, next/previous day, a fixed +05:45 equal to Kathmandu, DST by slot date.
  - `logic.test.ts` (14, mock server):
    - group bookings;
    - 409 when taken or started;
    - off-grid and out-of-window times;
    - idempotent replay and key reuse;
    - moving, including onto an overlapping run.
  - `confirm.test.ts` (4): taken, failed and unknown, and a re-check that stays unknown until the server decides.
  - `day-view.test.ts` (5): what's wrong with the chosen time, and no alternatives until the slots are fresh.
  - `alternatives.test.ts`, `selection.test.ts`.
- **E2E (15 booking flows):** [`e2e/booking.spec.ts`](../e2e/booking.spec.ts) covers every scenario in the table at the top, against a production build, one flow on a phone-sized screen. They share the mock server's single booking store, so they run one at a time. Two bugs were found this way and fixed:
  - a date past the 90-day window was bookable on the server;
  - a calendar day focused by a screen reader's cursor didn't become the active day.

### Found in code review

An independent review pass (a second agent given the code and the brief, not my notes) found these, all fixed and most now covered by tests:

- **A 500 while checking an unanswered booking unlocked the page,** so a customer whose first booking had gone through could book a second time. A re-check now stays unknown until the server decides (unit + e2e test).
- **The confirm button was enabled when a day's times had failed to load,** for a time carried in the URL (e2e test).
- **The zone's city was presented as the provider's location** ("Lumbini Polyclinic · Kathmandu"). Provider clocks are now named by country (e2e test).
- **The time-zone list committed and closed on the first arrow key,** dropping focus (e2e test).
- After a reload, an unanswered booking's own slot was called "booked by someone else", and a 409 from **Check now** offered no alternatives.
- The "Chosen" announcement dropped "next day"; the calendar's today went stale at the provider's midnight; offline loading said "slow"; some wording overstated what happened; small buttons were under 44 px on touch; a DST comment was wrong.

### Found in a final check against the brief

Before submitting, the app was checked line by line against the brief (an agent per exercise, each finding then verified by hand). Fixed:

- **A flaky e2e test.** The phone flow ran in parallel with the others and reset the shared booking store mid-test; in the provider's evening both picked the same slot. It now runs in the same one-at-a-time suite.
- **The calendar's key called four different reasons "Fully booked"**, and a day where the specialist's hours miss opening hours altogether said only "No consultation hours". The key now says "No free times", faded days have their own entry, and those days say "Outside opening hours", with the full sentence in their tooltip.
- **Right after a 409, the Book button was enabled** for the taken time until the times reloaded (the server would have refused it again). It now waits for the fresh times.
- **Rescheduling a group booking that's in progress today** could offer its own started slot as the new start, and the server accepted it (unit test).
- **Extra-small buttons were 24 px on touch screens, and focus rings on native controls were about 2:1.** They're now 44 px and at least 3:1 (shared foundation).
- **This README:** statements that had drifted from the code, and three data mistakes it hadn't listed.

## AI tools

This exercise was built with **Claude Code** (Anthropic's AI coding agent) working under my direction:

- **I chose:** the stack, the branch-per-task structure and the scope.
- **The agent:**
  - profiled the data and listed its traps;
  - designed and implemented the time-zone handling, the mock API, the domain logic and the UI;
  - wrote the unit and e2e tests;
  - drove a headless browser to check each state at desktop and phone sizes, in both themes;
  - drafted this README;
  - checked the finished app against the brief and fixed what it found ([Found in a final check against the brief](#found-in-a-final-check-against-the-brief)).

<!-- TODO(author): describe your own review/changes here before submitting. -->
