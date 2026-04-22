import { describe, it, expect, beforeEach } from 'vitest';
import { PaisaDB } from './db';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  resetAll,
  ApiError,
} from './client';

function makeDb() {
  // Unique DB name per test so fake-indexeddb state never leaks.
  return new PaisaDB('paisa-test-' + Math.random().toString(36).slice(2));
}

describe('createExpense idempotency', () => {
  let db: PaisaDB;
  beforeEach(() => {
    db = makeDb();
  });

  const body = {
    amount: 12345,
    category: 'Food',
    description: 'Lunch',
    date: '2026-04-22',
  };

  it('creates a single record for the same idempotency key', async () => {
    const key = 'idem-1';
    const first = await createExpense(body, {
      idempotencyKey: key,
      database: db,
      skipNetwork: true,
    });
    const second = await createExpense(body, {
      idempotencyKey: key,
      database: db,
      skipNetwork: true,
    });
    expect(second.id).toBe(first.id);
    const rows = await db.expenses.toArray();
    expect(rows).toHaveLength(1);
  });

  it('creates separate records for different keys', async () => {
    await createExpense(body, {
      idempotencyKey: 'a',
      database: db,
      skipNetwork: true,
    });
    await createExpense(body, {
      idempotencyKey: 'b',
      database: db,
      skipNetwork: true,
    });
    expect(await db.expenses.count()).toBe(2);
  });

  it('deduplicates under concurrent retries', async () => {
    const key = 'race';
    const calls = Array.from({ length: 5 }).map(() =>
      createExpense(body, {
        idempotencyKey: key,
        database: db,
        skipNetwork: true,
      }),
    );
    const results = await Promise.all(calls);
    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);
    expect(await db.expenses.count()).toBe(1);
  });

  it('validates the body (422-equivalent)', async () => {
    await expect(
      createExpense(
        { ...body, amount: -1 },
        { idempotencyKey: 'x', database: db, skipNetwork: true },
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('requires an idempotency key', async () => {
    await expect(
      createExpense(body, {
        idempotencyKey: '',
        database: db,
        skipNetwork: true,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects the same key used for a different body (409)', async () => {
    const key = 'reused';
    await createExpense(body, {
      idempotencyKey: key,
      database: db,
      skipNetwork: true,
    });
    const err = await createExpense(
      { ...body, amount: body.amount + 1 },
      { idempotencyKey: key, database: db, skipNetwork: true },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    // Original record preserved.
    expect(await db.expenses.count()).toBe(1);
  });
});

describe('input guardrails', () => {
  const base = {
    amount: 1000,
    category: 'Food' as const,
    description: 'x',
    date: '2026-04-22',
  };
  function call(db: PaisaDB, overrides: Partial<typeof base>) {
    return createExpense(
      { ...base, ...overrides },
      { idempotencyKey: Math.random().toString(), database: db, skipNetwork: true },
    );
  }

  it('rejects future-dated entries', async () => {
    const db = makeDb();
    const tenYearsOut = new Date(Date.now() + 10 * 365 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await expect(call(db, { date: tenYearsOut })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('rejects implausibly old dates', async () => {
    const db = makeDb();
    await expect(call(db, { date: '1900-01-01' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('rejects amounts beyond the per-entry cap', async () => {
    const db = makeDb();
    await expect(
      call(db, { amount: 999_999_999_999 }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('deleteExpense', () => {
  it('removes the record and its idempotency references', async () => {
    const db = makeDb();
    const body = {
      amount: 500,
      category: 'Food' as const,
      description: 'tea',
      date: '2026-04-22',
    };
    const created = await createExpense(body, {
      idempotencyKey: 'del-key',
      database: db,
      skipNetwork: true,
    });
    await deleteExpense(created.id, { database: db, skipNetwork: true });

    expect(await db.expenses.count()).toBe(0);
    // After deletion, a retried POST with the same idempotency key should
    // create a fresh record (no zombie reference to the deleted id).
    expect(await db.idempotency.count()).toBe(0);
    const recreated = await createExpense(body, {
      idempotencyKey: 'del-key',
      database: db,
      skipNetwork: true,
    });
    expect(recreated.id).not.toBe(created.id);
  });
});

describe('resetAll', () => {
  it('clears expenses and idempotency records', async () => {
    const db = makeDb();
    for (let i = 0; i < 3; i++) {
      await createExpense(
        {
          amount: 100 * (i + 1),
          category: 'Other',
          description: 'x',
          date: '2026-04-22',
        },
        { idempotencyKey: 'k' + i, database: db, skipNetwork: true },
      );
    }
    await resetAll({ database: db, skipNetwork: true });
    expect(await db.expenses.count()).toBe(0);
    expect(await db.idempotency.count()).toBe(0);
  });
});

describe('listExpenses', () => {
  it('filters by category and sorts newest first', async () => {
    const db = makeDb();
    const seed = [
      { date: '2026-01-01', category: 'Food' as const, amount: 100 },
      { date: '2026-03-01', category: 'Food' as const, amount: 200 },
      { date: '2026-02-01', category: 'Travel' as const, amount: 300 },
    ];
    for (const [i, s] of seed.entries()) {
      await createExpense(
        { ...s, description: 'x' + i },
        {
          idempotencyKey: 'k' + i,
          database: db,
          skipNetwork: true,
        },
      );
    }
    const all = await listExpenses(
      { sort: 'date_desc' },
      { database: db, skipNetwork: true },
    );
    expect(all.map((e) => e.date)).toEqual([
      '2026-03-01',
      '2026-02-01',
      '2026-01-01',
    ]);
    const food = await listExpenses(
      { category: 'Food' },
      { database: db, skipNetwork: true },
    );
    expect(food).toHaveLength(2);
    expect(food.every((e) => e.category === 'Food')).toBe(true);
  });
});
