import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { FilterBar } from './components/FilterBar';
import { SummaryCard } from './components/SummaryCard';
import { NetworkPanel } from './components/NetworkPanel';
import { useExpenses, useResetAll } from './hooks/useExpenses';
import type { Category } from './lib/types';
import { sumPaise } from './lib/money';

/**
 * The favicon, inlined so the header logo is literally the site's icon.
 * The outer rounded rect from the original favicon is dropped because the
 * surrounding `<div>` already provides the ink-900 rounded background.
 */
function LogoMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width="22"
      height="22"
      aria-hidden
    >
      <path
        d="M20 18h18a10 10 0 0 1 0 20h-8l12 12"
        fill="none"
        stroke="#7c5cff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 26h26M18 32h26"
        stroke="#7c5cff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function App() {
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [sort, setSort] = useState<'date_desc' | 'date_asc'>('date_desc');
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: expenses = [], isLoading, isError, refetch, isFetching } =
    useExpenses({ category, sort });
  const resetMutation = useResetAll();

  const total = useMemo(
    () => sumPaise(expenses.map((e) => e.amount)),
    [expenses],
  );

  async function handleReset() {
    await resetMutation.mutateAsync();
    setConfirmReset(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex items-center justify-between mb-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-white border border-ink-100 shadow-sm">
            <LogoMark />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Paisa</h1>
            <p className="text-xs text-ink-400 -mt-0.5">
              a quiet place for your expenses
            </p>
          </div>
        </motion.div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-ink-400">
            <Sparkles size={14} /> works offline · data lives in your browser
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {!confirmReset ? (
              <motion.button
                key="reset-button"
                type="button"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={() => setConfirmReset(true)}
                className="btn-danger text-xs"
                disabled={expenses.length === 0 && !isLoading}
                title="Delete all expenses"
              >
                <RotateCcw size={14} /> Reset data
              </motion.button>
            ) : (
              <motion.div
                key="reset-confirm"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="flex items-center gap-2 text-xs bg-white/70 border border-red-200 rounded-xl pl-3 pr-1 py-1"
                style={{ backdropFilter: 'blur(8px)' }}
              >
                <span className="text-ink-600">Erase everything?</span>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="btn-ghost !py-1 !px-2 text-xs"
                  disabled={resetMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-danger !py-1 !px-2 text-xs"
                  disabled={resetMutation.isPending}
                >
                  {resetMutation.isPending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Erasing…
                    </>
                  ) : (
                    'Yes, erase'
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-1 space-y-6"
        >
          <ExpenseForm />
          <SummaryCard expenses={expenses} />
          <NetworkPanel />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-4"
        >
          <FilterBar
            category={category}
            onCategoryChange={setCategory}
            sort={sort}
            onSortChange={setSort}
            total={total}
            count={expenses.length}
            isRefreshing={isFetching && !isLoading}
          />
          <ExpenseList
            expenses={expenses}
            loading={isLoading}
            error={isError}
            onRetry={() => refetch()}
          />
        </motion.section>
      </div>

      <footer className="mt-16 text-center text-xs text-ink-400">
        Built for the expense-tracker exercise · amounts in ₹ · idempotent POSTs
      </footer>
    </div>
  );
}
