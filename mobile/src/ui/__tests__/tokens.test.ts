import { contrastRatio } from '../contrast';
import { palettes, type ColorScheme } from '../tokens';

const AA_TEXT = 4.5;
const schemes: ColorScheme[] = ['light', 'dark'];

describe.each(schemes)('%s palette meets WCAG AA', (scheme) => {
  const p = palettes[scheme];

  it.each([
    ['text on background', p.text, p.background],
    ['text on surface', p.text, p.surface],
    ['muted text on background', p.textMuted, p.background],
    ['muted text on surface', p.textMuted, p.surface],
    ['on-primary on primary', p.onPrimary, p.primary],
    ['on-secondary on secondary', p.onSecondary, p.secondary],
    ['primary (ghost button) on background', p.primary, p.background],
    ['danger on background', p.danger, p.background],
  ])('%s', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

it('computes known contrast ratios', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
});
