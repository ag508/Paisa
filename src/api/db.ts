import Dexie, { type Table } from 'dexie';
import type { Expense } from '../lib/types';

/**
 * IndexedDB schema.
 *
 * `expenses`     — canonical records, keyed by server-assigned id.
 * `idempotency`  — maps an idempotency-key -> expense id so that retried
 *                  POSTs (double-clicks, reloads, network retries) return
 *                  the original record instead of creating a duplicate.
 */
export interface IdempotencyRecord {
  key: string;
  expenseId: string;
  created_at: string;
}

export class PaisaDB extends Dexie {
  expenses!: Table<Expense, string>;
  idempotency!: Table<IdempotencyRecord, string>;

  constructor(name = 'paisa') {
    super(name);
    this.version(1).stores({
      expenses: 'id, date, category, created_at',
      idempotency: 'key, expenseId',
    });
  }
}

export const db = new PaisaDB();
