# MedEx: Senior Frontend Engineer take-home

This repository holds the shared foundation for the three MedEx exercises. Each exercise is built on its own branch:

| Branch | Exercise |
| --- | --- |
| `main` | Shared foundation (this README) |
| `task-1-service-explorer` | Task 1: Service Explorer with live faceted filters |
| `task-2-cart-checkout` | Task 2: Multi-provider cart and split checkout |
| `task-3-booking-time-zones` | Task 3: Appointment booking across time zones |

Each task branch has its own README covering that task's decisions, trade-offs and data handling.

## Run it

```bash
pnpm install && pnpm dev     # http://localhost:3000
```

Requires Node 20.9+ and pnpm 10.

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server (Turbopack) |
| `pnpm build && pnpm start` | Production build |
| `pnpm test` | Unit and component tests (Vitest) |
| `pnpm check` | Typecheck, lint and tests together |

## Stack and why

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Cache Components) | MedEx's stack. Route handlers make a realistic mock API with no extra tooling. |
| UI | **shadcn/ui** on Radix + **Tailwind CSS 4** | Accessible primitives (focus management, ARIA, keyboard) that we own and can change. |
| Server state | **TanStack Query** | Caching, retries, offline pausing and request de-duplication, so components don't hand-roll them. |
| Client state | **Zustand** | Small stores that can be read outside React. The API client reads the dev-panel settings this way. |
| Forms | **React Hook Form + Zod** | Uncontrolled inputs keep typing cheap, and the schemas validate at the boundary. |
| Money | **big.js** | Exact decimal maths. Floats round 5970.605 down to .60. |
| Tests | **Vitest + Testing Library**, Playwright | Fast unit tests for domain logic, plus browser tests for flows. |

## Shared foundation

```
src/
  app/                    routes; app/api/* are the mock endpoints
  components/
    ui/                   shadcn/ui primitives (generated, then adjusted)
    app/                  shell: providers, header, live announcer, offline banner
    dev/                  the "Mock API" panel
  lib/
    money/                decimal parsing, half-up display rounding, per-currency totals
    api/                  typed fetch client and customer-facing error messages
    mock-controls/        dev-panel ↔ mock-server protocol and store
  server/mock/            server-only: fixture loading, latency/failure wrapper
data/                     the fictional JSON fixtures from the brief
```

**The JSON is never imported by UI code.** Fixtures are read only by `src/server` and served through route handlers under `/api`. An ESLint rule (`no-restricted-imports`) fails the build if a component imports `data/*.json` or `@/server/*`.

### Mock API controls

Every mock endpoint goes through `withMockControls`, which adds realistic latency (350–900 ms by default) and can fail on demand. You can control it in three ways:

- **In the app:** open the **Mock API** button (bottom left). From there you can:
  - pick a network speed (instant through very slow),
  - simulate being offline,
  - make any endpoint fail once or always, with HTTP 500 (or another status), a network error, or a timeout.
- **With curl:** add query flags, for example `curl 'localhost:3000/api/…?_latency=3000&_fail=500'`.
- **With headers:** send `x-mock-latency: slow` or `x-mock-fail: 409`.

Transient failures (network, timeout, 5xx) are retried automatically once. "Fail once" shows that recovery. "Fail always" shows the error state and its Retry button.

### Accessibility baseline

- Skip link.
- One pair of live regions for screen-reader announcements, mounted once so their updates are always announced.
- Visible focus rings.
- 44 px touch targets on touch screens.
- `prefers-reduced-motion` respected.
- AA colour contrast in light and dark themes (ratios are noted in `globals.css`).

## AI tools

This foundation was written with **Claude Code** (Anthropic's AI coding agent) working under my direction. I chose:

- the stack (Next.js, shadcn/ui, Tailwind, Zustand, React Hook Form),
- the branch-per-task structure,
- the requirements to optimise for.

The agent profiled the data, scaffolded the project and wrote most of the code and tests. Each task README says where AI was used for that exercise.

<!-- TODO(author): describe your own review/changes here before submitting. -->

