// Money is stored as an integer number of paise (1 INR = 100 paise) to avoid
// binary-float rounding. All arithmetic on stored amounts uses integers; we
// only convert to a decimal string at the edges (UI formatting + user input).

export type Paise = number;

/** Parse a user-entered rupee string ("1,234.56", "1234", "₹12.5") to paise. */
export function parseRupeesToPaise(input: string): Paise {
  const cleaned = input.replace(/[₹,\s]/g, '').trim();
  // Accept 1234, 1234.5, 1234.56, and .56 — but not "." or "1.234".
  if (!/^-?(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(cleaned)) {
    throw new Error('Enter an amount like 1234 or 1234.56');
  }
  const [whole, frac = ''] = cleaned.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  const sign = whole.startsWith('-') ? -1 : 1;
  const wholeAbs = whole.replace('-', '');
  return sign * (Number(wholeAbs) * 100 + Number(fracPadded));
}

/** Format paise for display, e.g. 123456 -> "1,234.56". */
export function formatPaise(paise: Paise): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toLocaleString('en-IN');
  return `${sign}${wholeStr}.${frac.toString().padStart(2, '0')}`;
}

/** Format with ₹ prefix. */
export function formatRupees(paise: Paise): string {
  return `₹${formatPaise(paise)}`;
}

export function sumPaise(values: Paise[]): Paise {
  // Integer sum — safe up to Number.MAX_SAFE_INTEGER paise (~9e16, i.e. ~₹9e14).
  let total = 0;
  for (const v of values) total += v;
  return total;
}
