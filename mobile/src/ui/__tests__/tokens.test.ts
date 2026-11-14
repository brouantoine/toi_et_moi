import { contrastRatio } from '../contrast';
import { ACCENT_IDS, hues, paletteFor, palettes, type ColorScheme } from '../tokens';

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
    ['on-success on success (answer a call)', p.onSuccess, p.success],
    ['primary (ghost button) on background', p.primary, p.background],
    ['danger on background', p.danger, p.background],
    ['text on muted surface (chips, search)', p.text, p.surfaceMuted],
    ['muted text on muted surface', p.textMuted, p.surfaceMuted],
    ['selected chip (background on text)', p.background, p.text],
    ['on-primary-soft on primary-soft', p.onPrimarySoft, p.primarySoft],
    ['on-secondary-soft on secondary-soft', p.onSecondarySoft, p.secondarySoft],
    ['primary (link) on surface', p.primary, p.surface],
  ])('%s', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

it('computes known contrast ratios', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
});

describe.each(schemes)('%s category hues meet WCAG AA', (scheme) => {
  it.each(Object.entries(hues[scheme]))('%s', (_name, { fg, bg }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    // Hue text also reads on the plain surfaces (rail labels, detail overline).
    expect(contrastRatio(fg, palettes[scheme].background)).toBeGreaterThanOrEqual(AA_TEXT);
    // Body text stays readable on a hue-tinted card (quotes).
    expect(contrastRatio(palettes[scheme].text, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(palettes[scheme].textMuted, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe.each(schemes)('%s couple accents meet WCAG AA', (scheme) => {
  it.each(ACCENT_IDS)('%s', (accent) => {
    const p = paletteFor(scheme, accent);
    expect(contrastRatio(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.primary, p.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.primary, p.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.onPrimarySoft, p.primarySoft)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.text, p.primarySoft)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.textMuted, p.primarySoft)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

/** WCAG 1.4.11: icons, borders and other graphics need 3:1 against what they sit on. */
const AA_GRAPHIC = 3;

describe.each(schemes)('%s red shades and wash stay readable', (scheme) => {
  it.each(ACCENT_IDS)('%s', (accent) => {
    const p = paletteFor(scheme, accent);
    // Titles and captions sit on the top of the wash, where it is the most saturated.
    expect(contrastRatio(p.text, p.wash)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.textMuted, p.wash)).toBeGreaterThanOrEqual(AA_TEXT);
    // Buttons, icons and the round back button over the wash.
    expect(contrastRatio(p.primary, p.wash)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    // Selected state on a rose-red fill (border, check badge).
    expect(contrastRatio(p.primary, p.primarySoft)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    // Links and ghost buttons on the sunken grey fills.
    expect(contrastRatio(p.primary, p.surfaceMuted)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    // The Bolingo red (logo, loader) reads on every background, wash included.
    expect(contrastRatio(p.brand, p.background)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    expect(contrastRatio(p.brand, p.surface)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    expect(contrastRatio(p.brand, p.wash)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });
});

describe.each(schemes)('%s night-safe pairs', (scheme) => {
  const p = palettes[scheme];
  it.each([
    ['danger on surface (sheets, cards)', p.danger, p.surface],
    ['danger on muted surface (field errors)', p.danger, p.surfaceMuted],
    ['on-primary-soft on background', p.onPrimarySoft, p.background],
  ])('%s', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('keeps the default red the Bolingo red', () => {
    expect(p.primary).toBe(p.brand);
  });
});
