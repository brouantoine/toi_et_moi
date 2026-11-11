/** Money helpers: amounts are integers in the currency's smallest unit (cents). */

export function currencyDigits(currency: string, locale = 'fr'): number {
  try {
    return (
      new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * "12,50" / "12.5" / "1 250" -> 1250 (cents); null when not a positive amount
 * (zero is accepted with `allowZero`, e.g. a share of an expense).
 */
export function parseAmount(text: string, currency: string, allowZero = false): number | null {
  const clean = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const digits = currencyDigits(currency);
  const [whole = '0', frac = ''] = clean.split('.');
  if (frac.length > digits) return null;
  const minor = Number(whole) * 10 ** digits + Number(frac.padEnd(digits, '0') || '0');
  return minor > 0 || (allowZero && minor === 0) ? minor : null;
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  const digits = currencyDigits(currency, locale);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
      minor / 10 ** digits,
    );
  } catch {
    return `${(minor / 10 ** digits).toFixed(digits)} ${currency}`;
  }
}

/** Cents -> editable text in the locale ("12,50"). */
export function amountText(minor: number, currency: string, locale: string): string {
  const digits = currencyDigits(currency, locale);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(minor / 10 ** digits);
}
