/** "1 240 km" with the locale's grouping; 0 means under a kilometre. */
export function formatKm(km: number, locale: string): string {
  return `${new Intl.NumberFormat(locale).format(km)} km`;
}

/** "il y a 5 min", "à l'instant"… from an ISO date. */
export function formatAgo(iso: string, locale: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.round((time - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
}
