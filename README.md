# Paisa - a quiet place for your expenses

A minimal, animated personal-expense tracker. Full-stack in spirit, single-origin
in reality: the "API" runs in the browser so the whole thing can be served as
static files from **GitHub Pages**.

- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, Framer Motion,
  lucide-react, Recharts, TanStack Query, Zod. Glassmorphic panels on a multi-hue
  gradient background.
- **Backend:** a TypeScript module (`src/api/client.ts`) that exposes the same
  shape an HTTP service would (`POST`, `GET`, `DELETE` on `/expenses`), backed
  by **IndexedDB** via Dexie. Idempotent writes, fault injection, and retries
  are all first-class.

---

## Running locally

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # unit tests (Vitest) - 12 specs
npm run build     # static bundle in dist/
```

## Deploying to GitHub Pages

1. Create a GitHub repo and push this project.
2. Repository **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main`. The included `.github/workflows/deploy.yml`:
   - installs deps, runs tests,
   - builds with `VITE_BASE=/<repo-name>/`,
   - publishes `dist/` (with a `404.html` SPA fallback) to Pages.

The site will appear at `https://<user>.github.io/<repo-name>/`.

---

## API (in-browser)

Same shape as an HTTP service, implemented as typed async functions:

| Function                                    | HTTP analogue                             |
|---------------------------------------------|-------------------------------------------|
| `createExpense(body, { idempotencyKey })`   | `POST /expenses` with `Idempotency-Key`   |
| `listExpenses({ category?, sort? })`        | `GET /expenses?category=…&sort=date_desc` |
| `deleteExpense(id)`                         | `DELETE /expenses/:id`                    |
| `resetAll()`                                | `DELETE /expenses` (wipe)                 |

### Data model

```ts
interface Expense {
  id: string;            // server-assigned UUID
  amount: number;        // integer PAISE (1 INR = 100 paise)
  category: Category;    // fixed enum
  description: string;   // 1..200 chars
  date: string;          // YYYY-MM-DD (spend date)
  created_at: string;    // ISO datetime
}
```

### Idempotency

`POST /expenses` requires a client-generated key. A repeated call with the same
key returns the **originally created** record - the check and insert happen
inside a single IndexedDB transaction, so concurrent retries cannot both win.
This protects against: double-click submits, reloads mid-submit, TanStack Query
mutation retries, and user-triggered manual retries after a failure banner.

The UI holds a key for the **lifetime of a submission** (not a click): it is
allocated on the first submit, kept across retries, and rotated after success
or after the user edits the form.

`deleteExpense` runs inside the same transaction and also drops every
idempotency row pointing at the deleted id, so a retried POST with an old key
cannot resurrect a ghost reference, it will correctly create a fresh record.

A key **reused with a different body** returns `409` rather than silently
replaying the old response. Same key + same body is a retry; same key +
different body is almost certainly a client bug, and failing loudly is
the right call. (This is the Stripe idempotency contract.)

### Simulated network

A `NetworkPanel` in the UI exposes `latencyMs` and `failureRate`. This is the
easiest way to see loading skeletons, error banners, and automatic retries in
action without devtools throttling.

---

## Persistence choice

**IndexedDB (via Dexie).** The brief allows any reasonable store and asks the
backend to run alongside the frontend on GitHub Pages. That rules out an
out-of-process DB. Compared to the alternatives:

- `localStorage` - synchronous, strings only, no transactions, no indexes. Fine
  for trivial demos, wrong for money.
- An in-memory JS store - loses everything on refresh; violates the "browser
  refreshes" scenario in the prompt.
- IndexedDB - asynchronous, transactional, indexable, and the idempotency dedup
  can genuinely be atomic. Dexie gives it a clean table API without hiding the
  transaction semantics.

## Money handling

Amounts are stored as **integer paise** (1 INR = 100 paise) everywhere -
in the schema, in `sumPaise`, in the form model. Conversion to a decimal string
only happens at the UI edges (`parseRupeesToPaise`, `formatPaise`). There are
no `Number` arithmetic operations on fractional rupees; 0.1 + 0.2 problems
cannot occur.

## Correctness under realistic conditions

| Condition                               | Handling                                                |
|-----------------------------------------|---------------------------------------------------------|
| Double-click submit                     | One idempotency key per submission → single record      |
| Refresh mid-submit                      | Completed transactions are durable in IndexedDB         |
| Flaky network (simulated)               | TanStack Query retries with exponential backoff         |
| Retry after failure                     | Idempotency key preserved across retries                |
| Concurrent retries race                 | Transaction serialises key-lookup + insert              |
| Delete + retried POST with old key      | Idempotency rows wiped in same tx - POST creates anew   |
| Reset data                              | Both `expenses` and `idempotency` tables cleared atomically |
| Bad input (negative, missing date, etc.)| Zod validation → `ApiError(422)` with issues            |
| Amount precision                        | Integer paise end-to-end                                |
| Amount overflow                         | Per-entry cap at ₹10 crore, >5 orders of magnitude below `MAX_SAFE_INTEGER` |
| Future-dated entry                      | Server-side rejection, client-side date picker disables future dates |
| Typo date (e.g. 1900-01-01)             | Server rejects dates before 1970-01-01                 |
| Idempotency-Key reused with new body    | `ApiError(409)` instead of silent replay               |
| Slow delete under latency               | Optimistic removal from UI, rolled back if server rejects |

---

## Design decisions & trade-offs

- **"Backend" as a module, not a fetch shim.** I considered wrapping the
  functions in a `fetch` handler (Service Worker or mock) to keep the wire
  shape exactly HTTP. I chose the module form because it keeps types end-to-end
  and avoids SW install/version problems on GitHub Pages. The function
  signatures are deliberately one-to-one with the HTTP endpoints so swapping
  in a real server later is a small change.
- **IndexedDB + Dexie over localStorage.** Spent a small amount of the timebox
  here because it's the hinge of the correctness story. Real transactions make
  the idempotency dedup atomic, cheaper stores would have needed a lock or a
  hand-rolled "last write wins" reconciliation - both worse than Dexie's
  `transaction('rw', …)`.
- **Idempotency tied to the submission, not the click.** The UI allocates a
  key on the first submit and keeps it across retries (query-level + manual).
  It only rotates on success or form-edit. This is the subtle bit - rotating
  per click would defeat the mechanism the moment React Query auto-retried.
- **Delete cleans up idempotency rows in the same transaction.** Without this,
  a POST retry with an old key would "succeed" against an expense id that no
  longer exists. One extra line in the Dexie transaction, but it keeps the
  invariant "every idempotency row points at a live record".
- **Idempotency-Key conflicts are loud, not silent.** When a key is reused
  with a matching body, we replay; when it's reused with a *different* body,
  we return 409. Silent replay of a different request would hide real client
  bugs (e.g. "I changed the amount and tapped submit again with the same
  in-flight key"). The extra body-compare inside the transaction is cheap.
- **Optimistic delete with rollback.** Under the simulated ~250 ms latency a
  non-optimistic delete feels sluggish. The `useDeleteExpense` hook snapshots
  every cached list, removes the row immediately, and restores the snapshot
  on error. `onSettled` re-invalidates so the UI always reconciles with
  IndexedDB.
- **Guardrails at the API boundary, not just the form.** Per-entry amount
  cap (₹10 crore), date floor (1970-01-01), and future-date rejection live
  inside the Zod schema that the API enforces, not just the form. A bad
  client (or a replayed request) cannot bypass them.
- **Filtered reads use the `category` index.** `listExpenses` uses
  `where('category').equals(c)` rather than loading the full table and
  filtering in JS. At personal scale this is irrelevant; what matters is
  that the schema and the query stay truthful to each other.
- **Two-step reset.** A full wipe is one click too cheap; the header button
  expands inline into `Cancel / Yes, erase`. Same pattern you'd want against
  a real API, where the destructive call is routed through a confirmation.
- **Categories are a fixed enum.** Free-form categories would need
  normalisation and a separate "categories" collection, out of scope for the
  timebox and not a correctness question.
- **Glassmorphic UI over flat cards.** The multi-hue background + frosted
  panels pulls its weight visually at the cost of ~1 extra CSS rule per card
  (`backdrop-filter: blur(20px)`).
- **No auth / multi-user.** Single-device, browser-local data.
- **No expense editing.** Delete + re-create covers the common correction case
  without widening the idempotency story (an `update` endpoint needs its own
  conflict-resolution rules - out of scope).

## Intentionally not done

- Authentication / sync across devices.
- Edit / update endpoint (delete + re-enter is the interim answer).
- Pagination - not needed at the scale of a personal tracker.
- Currency other than INR - the UI formats with `₹`; switching is a one-line
  change in `money.ts`.
- E2E tests - the unit tests focus on the non-obvious parts (money arithmetic
  and idempotency race behaviour), which is where correctness lives.
- A real HTTP server. The function signatures are HTTP-shaped on purpose so
  an Express/Fastify adapter is a small follow-up if someone needs `curl`
  access.

## Tests

```bash
npm test
```

- `money.test.ts` - parsing, formatting, integer sums.
- `api/client.test.ts` - idempotency (replay, distinct keys, concurrent race),
  validation errors, list filter + sort, delete + idempotency cleanup,
  reset.

---

## Project layout

```
src/
  api/
    db.ts          # Dexie schema (expenses + idempotency tables)
    client.ts      # create / list / delete / resetAll + fault injection
    client.test.ts
  components/      # form, list, filter bar, summary chart, network panel
  hooks/
    useExpenses.ts # TanStack Query wrappers
  lib/
    money.ts       # paise <-> rupees, sum, format
    types.ts       # Category, Expense, Zod input schema
  App.tsx
  main.tsx
```
