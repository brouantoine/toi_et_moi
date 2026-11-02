/**
 * Product rule: icons come from Lucide only; emoji are never rendered in the UI
 * (no Twemoji/system emoji look). This test fails if an emoji sneaks into the
 * source code or into any translation.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;
const SRC = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|json)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

describe('no emoji in the app', () => {
  it.each(files(SRC).map((f) => [relative(SRC, f)]))('%s', (file) => {
    const match = readFileSync(join(SRC, file), 'utf8').match(EMOJI);
    expect(match?.[0]).toBeUndefined();
  });

  it('detects emoji (self-check)', () => {
    expect('Bravo \u{2764}\u{FE0F}'.match(EMOJI)).not.toBeNull();
    expect('Un instant… « guillemets » — tiret'.match(EMOJI)).toBeNull();
  });
});
