// Locale config — initial market is UK (GBP, en-GB). Centralised so we can
// later expose this as a Settings option (USD/EUR/GBP) without touching
// every call site.

export type CurrencyCode = 'GBP' | 'USD' | 'EUR';

export const CURRENCY: CurrencyCode = 'GBP';
export const LOCALE = 'en-GB';

const SYMBOLS: Record<CurrencyCode, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
};

export const CURRENCY_SYMBOL = SYMBOLS[CURRENCY];

// "$160,000" → "£160,000" — formats whole-number currency without decimals.
export function fmtMoney(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '';
  return `${CURRENCY_SYMBOL}${(n as number).toLocaleString(LOCALE, {
    maximumFractionDigits: 0,
  })}`;
}

// Compact form for tight UI: 90000 → "£90k", 1500000 → "£1.5m"
export function fmtMoneyShort(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '';
  const v = n as number;
  if (Math.abs(v) >= 1_000_000) {
    return `${CURRENCY_SYMBOL}${(v / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}m`;
  }
  if (Math.abs(v) >= 1_000) {
    return `${CURRENCY_SYMBOL}${Math.round(v / 1_000)}k`;
  }
  return `${CURRENCY_SYMBOL}${v.toLocaleString(LOCALE)}`;
}
