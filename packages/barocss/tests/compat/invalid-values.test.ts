import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { getUtility } from '../../src/core/registry';
import { parseClassToAst, generateCss } from '../../src/core/engine';
import { IncrementalParser } from '../../src/core/incremental-parser';
import '../../src/presets';

// #213: an unknown bare value must produce no rule (Tailwind 4.1.13 parity).
//   pnpm --filter @barocss/kit exec vitest run tests/compat/invalid-values.test.ts
// prints the BaroCSS-emits / Tailwind-doesn't count over <root>-<junk> for every registered utility root.

const require = createRequire(import.meta.url);
const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
const JUNK = ['balanc', 'notacolor', 'foo', 'x1y'];

describe('invalid bare values (#213)', () => {
  it('emit no rule and resolve to nothing', () => {
    const ctx = createContext({ preflight: false });
    for (const cls of ['text-balanc', 'bg-notacolor', 'border-foo']) {
      expect(parseClassToAst(cls, ctx), cls).toEqual([]);
      expect(generateCss(cls, ctx).trim(), cls).toBe('');
    }
    // The browser runtime's has() caches only what IncrementalParser returns, so nothing may come back here.
    const parser = new IncrementalParser(ctx);
    expect(parser.processClasses(['text-balanc', 'bg-notacolor', 'border-foo'])).toEqual([]);
    for (const cls of ['text-balanc', 'bg-notacolor', 'border-foo']) expect(parser.isProcessed(cls), cls).toBe(false);
  });

  it('keeps valid values', () => {
    const ctx = createContext({ preflight: false });
    for (const cls of [
      'text-red-500', 'text-transparent', 'text-current', 'text-inherit', 'bg-[#123456]', 'bg-(--x)',
      'border-2', 'border-red-500', 'border-transparent', 'text-balance', 'text-lg', 'bg-white', 'bg-red-500/50',
    ]) {
      expect(generateCss(cls, ctx).trim(), cls).not.toBe('');
    }
  });

  it('sweep: BaroCSS emits where Tailwind does not', async () => {
    const ctx = createContext({ preflight: false });
    const roots = [...new Set(getUtility(ctx).filter((u) => u.match(`${u.name}-zz`)).map((u) => u.name))];
    const extra: string[] = [];
    for (const root of roots) {
      for (const junk of JUNK) {
        const cls = `${root}-${junk}`;
        if (generateCss(cls, ctx).trim() === '') continue;
        const compiler = await compile(`${themeCss}\n@tailwind utilities;`);
        if (compiler.build([cls]).includes(`.${cls}`)) continue;
        extra.push(cls);
      }
    }
    const byRoot = new Map<string, number>();
    for (const c of extra) {
      const r = c.slice(0, c.lastIndexOf('-'));
      byRoot.set(r, (byRoot.get(r) ?? 0) + 1);
    }
    // eslint-disable-next-line no-console
    console.log(`invalid-values sweep: ${extra.length} extra rules over ${roots.length} roots x ${JUNK.length} junk\n` +
      [...byRoot].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}:${n}`).join(' '));
    if (process.env.SWEEP_OUT) fs.writeFileSync(process.env.SWEEP_OUT, extra.join('\n'));
    expect(extra).toEqual([]);
  }, 300000);
});
