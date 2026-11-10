/** Voice-note waveform helpers: loudness samples in, a fixed number of 0-100 bars out. */

export const WAVEFORM_BARS = 48;
/** Quietest level drawn, in dB: below this the bar is at its minimum. */
const FLOOR_DB = -55;

/** dB metering (about -160 silent … 0 loud) to a 0-100 level. */
export function levelFromDb(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  const clamped = Math.min(0, Math.max(FLOOR_DB, db));
  return Math.round(((clamped - FLOOR_DB) / -FLOOR_DB) * 100);
}

/** Squeezes or stretches samples into `bars` values (averaging each bucket). */
export function resample(samples: number[], bars = WAVEFORM_BARS): number[] {
  if (samples.length === 0) return [];
  return Array.from({ length: bars }, (_, index) => {
    const start = Math.floor((index * samples.length) / bars);
    const end = Math.max(start + 1, Math.floor(((index + 1) * samples.length) / bars));
    const bucket = samples.slice(start, end);
    return Math.round(bucket.reduce((sum, value) => sum + value, 0) / bucket.length);
  });
}

/** Older notes have no waveform: a stable, natural-looking one derived from the id. */
export function placeholderWaveform(seed: number, bars = WAVEFORM_BARS): number[] {
  let state = Math.abs(seed) % 2147483647 || 1;
  return Array.from({ length: bars }, (_, index) => {
    state = (state * 16807) % 2147483647;
    const envelope = Math.sin((Math.PI * (index + 0.5)) / bars);
    return Math.round(25 + 60 * envelope * ((state % 100) / 100));
  });
}
