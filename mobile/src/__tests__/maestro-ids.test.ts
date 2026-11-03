/**
 * Keeps the Maestro E2E flows coherent with the code: every `id:` used by a flow must be a
 * testID that exists in src/ (literal, or produced by a template such as `tabbar-${name}`).
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const MAESTRO = join(ROOT, '.maestro');

function walk(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, ext);
    return ext.test(name) ? [path] : [];
  });
}

/** testID values found in source: exact strings and template patterns. */
function collectTestIds(): { exact: Set<string>; patterns: RegExp[] } {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  const attr = /(?:testID|TestID)\s*[=:]\s*\{?\s*(['"`])((?:(?!\1).)+)\1/g;
  for (const file of walk(SRC, /\.tsx?$/)) {
    if (file.includes('__tests__')) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(attr)) {
      const value = match[2]!;
      if (value.includes('${')) {
        const source = value
          .split(/\$\{[^}]+\}/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('.+');
        patterns.push(new RegExp(`^${source}$`));
      } else {
        exact.add(value);
      }
    }
    // Derived ids: `${testID}-suffix` patterns used by composite components.
    for (const match of readFileSync(file, 'utf8').matchAll(/\$\{testID\}-([a-z-]+)/g)) {
      patterns.push(new RegExp(`^.+-${match[1]}$`));
    }
  }
  return { exact, patterns };
}

function collectFlowIds(): { file: string; id: string }[] {
  return walk(MAESTRO, /\.ya?ml$/).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/^\s*id:\s*["']?([^"'\s]+)["']?\s*$/gm)].map((m) => ({
      file: file.replace(ROOT, ''),
      id: m[1]!,
    })),
  );
}

describe('Maestro flows', () => {
  const { exact, patterns } = collectTestIds();
  const flowIds = collectFlowIds();

  it('reference at least one id', () => {
    expect(flowIds.length).toBeGreaterThan(10);
  });

  it.each(flowIds.map((f) => [f.id, f.file]))('id "%s" (%s) exists in the app', (id) => {
    const known = exact.has(id) || patterns.some((p) => p.test(id));
    expect(known).toBe(true);
  });
});
