import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { Expense } from '../lib/types';
import { formatRupees } from '../lib/money';

const COLORS = [
  '#7c5cff', '#f59e0b', '#10b981', '#ef4444',
  '#0ea5e9', '#ec4899', '#8b5cf6', '#22c55e', '#64748b',
];

export function SummaryCard({ expenses }: { expenses: Expense[] }) {
  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (expenses.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold">Summary</h3>
        <p className="text-xs text-ink-400 mt-2">
          Add an expense to see a breakdown by category.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold">By category</h3>
      <div className="h-44 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={byCategory}
              dataKey="value"
              innerRadius={42}
              outerRadius={70}
              paddingAngle={2}
              stroke="none"
            >
              {byCategory.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => formatRupees(v)}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #ebebee',
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {byCategory.map((row, i) => (
          <li key={row.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {row.name}
            </span>
            <span className="tabular">{formatRupees(row.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
