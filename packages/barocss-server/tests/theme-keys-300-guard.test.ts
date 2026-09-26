import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '@barocss/kit';
import { ServerRuntime } from '../src/index';

// #300 + #323: the namespaces #300 made var-backed (letterSpacing, borderRadius) never let a block-closing theme key
// or value leave :root, in the kit's themeToCssVars and in ServerRuntime output. Shapes built from char codes.
const CLOSE = String.fromCharCode(125); // block closer
const OPEN = String.fromCharCode(123);
const SEMI = String.fromCharCode(59);
const badValue = `1px${SEMI}${CLOSE}.x${OPEN}color:red`;
const badKey = `k${CLOSE}.y${OPEN}a`;
const theme = {
  extend: {
    letterSpacing: { airy: '0.2em', evil: badValue, [badKey]: '1px' },
    borderRadius: { card: 'calc(1rem + 2px)', evil: badValue },
    fontFamily: { display: ['"Inter Variable"', 'sans-serif'] },
    boxShadow: { card: '0 1px 2px rgb(0 0 0 / 0.1), 0 2px 4px oklch(0.5 0.1 200)' },
    aspect: { poster: '3 / 4' },
  },
};

// Every rule selector outside :root,:host.
const selectors = (css: string) => {
  const out: string[] = [];
  postcss.parse(css).walkRules((r) => { if (!/^:root,\s*:host$/.test(r.selector)) out.push(r.selector); });
  return out;
};

describe('#300 new var-backed namespaces keep #323 theme-var guard', () => {
  it('kit themeToCssVars drops block-closing keys and values, keeps legitimate ones', () => {
    const root = createContext({ theme } as never).themeToCssVars();
    expect(selectors(root)).toEqual([]);
    expect(root).not.toContain(CLOSE + '.x');
    expect(root).not.toContain(CLOSE + '.y');
    expect(root).toContain('--letter-spacing-airy: 0.2em;');
    expect(root).toContain('--radius-card: calc(1rem + 2px);');
    expect(root).toContain('--font-display: "Inter Variable", sans-serif;');
    expect(root).toContain('--shadow-card: 0 1px 2px rgb(0 0 0 / 0.1), 0 2px 4px oklch(0.5 0.1 200);');
    expect(root).toContain('--aspect-poster: 3 / 4;');
  });

  it('ServerRuntime.generateCss emits no rule beyond the requested classes', () => {
    const css = new ServerRuntime({ theme } as never).generateCss('tracking-airy tracking-evil rounded-card rounded-evil');
    const sels = selectors(css);
    expect(sels).toEqual(expect.arrayContaining(['.tracking-airy', '.rounded-card']));
    for (const s of sels) expect(s).toMatch(/^\.(tracking|rounded)-(airy|card|evil)$/);
    expect(css).not.toContain(CLOSE + '.x');
    expect(css).toContain('--letter-spacing-airy: 0.2em');
    expect(css).toContain('--radius-card: calc(1rem + 2px)');
  });
});
