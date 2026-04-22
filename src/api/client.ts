import { db, PaisaDB } from './db';
import {
  CreateExpenseInput,
  type Expense,
  type ListExpensesQuery,
} from '../lib/types';

/**
 * A browser-resident "backend" that speaks the same shape an HTTP API would.
 *
 * Endpoint semantics:
 *   POST /expenses  -> createExpense(body, { idempotencyKey })
 *     - Requires an Idempotency-Key. If the key has been seen, returns the
 *       originally-created expense (HTTP would return 200 + same body).
 *     - Validates the body with Zod; throws ApiError on 4xx-equivalent.
 *
 *   GET /expenses   -> listExpenses({ category, sort })
 *     - Default sort is date_desc. category=All is treated as no filter.
 *
 * A tiny fault-injection layer simulates real-world latency and occasional
 * failures so the UI's loading / error / retry paths are exercised.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface NetworkProfile {
  /** Base artificial latency (ms). */
  latencyMs: number;
  /** 0..1 probability that a call fails with a transient 503. */
  failureRate: number;
}

// Defaults picked to be noticeable but not annoying. Can be overridden at
// runtime from the UI (see NetworkPanel) for manual testing of retry paths.
let profile: NetworkProfile = { latencyMs: 250, failureRate: 0 };

export function setNetworkProfile(next: Partial<NetworkProfile>) {
  profile = { ...profile, ...next };
}

export function getNetworkProfile(): NetworkProfile {
  return profile;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function simulateNetwork() {
  // Jitter ±30% so two back-to-back calls don't resolve in lockstep.
  const jitter = profile.latencyMs * (0.7 + Math.random() * 0.6);
  await sleep(jitter);
  if (profile.failureRate > 0 && Math.random() < profile.failureRate) {
    throw new ApiError('Simulated network failure. Please retry.', 503);
  }
}

function newId(): string {
  // Prefer crypto.randomUUID when available; fall back to a short random id
  // for older environments (tests with fake-indexeddb).
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'exp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newIdempotencyKey(): string {
  return newId();
}

export interface CreateExpenseOptions {
  idempotencyKey: string;
  /** Override the default db (used by tests). */
  database?: PaisaDB;
  /** Skip fault injection (used by tests). */
  skipNetwork?: boolean;
}

/** POST /expenses */
export async function createExpense(
  body: unknown,
  opts: CreateExpenseOptions,
): Promise<Expense> {
  if (!opts.idempotencyKey) {
    throw new ApiError('Idempotency-Key header is required', 400);
  }
  if (!opts.skipNetwork) await simulateNetwork();

  const parsed = CreateExpenseInput.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('Invalid request body', 422, parsed.error.issues);
  }
  const input = parsed.data;
  const conn = opts.database ?? db;

  // Transactional: check idempotency + insert in one shot so concurrent
  // retries cannot both win the race.
  return conn.transaction('rw', conn.idempotency, conn.expenses, async () => {
    const existing = await conn.idempotency.get(opts.idempotencyKey);
    if (existing) {
      const prior = await conn.expenses.get(existing.expenseId);
      if (prior) {
        // The key has been used before. If the body matches, replay the
        // original response. If it doesn't match, the client has reused a
        // key for a *different* request — almost certainly a bug on the
        // caller's side. Surface a 409 so it is caught instead of silently
        // returning an unrelated record. (Stripe's idempotency spec.)
        const bodyMatches =
          prior.amount === input.amount &&
          prior.category === input.category &&
          prior.description === input.description &&
          prior.date === input.date;
        if (!bodyMatches) {
          throw new ApiError(
            'Idempotency-Key reused with a different request body',
            409,
          );
        }
        return prior;
      }
    }
    const now = new Date().toISOString();
    const record: Expense = {
      id: newId(),
      amount: input.amount,
      category: input.category,
      description: input.description,
      date: input.date,
      created_at: now,
    };
    await conn.expenses.put(record);
    await conn.idempotency.put({
      key: opts.idempotencyKey,
      expenseId: record.id,
      created_at: now,
    });
    return record;
  });
}

/** DELETE /expenses/:id */
export async function deleteExpense(
  id: string,
  opts: { database?: PaisaDB; skipNetwork?: boolean } = {},
): Promise<void> {
  if (!opts.skipNetwork) await simulateNetwork();
  const conn = opts.database ?? db;
  await conn.transaction('rw', conn.expenses, conn.idempotency, async () => {
    await conn.expenses.delete(id);
    // Drop idempotency records that pointed here, otherwise a retried POST
    // with the old key would appear to "succeed" but reference a ghost row.
    await conn.idempotency.where('expenseId').equals(id).delete();
  });
}

/** DELETE /expenses — wipe everything (used by the header reset). */
export async function resetAll(
  opts: { database?: PaisaDB; skipNetwork?: boolean } = {},
): Promise<void> {
  if (!opts.skipNetwork) await simulateNetwork();
  const conn = opts.database ?? db;
  await conn.transaction('rw', conn.expenses, conn.idempotency, async () => {
    await conn.expenses.clear();
    await conn.idempotency.clear();
  });
}

/** GET /expenses */
export async function listExpenses(
  query: ListExpensesQuery = {},
  opts: { database?: PaisaDB; skipNetwork?: boolean } = {},
): Promise<Expense[]> {
  if (!opts.skipNetwork) await simulateNetwork();
  const conn = opts.database ?? db;

  // Use the `category` index when filtering so we never load rows we are
  // about to discard. This matters vanishingly little at personal scale
  // but the intent of the schema is to be load-proportional to the result
  // set, not the whole table.
  const results =
    query.category && query.category !== 'All'
      ? await conn.expenses.where('category').equals(query.category).toArray()
      : await conn.expenses.toArray();
  const sort = query.sort ?? 'date_desc';
  results.sort((a, b) => {
    // Primary: date. Secondary: created_at, so same-day entries keep a stable,
    // newest-first order for the user.
    const cmpDate = a.date.localeCompare(b.date);
    if (cmpDate !== 0) return sort === 'date_desc' ? -cmpDate : cmpDate;
    return sort === 'date_desc'
      ? b.created_at.localeCompare(a.created_at)
      : a.created_at.localeCompare(b.created_at);
  });
  return results;
}
