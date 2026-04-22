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

/** Input validation for the create-expense form / API body. */
export const CreateExpenseInput = z.object({
  amount: z
    .number({ invalid_type_error: 'Amount is required' })
    .int('Amount must be a whole number of paise')
    .positive('Amount must be greater than zero'),
  category: z.enum(CATEGORIES),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(200, 'Keep the description under 200 characters'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((d) => !Number.isNaN(Date.parse(d)), 'Invalid date'),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseInput>;

export interface ListExpensesQuery {
  category?: Category | 'All';
  sort?: 'date_desc' | 'date_asc';
}
