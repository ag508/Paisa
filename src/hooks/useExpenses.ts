import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  newIdempotencyKey,
  resetAll,
} from '../api/client';
import type { CreateExpenseInput, ListExpensesQuery } from '../lib/types';

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
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
  });
}

export function useResetAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resetAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
  });
}
