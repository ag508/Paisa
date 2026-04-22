import { z } from 'zod';

export const CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Shopping',
  'Health',
  'Entertainment',
  'Travel',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Shape stored on disk and returned by the API. */
export interface Expense {
  id: string;
  amount: number; // paise (integer)
  category: Category;
  description: string;
  date: string; // ISO date, YYYY-MM-DD (the spend date, not created_at)
  created_at: string; // ISO datetime
}

// Guardrails. These are enforced at the API boundary in addition to any
// client-side checks so a badly-behaved (or replayed) client cannot bypass them.
// - MAX_AMOUNT_PAISE: ₹10 crore per entry. Far above any personal-tracking use
//   case and leaves >5 orders of magnitude of headroom below Number.MAX_SAFE_INTEGER
//   even when summed across many entries.
// - MIN_DATE: 1970-01-01 floor, just to catch obvious typo dates.
export const MAX_AMOUNT_PAISE = 100_000_000_000; // ₹10,00,00,000.00
const MIN_DATE = '1970-01-01';

/** Today's date in any reasonable timezone — inclusive upper bound. */
function todayInclusiveUTC(): string {
  // Allow "tomorrow UTC" so a user in UTC+14 entering today's date locally
  // isn't rejected; the client's date picker already forbids genuine future
  // entry.
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Input validation for the create-expense form / API body. */
export const CreateExpenseInput = z.object({
  amount: z
    .number({ invalid_type_error: 'Amount is required' })
    .int('Amount must be a whole number of paise')
    .positive('Amount must be greater than zero')
    .max(MAX_AMOUNT_PAISE, 'Amount exceeds the supported limit'),
  category: z.enum(CATEGORIES),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(200, 'Keep the description under 200 characters'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((d) => !Number.isNaN(Date.parse(d)), 'Invalid date')
    .refine((d) => d >= MIN_DATE, 'Date is too far in the past')
    .refine((d) => d <= todayInclusiveUTC(), 'Date cannot be in the future'),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseInput>;

export interface ListExpensesQuery {
  category?: Category | 'All';
  sort?: 'date_desc' | 'date_asc';
}
