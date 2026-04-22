import { AnimatePresence, motion } from 'framer-motion';
import { Inbox, RefreshCw, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import type { Expense } from '../lib/types';
import { formatRupees } from '../lib/money';
import { CategoryIcon } from './CategoryIcon';
import { useDeleteExpense } from '../hooks/useExpenses';

interface Props {
  expenses: Expense[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const del = useDeleteExpense();
  const removing = del.isPending;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="group flex items-center gap-4 px-5 py-3 hover:bg-white/40 transition-colors"
    >
      <CategoryIcon category={expense.category} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-medium truncate">{expense.description}</p>
          <span className="tabular font-semibold shrink-0">
            {formatRupees(expense.amount)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400 mt-0.5">
          <span className="chip !px-2 !py-0.5 !text-[10px]">
            {expense.category}
          </span>
          <span>{formatDate(expense.date)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => del.mutate(expense.id)}
        disabled={removing}
        aria-label="Delete expense"
        title="Delete expense"
        className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-ink-300
                   opacity-0 group-hover:opacity-100 focus:opacity-100
                   hover:text-red-600 hover:bg-red-50 transition
                   disabled:opacity-60"
      >
        {removing ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Trash2 size={14} />
        )}
      </button>
    </motion.li>
  );
}

export function ExpenseList({ expenses, loading, error, onRetry }: Props) {
  if (loading) {
    return (
      <div className="card p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-xl bg-white/50 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="mx-auto text-amber-500" />
        <p className="mt-2 text-sm text-ink-600">
          Couldn't load expenses. The network may be flaky.
        </p>
        <button onClick={onRetry} className="btn-ghost mt-3 mx-auto">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="card p-10 text-center text-ink-400">
        <Inbox className="mx-auto mb-2" />
        <p className="text-sm">No expenses yet. Add your first on the left.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-white/50">
        <AnimatePresence initial={false}>
          {expenses.map((e) => (
            <ExpenseRow key={e.id} expense={e} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
