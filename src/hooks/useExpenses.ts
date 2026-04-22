import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  newIdempotencyKey,
  resetAll,
} from '../api/client';
import type { CreateExpenseInput, Expense, ListExpensesQuery } from '../lib/types';

const EXPENSES_KEY = ['expenses'] as const;

export function useExpenses(query: ListExpensesQuery) {
  return useQuery({
    queryKey: [...EXPENSES_KEY, query],
    queryFn: () => listExpenses(query),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    // Each mutation invocation generates one idempotency key at the start and
    // keeps it across retries — the whole point of the idempotency mechanism.
    mutationFn: async (input: CreateExpenseInput & { idempotencyKey?: string }) => {
      const { idempotencyKey, ...body } = input;
      return createExpense(body, {
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEY });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),

    // Optimistic delete: remove the row from every cached list immediately,
    // then roll back if the network call fails. This keeps the UI snappy
    // under simulated latency without sacrificing correctness — the real
    // source of truth (IndexedDB) is reconciled in onSettled.
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: EXPENSES_KEY });
      const snapshots = qc.getQueriesData<Expense[]>({ queryKey: EXPENSES_KEY });
      for (const [key, data] of snapshots) {
        if (data) {
          qc.setQueryData<Expense[]>(
            key,
            data.filter((e) => e.id !== id),
          );
        }
      }
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.snapshots) {
        qc.setQueryData(key, data);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEY });
    },
  });
}

export function useResetAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resetAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
  });
}
