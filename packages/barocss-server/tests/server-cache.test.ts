import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createContext, generateCssRules, ruleSortKey, compareKeys } from '@barocss/kit';
import type { Config } from '@barocss/kit';
import { ServerRuntime } from '../src/index';

/** The pre-#272 generateCss, verbatim in behaviour: the reference the cache must match byte for byte. */
function referenceGenerateCss(className: string, config: Config): string {
  const ctx = createContext(config);
  const results = generateCssRules(className, ctx);
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const css of results.flatMap(({ rootCssList }) => rootCssList)) {
    if (!css) continue;
    const key = /^\s*@property\s+(--[\w-]+)/.exec(css)?.[1] ?? css;
    if (seen.has(key)) continue;
    seen.add(key);
    roots.push(css);
  }
  const rules = results
    .map(({ css }) => css)
    .filter(Boolean)
    .map((css, i) => ({ css, i, key: ruleSortKey(css) }))
    .sort((a, b) => compareKeys(a.key, b.key) || a.i - b.i)
    .map(({ css }) => css);
  const refs = (text: string) => [...text.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  const pending = refs([...roots, ...rules].join('\n'));
  let vars = '';
  if (pending.length) {
    const defs = new Map<string, string>();
    for (const m of ctx.themeToCssVars().matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)) defs.set(m[1], m[2]);
    const used = new Map<string, string>();
    while (pending.length) {
      const name = pending.pop()!;
      const value = defs.get(name);
      if (value === undefined || used.has(name)) continue;
      used.set(name, value);
      pending.push(...refs(value));
    }
    if (used.size) vars = ':root,:host {\n' + [...used].map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}';
  }
  return [...(vars ? [vars] : []), ...roots, ...rules].join('\n');
}

const blocksDir = path.resolve(__dirname, '../../../scripts/cms-probe/blocks');
const blockClasses = [
  ...new Set(
    fs
      .readdirSync(blocksDir)
      .flatMap((f) => [...fs.readFileSync(path.join(blocksDir, f), 'utf8').matchAll(/class="([^"]*)"/g)])
      .flatMap((m) => m[1].split(/\s+/).filter(Boolean)),
  ),
].join(' ');
const variantHeavy =
  'hover:bg-blue-500 md:hover:text-red-500 lg:p-4 sm:p-2 dark:bg-gray-900 focus:ring-2 group-hover:opacity-50 ' +
  'md:flex lg:grid-cols-3 sm:rounded-lg xl:shadow-lg before:content-[""] peer-checked:bg-green-500 ' +
  'md:dark:hover:bg-red-700 rounded shadow-md translate-x-2 rotate-45 blur-sm mask-linear-from-10 p-4 m-2 p-4';
const cached = (rt: ServerRuntime) => (rt as unknown as { classCache: Map<string, unknown> }).classCache.size;
const config: Config = { theme: { extend: { colors: { brand: '#123456' } } } };

describe('ServerRuntime per-class cache (#272)', () => {
  it.each([
    ['#253 blocks', blockClasses],
    ['variant-heavy', variantHeavy],
  ])('output is byte-identical to the uncached reference: %s', (_, classes) => {
    const expected = referenceGenerateCss(classes, config);
    const rt = new ServerRuntime(config);
    expect(rt.generateCss(classes)).toBe(expected);
    expect(rt.generateCss(classes)).toBe(expected); // warm
    expect(new ServerRuntime(config, { cacheSize: 0 }).generateCss(classes)).toBe(expected);
    // Overlapping partial requests warm the cache in a different order; the full sheet must not change.
    const rt2 = new ServerRuntime(config);
    rt2.generateCss(classes.split(' ').reverse().slice(0, 40).join(' '));
    expect(rt2.generateCss(classes)).toBe(expected);
  });

  it('generateCssForClasses keeps self-contained per-class entries', () => {
    const rt = new ServerRuntime(config);
    rt.generateCss(variantHeavy);
    for (const { className, css } of rt.generateCssForClasses(variantHeavy.split(' ')))
      expect(css).toBe(referenceGenerateCss(className, config));
  });

  it('setConfig invalidates cached rules and theme vars', () => {
    const rt = new ServerRuntime({ theme: { extend: { colors: { brand: '#111111' } } } });
    expect(rt.generateCss('bg-brand')).toContain('#111111');
    rt.setConfig({ theme: { extend: { colors: { brand: '#222222' } } } });
    const css = rt.generateCss('bg-brand');
    expect(css).toContain('#222222');
    expect(css).not.toContain('#111111');
  });

  it('bounds the cache with LRU eviction', () => {
    const rt = new ServerRuntime({}, { cacheSize: 3 });
    rt.generateCss('p-1 p-2 p-3');
    expect(cached(rt)).toBe(3);
    rt.generateCss('p-1'); // refresh p-1
    rt.generateCss('p-4'); // evicts p-2 (least recent)
    expect(cached(rt)).toBe(3);
    expect(rt.generateCss('p-1 p-2 p-3 p-4')).toBe(referenceGenerateCss('p-1 p-2 p-3 p-4', {}));
    expect(cached(rt)).toBe(3);
    expect(cached(new ServerRuntime({}, { cacheSize: 0 }))).toBe(0);
  });

  it('runtimes with different configs do not share cached results', () => {
    const a = new ServerRuntime({ theme: { extend: { colors: { brand: '#aaaaaa' } } } });
    const b = new ServerRuntime({ theme: { extend: { colors: { brand: '#bbbbbb' } } } });
    expect(a.generateCss('bg-brand text-brand')).toContain('#aaaaaa');
    const cssB = b.generateCss('bg-brand text-brand');
    expect(cssB).toContain('#bbbbbb');
    expect(cssB).not.toContain('#aaaaaa');
    expect(a.generateCss('bg-brand')).not.toContain('#bbbbbb');
  });
});
