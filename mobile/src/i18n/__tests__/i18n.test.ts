import { getLocales } from 'expo-localization';

import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { detectLanguage } from '..';

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'fr' }]) }));

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

describe('i18n', () => {
  it('has the same keys in French and English', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });

  it('has no empty translation', () => {
    const leaves = (tree: Tree): string[] =>
      Object.values(tree).flatMap((v) => (typeof v === 'string' ? [v] : leaves(v)));
    for (const locale of [fr, en]) {
      leaves(locale).forEach((v) => expect(v.trim()).not.toBe(''));
    }
  });

  it('falls back to French for unsupported device languages', () => {
    jest.mocked(getLocales).mockReturnValueOnce([{ languageCode: 'de' }] as never);
    expect(detectLanguage()).toBe('fr');
  });

  it('uses English when the device is in English', () => {
    jest.mocked(getLocales).mockReturnValueOnce([{ languageCode: 'en' }] as never);
    expect(detectLanguage()).toBe('en');
  });
});
