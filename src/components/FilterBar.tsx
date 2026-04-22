import { motion } from 'framer-motion';
import { ArrowDownAZ, ArrowUpAZ, Loader2 } from 'lucide-react';
import { CATEGORIES, type Category } from '../lib/types';
import { formatRupees } from '../lib/money';

interface Props {
  category: Category | 'All';
  onCategoryChange: (c: Category | 'All') => void;
  sort: 'date_desc' | 'date_asc';
  onSortChange: (s: 'date_desc' | 'date_asc') => void;
  total: number;
  count: number;
  isRefreshing: boolean;
}

export function FilterBar({
  category,
  onCategoryChange,
  sort,
  onSortChange,
  total,
  count,
  isRefreshing,
}: Props) {
  const all: (Category | 'All')[] = ['All', ...CATEGORIES];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {all.map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              data-active={category === c}
              onClick={() => onCategoryChange(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            onSortChange(sort === 'date_desc' ? 'date_asc' : 'date_desc')
          }
          className="btn-ghost text-xs"
          title="Toggle sort order"
        >
          {sort === 'date_desc' ? (
            <ArrowDownAZ size={14} />
          ) : (
            <ArrowUpAZ size={14} />
          )}
          {sort === 'date_desc' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="text-xs text-ink-400 flex items-center gap-2">
          {count} {count === 1 ? 'expense' : 'expenses'}
          {isRefreshing && <Loader2 size={12} className="animate-spin" />}
        </div>
        <motion.div
          key={total}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-right"
        >
          <div className="text-xs text-ink-400">Total</div>
          <div className="text-2xl font-semibold tabular">
            {formatRupees(total)}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
