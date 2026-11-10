import { levelFromDb, placeholderWaveform, resample } from '../waveform';

it('turns decibels into 0-100 levels', () => {
  expect(levelFromDb(0)).toBe(100);
  expect(levelFromDb(-160)).toBe(0);
  expect(levelFromDb(undefined)).toBe(0);
  expect(levelFromDb(-27.5)).toBe(50);
});

it('resamples any number of samples to the bar count', () => {
  expect(resample([], 4)).toEqual([]);
  expect(resample([10, 20, 30, 40, 50, 60, 70, 80], 4)).toEqual([15, 35, 55, 75]);
  expect(resample([40], 3)).toEqual([40, 40, 40]);
});

it('gives old notes a stable, natural waveform', () => {
  const bars = placeholderWaveform(42);
  expect(bars).toEqual(placeholderWaveform(42));
  expect(bars).not.toEqual(placeholderWaveform(43));
  expect(bars.every((bar) => bar >= 0 && bar <= 100)).toBe(true);
});
