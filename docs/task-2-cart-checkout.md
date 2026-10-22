# MedEx: Task 2, Multi-provider cart and split checkout

> "I put a lab test from one clinic, a facial from a spa, and a check-up package from a hospital in my cart. Then I tried to pay."

A cart that holds services from different providers, of different types, in different currencies. It's checked out as **separate orders**, one per group, each with its own payment method.

The core of the exercise is partial failure: when one order fails, nothing that succeeded is lost or charged twice, the customer knows exactly what happened, and a retry never creates a duplicate.

> This is the README of the `task-2-cart-checkout` branch, where this exercise lives on its own on top of the shared foundation from `main`. On `dev` all three exercises run in one app and it applies as written, except: **Reset demo** resets only the cart: `POST /api/demo/reset?scope=cart` (`/api/demo/reset` is shared with Task 3).

---

## Run it

```bash
pnpm install && pnpm dev          # → http://localhost:3000/cart
```

You need Node 20.9+ and pnpm 10.

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build && pnpm start` | Production build |
| `pnpm test` | 46 unit tests (Vitest): checkout state machine, merge policy, idempotent checkout, cart view, money |
| `pnpm e2e` | 17 Playwright flows against a production build (every scenario below) |
| `pnpm check` | Typecheck, lint and unit tests |

Playwright needs a Chromium. Run `pnpm exec playwright install chromium`, or point `PLAYWRIGHT_CHROMIUM_PATH` at one you already have.

### Try every scenario

Everything is driven from the **Mock API** button in the header. Its **Demo data → Reset demo** action restores the original carts and forgets all orders.

| Scenario | How |
| --- | --- |
| Guest → sign in → cart merge explained | Open `/cart`. You're a guest with the fixture's device cart. Click **Sign in to check out**, then **Continue as Asha**. |
| Five quick "+" taps | Tap **+** on *Liver Function Profile* quickly. |
| Server refuses a change | Tap **+** past 10 (the per-item limit): it settles on 10 and says why. Or set `PATCH …(quantity)` to **Fail always / HTTP 500** and the change rolls back with a reason. |
| Wellness needs a duration | Before signing in, remove *Signature Facial* from the device cart (otherwise the merge fills its duration in). The Wellness order is then blocked until you pick 60 or 90 min. |
| Unavailable item | The **No longer available** group is marked, never ordered, and has a **Remove** button. |
| **Second of three orders fails** | `POST /api/checkout` → **Fail 2nd call** + **HTTP 402**, then **Check out all 3 orders** → **Place 3 orders**. Then **Try again** on the failed one. |
| **Order placed, reply lost** | `POST /api/checkout` → **Fail once** + **Order placed, reply lost**. The server places the order but holds the reply past the browser's timeout. |
| Payment fails after the order was accepted | `POST /api/checkout` → **Fail once** + **Payment fails after processing**. |
| **Reload mid-checkout** | Network speed **Slow 3G**, place the orders, reload (or close and reopen the tab). |
| **Two tabs** | Start a checkout on Slow 3G, then open `/cart/checkout` in a second tab. Both show the same truth, and there are still only 3 orders. |
| **Order never confirmed** | `POST /api/checkout` → **Fail always** + **Order placed, reply lost**. The order shows "We're still checking 1 order" and stays locked. Set it back to **Works** and it settles by itself (or press **Check now**). |
| Offline | **Simulate offline**. |
| Different payment method per order | In the review step, pick **Pay at the clinic** for any order. |

`GET /api/demo/orders` lists every order the server accepted. It's how the tests prove nothing was duplicated.

---

## What's built, against the brief

| # | Requirement | Where / how |
| --- | --- | --- |
| 1 | Cart grouped by type; per-currency subtotals; no mixed grand total; a helpful summary | `CartGroupCard`, `CartSummary`. Groups show as "Order 1 of 3". The summary lists each order's amounts, then **per-currency totals across orders** ("In THB …, In NPR …"), and explains why there are several payments. |
| 2 | Optimistic quantities; rollback with a reason; 5 quick taps end right with no flicker; requests never race | `state/line-sync.ts` (see [Optimistic changes](#optimistic-quantity-changes)) |
| 3 | Wellness needs a duration before its group can be checked out; unknown price never counted as 0 | `DurationPicker`; `unitPrice: null` until chosen; "1 item without a price yet"; checkout blocked with the reason |
| 4 | Unavailable items marked, not checkout-able, easy to remove | Their own "No longer available" group, excluded from orders and totals, with **Remove** (focus moves to the next item) |
| 5 | Check out one group or all; each its own order; card or pay at clinic per order | "Check out lab tests only" per group, or "Check out all 3 orders"; a payment choice per order in the review step |
| 6 | Partial failure: nothing lost or double-charged; clear outcome; retry only what failed; no duplicates | [State machine](#the-checkout-state-machine), [double charges](#how-double-charges-are-prevented) |
| 7 | Reload safety | Every order's key is persisted when checkout starts; the session is saved on every transition; the runner resumes on any page, in one tab at a time |
| 8 | Guest cart merged on login; each overlap designed; customer told what changed | `POST /cart/merge` → `{ cart, changes }` ([merge policy](#guest-cart-merge)) |
| 9 | Loading, empty, slow, offline; keyboard; focus on removal and step changes | [States](#states), [Accessibility](#accessibility) |

---

## Architecture

```
data/task2-cart.json ── src/server/cart (in-memory db: lines, revision, orders, idempotency records)
                          │  pure logic: view.ts · mutations.ts · merge.ts · checkout.ts   (unit-tested)
                          ▼
       route handlers /api/cart · /api/cart/items/:id · /api/cart/merge · /api/checkout · /api/orders/:id
                          │  (withMockControls: latency + on-demand failures)
                          ▼
features/cart/api/client.ts   typed calls, lenient Zod parsing, normalise → domain model
     │
     ├── TanStack Query cache ["cart"] ◄── applyServerCart(): only a newer revision wins
     ├── Zustand: cart-edits      (unsaved edits, saving, errors, learned limits)
     ├── Zustand: cart-session    (guest device cart, signed in, last merge)  [localStorage]
     └── Zustand: checkout-session (orders + state machine per order)        [localStorage]
                          │
domain/view.ts  buildGroups(cart, edits) → groups, per-currency subtotals, why-not-ready
domain/checkout-machine.ts  transition(group, event)  (pure)
hooks/use-checkout-runner.ts  drives the machine: submit one at a time, poll, resume, auto-retry
```

### Where state lives

| State | Lives in | Why |
| --- | --- | --- |
| The account cart | **TanStack Query** cache, keyed `["cart"]` | Server state. Every response carries a `revision`; an older one never overwrites a newer one. |
| Unsaved edits (quantity, duration, removal) | **Zustand** `cart-edits` | Read and written outside React by the sync engine; the UI renders server state + edits. |
| Guest device cart, signed-in flag, merge result | **Zustand** `cart-session`, persisted | A real logged-out cart lives on the device. Cleared only after the merge succeeds. |
| Checkout in progress | **Zustand** `checkout-session`, persisted | Must survive reloads and closed tabs, and be written *before* a request goes out. Other tabs follow its writes (`storage` event); a per-order `rev` keeps the newer state. |
| Payment method per order (review step) | **React Hook Form** + Zod | A form, submitted once to start the checkout. |

---

## The checkout state machine

There is one machine per order, implemented as a pure reducer in `domain/checkout-machine.ts` and covered by 8 unit tests. Events that don't apply in the current state are ignored. That's what makes a double click, or a late response for an already-settled order, harmless.

```mermaid
stateDiagram-v2
    [*] --> queued: Place orders (every order gets its key, saved first)
    queued --> submitting: submit
    submitting --> awaiting_payment: 201, card, status pending
    submitting --> confirmed: 201 paid, or pay at clinic
    submitting --> declined: 402
    submitting --> conflict: 409 (cart changed)
    submitting --> unknown: 5xx, network, timeout, offline
    unknown --> submitting: re-ask with the SAME key (automatically, backing off; or "Check now")
    awaiting_payment --> confirmed: order paid
    awaiting_payment --> declined: order failed, items go back to the cart
    declined --> queued: try again / pay at clinic instead (NEW key)
    confirmed --> [*]
    conflict --> [*]: review the cart
```

| State | What the customer reads |
| --- | --- |
| `queued` | "Waiting its turn · We'll place this order next." |
| `submitting` | "Placing order…" (on a retry: "We're asking about this exact order again, so it can't be placed twice.") |
| `awaiting_payment` | "Order MX-4KD8QZ is placed. We're waiting for your bank to confirm the payment of THB 1,677.00 and NPR 12,520.00…" |
| `confirmed` (card) | "Paid · Order MX-… · THB 1,677.00 and NPR 12,520.00 charged to your card." |
| `confirmed` (clinic) | "Booked · pay at the clinic · Nothing has been charged; pay when you visit: Tamarind Medical Centre THB 15,230.00 · Silk Route International Hospital INR 23,009.50" |
| `declined` | "Not placed · Your bank declined the card payment. **You haven't been charged for this order**, and its items are still in your cart." Buttons: **Try again by card**, **Pay at the clinic instead** |
| `conflict` | "Not placed · The quantity of … changed. Nothing was charged." Button: **Review in your cart** |
| `unknown` | "Not confirmed yet · We lost touch with our server before it confirmed this order, so it may or may not have gone through. We're checking again automatically… **you won't be charged twice**." Headline: "We're still checking 1 order". **Not an outcome:** the cart lines stay locked and there's no "Done" until it settles. |

Orders are submitted **one at a time**, so the customer reads "Placing 2 of 3". A failed order doesn't stop the ones after it. They're independent bookings.

The results heading summarises the outcome: "2 of 3 orders placed". Each order's card says what happened to it and what to do next.

## How double charges are prevented

1. **One idempotency key per attempt, saved before anything is sent.**
   - Every order's key is minted when the checkout starts, and written synchronously to localStorage.
   - A reload or closed tab at any moment leaves the key on disk.
   - Every tab that loads the session uses the same keys.
2. **An unknown outcome is always resolved with the same key.**
   - "Unknown" means a 5xx, 408, 429, a timeout, a dropped connection or offline.
   - The server returns the order it already made, or makes it now. Never a second one.
   - The runner keeps re-asking (2 s, 4 s, 8 s… up to 30 s), and the customer can press "Check now".
   - Until then the order is pending: never "not placed", lines locked, no "Done".
3. **The server records the first response per key and replays it** (`server/cart/checkout.ts`):
   - A 402 is recorded: the same key stays declined.
   - A 500 is not recorded: it decided nothing, so retrying really retries.
   - Reusing a key for a *different* payload gets a 409 instead of being silently honoured.
4. **Only a definitive "no" gets a new key.** After a 402, or a payment that failed after acceptance, the old key would only replay the decline. That order is dead and nothing was charged, so a new attempt is a new order, not a duplicate.
5. **Double clicks, races and extra tabs are inert.**
   - `submit` is ignored unless the order is `queued`.
   - A request already in flight for a key isn't sent again.
   - Only one tab drives the checkout (Web Locks). The others follow its writes, and if it closes another takes over.
   - Even without Web Locks, all tabs share the keys, so they'd get the same orders.
6. **The order must match what the customer reviewed.**
   - Lines, quantities and durations must match the cart.
   - The totals the customer saw must match the server's own pricing.
   - Otherwise it's a 409 (`CART_CHANGED` / `PRICE_CHANGED`), and the customer reviews rather than paying a different amount.
   - Amounts shown as charged come from the server's order, not the client's snapshot.
7. **Ordered items leave the cart**, and items of a failed payment come back, once.

The e2e tests prove the hard cases against the server's order list:

- *Second of three declined, then retried:* exactly 3 orders, one per group.
- *Order placed but reply lost:* exactly 1 order.
- *Reload mid-checkout:* exactly 3 orders, not 6.
- *A second tab mid-checkout:* exactly 3 orders, and no tab ever says "nothing was charged" for a paid order.
- *Reply lost on every attempt:* "still checking", locked; then one order once the connection recovers.

## Optimistic quantity changes

`state/line-sync.ts`:

- **Instant on screen.** A tap updates the *wanted* value right away. The screen shows server state plus unsaved edits.
- **One request per line at a time.** Taps made while a request is in flight just update the wanted value. When the request returns, the loop sends the latest value if it differs.
  - Five quick taps from 3 make at most two requests and end at 8.
  - Requests for a line never overlap, so they can't arrive out of order.
- **No flicker.** An intermediate response (say, "4") never replaces the 8 on screen while a newer edit is pending. The e2e test records every value the counter ever shows and asserts it only goes up.
- **Newest server state wins, by revision.** Every cart response has a `revision`. A response older than the cached cart is ignored, so a slow GET, or a PATCH for another line, can't regress anything.
- **Rollback with a reason.**
  - A *definitive* refusal (4xx) returns to the last saved value and says why: "… Quantity is back to 1."
  - An *unclear* failure (5xx, timeout, dropped connection) may have saved after all. It refetches the cart and says "Showing what's saved" instead of guessing.
  - Either way, only the failed field is undone. Anything else pending for that line (a removal queued behind it, say) is still sent.
- **Limits settle instead of snapping back.** Taps are coalesced, so asking for 11 sends one request for 11. When the 409 says the limit is 10, the line settles on 10 ("You can book at most 10 of … We've set it to 10.") rather than jumping back to the last saved value. The stepper also stops at 10 from then on.
- **Removal is optimistic too.** Focus moves to the next item (or the group heading), and on failure the item reappears with a message.

## Wellness, unavailable items and money

- **Wellness price.** A wellness price is `null` until a duration is chosen: never 0.
  - The line shows "Price not set yet".
  - The group subtotal says "+ 1 item without a price yet".
  - The summary says the order "needs a duration".
  - The group's checkout is blocked with the reason.
- **Unavailable items.** Lines whose `product` is `{}` are "no longer available". They're shown in their own group, excluded from every order and total, and removable.
- **Prices are exact.** They arrive as numbers that are already final per unit. They're parsed into exact decimals (big.js), multiplied by quantity and summed **per currency**, never across currencies.
- **Subtotals are recomputed, not taken from the server.** The server's `subtotals` match the fixture, but the client recomputes them from the lines on screen, so they always agree with edits that are still saving.
- **A group can mix currencies.** Lab tests are THB + NPR; packages are THB + INR. That order is still one order, but the card is charged once per currency, and the UI says so ("Priced in 2 currencies. Each is charged separately and nothing is converted.").

## Guest cart merge

`POST /cart/merge { items }` → `{ cart, changes }`. The policy is in `server/cart/merge.ts`, with unit tests.

| Overlap (from the fixture) | What happens | Change reported |
| --- | --- | --- |
| *Liver Function Profile*: account 2, device 3 | Keep the **larger** quantity, 3. Never the sum: doubling a lab-test booking is the expensive mistake. | `quantity_raised` from 2 to 3 |
| *Lipid Profile*: only on the device | Added | `added` |
| *Signature Facial*: in both; device chose 90 min, account none | The device's choice fills the gap | `duration_applied` 90 min |
| A product the catalog doesn't have | Skipped | `not_available` |
| *(not in the fixture)* Both chose different durations | Keep the account's choice; say which one was ignored | `duration_kept` |
| *(not in the fixture)* Quantity above the limit | Capped | `quantity_limited` |
| Same or smaller quantity on the device | Unchanged | `already_in_cart` (folded into another sentence when one exists) |

Because "keep the larger" is idempotent, **retrying a merge changes nothing**. The merge also carries an idempotency key per sign-in attempt, and the server replays the first response. A retried sign-in therefore still reports what was actually added, not "already in your cart".

The device cart is cleared only after the merge succeeds; if it fails, the customer is still signed out with nothing lost.

The customer sees one sentence per change, shown once after signing in. For example: "Liver Function Profile: your account had 2 and this device had more, so we kept 3. We don't add the two together, so nothing is booked twice."

## Explaining several orders to a non-technical customer

- **In the cart:**
  - groups are labelled "Order 1 of 3" from the start, so the review step isn't a surprise;
  - each group's footer says "Booked and paid as its own order".
- **In the summary:** a plain note, "Each order is booked and paid separately. If one order has a problem, the others aren't affected."
- **In the review step:** "You're placing **3 separate orders**… You'll see what happened to each one on the next screen."
- **On the results screen:**
  - the heading counts outcomes ("2 of 3 orders placed");
  - every order says in money terms what did or didn't happen ("charged to your card", "nothing has been charged; pay when you visit: …", "You haven't been charged for this order").
- **No technical words.** "Idempotency", status codes and HTTP never appear.

## Mock API

| Endpoint | Notes |
| --- | --- |
| `GET /api/cart` | `GET /v2/cart` shape plus each line's `wellnessPricingId` and a `revision` |
| `PATCH /api/cart/items/:lineId` `{quantity}` / `{wellnessPricingId}` | 409 `QUANTITY_LIMIT` (10 per item; insurance 1) with `maxQuantity`; 409 for removed products |
| `DELETE /api/cart/items/:lineId` | Idempotent 204 |
| `POST /api/cart/merge` | `{ cart, changes }`; optional `idempotencyKey` replays the first response |
| `POST /api/checkout` | 201 · 402 · 409 · 500, idempotent by key; optional `expectedTotals` → 409 `PRICE_CHANGED` if different |
| `GET /api/orders/:orderId` | Card payments settle after ~2.5 s |
| *Extras:* `GET /api/catalog`, `POST /api/cart/items` | Resolve the guest cart; refill the cart from the empty state |
| *Demo:* `POST /api/demo/reset?scope=cart`, `GET /api/demo/orders`, `GET /api/demo/guest-cart` | Reset, inspect, seed |

**Failure injection.** Checkout failures are applied *inside* the idempotent order logic, so they behave like real ones:

- **402**, a decline, is recorded for its key.
- **500** fails before deciding anything and isn't recorded.
- **"Order placed, reply lost"** places the order and then holds the reply past the browser's 12 s timeout.
- **"Payment fails after processing"** accepts the order, then fails it when it settles.

The new **"Fail 2nd call"** mode in the panel reproduces "the second of three orders fails" exactly.

## What I found in the data

- **A cart line whose `product` is `{}`** (the server's `unknown` group): shown as unavailable and removable.
- **A guest-cart product id that isn't in the catalog** (`6b572fa4…`): skipped on merge and reported. The device-cart view also marks it before sign-in.
- **The overlaps between the guest and account carts**: the merge table above.
- **`itemCount` and `unpricedItems` count quantities, not lines** (the brief says so for `itemCount`). The client counts the same way.
- **The cart response doesn't say which wellness duration a line has**, but PATCH lets you set one, so the response needs it. I added `wellnessPricingId` per line, and a `revision` to order responses.

## States

- **Loading:** skeletons shaped like the cart.
- **Empty:** "Your cart is empty" plus a few services to add.
- **Load error:** a message and a Retry button ("Your cart is safe").
- **Slow:** quantity changes don't wait (optimistic), with a quiet "Saving…" per line. Checkout shows each order's live status and says the page can be left.
- **Offline:**
  - the site banner appears;
  - the cart stays readable;
  - steppers, durations and removal are disabled;
  - checkout is disabled with "You're offline. Your cart is saved; reconnect to check out.";
  - an in-progress checkout pauses and resumes by itself.

## Accessibility

- **Keyboard.** Every action is a native button, link, radio or checkbox. The quantity stepper is a labelled group ("Quantity of CBC Profile") and its value is a polite live region. Buttons are named "Add one more CBC Profile" or "Remove CBC Profile".
- **Focus management:**
  - after a removal, focus goes to the next item, else the previous one, else the next group, else the cart heading;
  - each checkout step change focuses its heading, which has scroll margin so the sticky header never covers it;
  - the merge summary heading takes focus after sign-in;
  - dialogs trap and restore focus.
- **Announcements:**
  - errors and rollbacks are assertive;
  - order outcomes are announced ("Lab tests: payment confirmed.", "Health packages: booked. You'll pay at the clinic.", "Wellness: payment declined. You haven't been charged.");
  - the step indicator uses `aria-current="step"`.
- **Phones:** a sticky checkout bar, because the summary sits below a long cart.

## Assumptions

- **One order per cart group (product type), as the brief says, even when the group spans several providers or currencies.** Card payments are charged per currency. Pay at clinic means paying each provider at their visit.
- **Demo sign-in has no credentials.** It "becomes" the fixture's customer. A real app would merge on its auth callback.
- **No real card details are collected.** "Card" stands for the provider's hosted payment page (a demo card •••• 4242).
- **Orders are placed sequentially**, so outcomes are easy to follow. Nothing in the API requires it.
- **Server-side limits (10 per item, 1 insurance plan) are business-rule stand-ins.** The client learns them only from 409s, as it would with a real API.

## Left out, and what I'd do next

- **Real payment flows:** 3-D Secure redirects (a `requires_action` state), and payment provider webhooks instead of polling.
- **Undo for removal** (needs a re-add endpoint), and a provider grouping inside each order.
- **A screen-reader pass** with NVDA or VoiceOver, plus axe checks in the e2e suite.
- **Persisting unsaved edits across a reload.** Today a reload drops edits that hadn't reached the server yet; the cart then shows what the server has.

## Tests

- **Unit (46):**
  - checkout state machine transitions;
  - server merge policy (including idempotency);
  - idempotent checkout (replay, key reuse, recorded decline vs unrecorded 500, cart validation, async settlement, restoring items);
  - cart view (unknown prices never 0, per-currency subtotals, edits, locks);
  - merge copy;
  - money.
- **E2E (17):** [`e2e/cart.spec.ts`](../e2e/cart.spec.ts) covers every scenario in the table at the top, against a production build, checking the server's order list for duplicates. Plus a shell smoke test.
  - Five of them are regression tests for issues found in a code review: an unconfirmed order shown as "not placed", a second tab contradicting the first, checkout stalling when leaving the cart, a stale results page, and a removal lost behind a failed save.

## AI tools

This exercise was built with **Claude Code** (Anthropic's AI coding agent) working under my direction:

- **I chose:** the stack, the branch-per-task structure and the scope.
- **The agent:**
  - designed and implemented the mock API, state machine, sync engine and UI;
  - wrote the unit and e2e tests;
  - drove a headless browser to check each state;
  - drafted this README.
- **A second agent** reviewed the code adversarially. It found no way to double-charge, but did find 11 issues where the UI could mislead or an edit could be lost. All were verified and fixed, most with a regression test. That included the multi-tab coordination and the "still checking" state.

<!-- TODO(author): before submitting, describe your own review, the changes you made, and anything you'd decide differently. You'll be asked to explain and extend this code live. -->
