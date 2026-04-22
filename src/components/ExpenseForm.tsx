import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Plus, AlertCircle } from 'lucide-react';
import { useCreateExpense } from '../hooks/useExpenses';
import { CATEGORIES, type Category, CreateExpenseInput } from '../lib/types';
import { parseRupeesToPaise } from '../lib/money';
import { newIdempotencyKey, ApiError } from '../api/client';

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function ExpenseForm() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [localError, setLocalError] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // An idempotency key belongs to an in-flight submission, not to a click.
  // We allocate one lazily on first submit and keep it while the mutation is
  // retrying or re-fired by a double-click. Once we've seen a success (or the
  // user edits the form), we rotate to a fresh key for the next submission.
  const idemKey = useRef<string | null>(null);

  const createMutation = useCreateExpense();

  const disabled = createMutation.isPending;

  const serverError = useMemo(() => {
    const err = createMutation.error;
    if (!err) return null;
    if (err instanceof ApiError) return err.message;
    return 'Could not save expense. Please try again.';
  }, [createMutation.error]);

  function resetForm(savedId: string) {
    setAmount('');
    setDescription('');
    setDate(todayISO());
    setCategory('Food');
    idemKey.current = null; // next submit gets a new key
    setJustSavedId(savedId);
    setTimeout(() => setJustSavedId((id) => (id === savedId ? null : id)), 1500);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    let paise: number;
    try {
      paise = parseRupeesToPaise(amount);
    } catch (err) {
      setLocalError((err as Error).message);
      return;
    }
    const parsed = CreateExpenseInput.safeParse({
      amount: paise,
      category,
      description,
      date,
    });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    if (!idemKey.current) idemKey.current = newIdempotencyKey();

    try {
      const saved = await createMutation.mutateAsync({
        ...parsed.data,
        idempotencyKey: idemKey.current,
      });
      resetForm(saved.id);
    } catch {
      // Error surfaced via createMutation.error; keep idempotency key so a
      // subsequent manual retry is still deduped against the same submission.
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Add expense</h2>
        <AnimatePresence>
          {justSavedId && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-xs text-emerald-600"
            >
              <Check size={14} /> saved
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-ink-500">Amount (₹)</label>
          <input
            className="input tabular mt-1"
            placeholder="0.00"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              idemKey.current = null; // edits rotate the key
            }}
            disabled={disabled}
          />
        </div>

        <div>
          <label className="text-xs text-ink-500">Category</label>
          <select
            className="input mt-1"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            disabled={disabled}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-ink-500">Description</label>
          <input
            className="input mt-1"
            placeholder="Coffee with Anu"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled}
            maxLength={200}
          />
        </div>

        <div>
          <label className="text-xs text-ink-500">Date</label>
          <input
            type="date"
            className="input mt-1"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            disabled={disabled}
          />
        </div>

        <AnimatePresence>
          {(localError || serverError) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{localError ?? serverError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" className="btn-primary w-full" disabled={disabled}>
          {disabled ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Plus size={16} />
              Add expense
            </>
          )}
        </button>
      </div>
    </form>
  );
}
