// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { isSafeThemeVar, isSelfReferencingVar, themeToCssVarsAll, toCssVarsBlock } from '../../src/core/cssVars';
import { ServerRuntime } from '../../../barocss-server/src/index';
import { BrowserRuntime } from '../../../barocss-browser/src/browser-runtime';
import '../../src/presets';

// #323: theme config can come from an untrusted source. Every theme variable is printed as `name: value;`
// inside the :root block, so a name or value that could change the block's structure is dropped.
//   pnpm --filter @barocss/kit exec vitest run tests/security/theme-vars-323.test.ts

const ch = (n: number) => String.fromCharCode(n);
const OPEN = ch(123);
const CLOSE = ch(125);
const SEMI = ch(59);
const SLASH = ch(47);
const STAR = ch(42);
const MARK = 'zzmark';

// A shape that would end the declaration and the block, then start a rule of its own.
const breakout = `red${SEMI}${CLOSE}.${MARK}${OPEN}color:red`;
const hostileValues = [
  breakout,
  `red${SEMI}color:blue`,
  `red ${SLASH}${STAR}`,
  `red ${STAR}${SLASH} x`,
  `red${CLOSE}`,
];
const hostileKeys = [
  `a${CLOSE}.${MARK}${OPEN}x`,
  `a${SEMI}b`,
  `a${SLASH}${STAR}`,
  'a b',
];

const hostileConfig = () => ({
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(hostileValues.map((v, i) => [`evil${i}`, v])),
        ...Object.fromEntries(hostileKeys.map((k) => [k, 'red'])),
        okay: '#123456',
      },
    },
  },
});

const assertOnlyRoot = (css: string) => {
  expect(css).not.toContain(MARK);
  expect(css).not.toContain(SLASH + STAR);
  expect(css).not.toContain(STAR + SLASH);
  // one :root block → exactly one closing brace
  expect(css.split(CLOSE).length - 1).toBe(1);
};

describe('#323 theme variable emitter', () => {
  it('isSafeThemeVar rejects hostile names and values', () => {
    for (const v of hostileValues) expect(isSafeThemeVar('--color-x', v)).toBe(false);
    for (const k of hostileKeys) expect(isSafeThemeVar(`--color-${k}`, 'red')).toBe(false);
    expect(isSafeThemeVar('--spacing-0\\.5', '0.125rem')).toBe(true);
    expect(isSafeThemeVar('--z', 10)).toBe(true);
  });

  it('toCssVarsBlock drops hostile entries directly', () => {
    const vars: Record<string, string> = { '--ok': '1px' };
    hostileValues.forEach((v, i) => { vars[`--v${i}`] = v; });
    hostileKeys.forEach((k) => { vars[`--${k}`] = 'red'; });
    const css = toCssVarsBlock(vars);
    assertOnlyRoot(css);
    expect(css).toContain('--ok: 1px;');
  });

  it('themeToCssVars emits no rule outside :root', () => {
    const ctx = createContext(hostileConfig());
    const css = ctx.themeToCssVars();
    assertOnlyRoot(css);
    expect(css).toContain('--color-okay: #123456;');
    for (let i = 0; i < hostileValues.length; i++) expect(css).not.toContain(`--color-evil${i}:`);
  });

  it('kit generateCss adds no rule for hostile theme entries', () => {
    const ctx = createContext(hostileConfig());
    const classes = hostileValues.map((_, i) => `bg-evil${i}`).join(' ') + ' bg-okay';
    const css = generateCss(classes, ctx);
    expect(css).not.toContain('.' + MARK);
    expect(css).not.toContain(SLASH + STAR);
  });

  it('ServerRuntime.generateCss referenced-var block stays inside :root', () => {
    const s = new ServerRuntime(hostileConfig());
    const css = String(s.generateCss(hostileValues.map((_, i) => `bg-evil${i}`).join(' ') + ' bg-okay'));
    expect(css).not.toContain('.' + MARK);
    expect(css).not.toContain(SLASH + STAR);
    expect(css).not.toContain(STAR + SLASH);
  });
});

describe('#323 browser runtime theme block', () => {
  let runtime: BrowserRuntime | undefined;
  afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

  it('injects no rule from hostile theme entries', () => {
    document.head.innerHTML = '';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    runtime = new BrowserRuntime({ config: hostileConfig() as any });
    runtime.addClass('bg-okay');
    const styles = Array.from(document.querySelectorAll('style'));
    const text = styles.map((s) => s.textContent ?? '').join('\n');
    const rules = styles.flatMap((s) => Array.from(s.sheet?.cssRules ?? []).map((r) => r.cssText)).join('\n');
    expect(text + rules).not.toContain(MARK);
    expect(text + rules).toContain('--color-okay');
  });
});

describe('#323 legitimate theme values stay byte-identical', () => {
  const legit: Record<string, string> = {
    fontFamily: `"Inter Var", 'Helvetica Neue', ui-sans-serif, sans-serif`,
    calc: 'calc(100% - 2rem)',
    oklch: 'oklch(62.3% 0.214 259.815)',
    ratio: '3 / 4',
    shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    url: 'url("data:image/svg+xml,%3csvg%3e%3c/svg%3e")',
  };

  it('each value is printed unchanged', () => {
    const vars = Object.fromEntries(Object.entries(legit).map(([k, v]) => [`--x-${k}`, v]));
    const css = toCssVarsBlock(vars);
    for (const [k, v] of Object.entries(legit)) expect(css).toContain(`  --x-${k}: ${v};\n`);
  });

  it('default theme output is byte-identical to the unguarded emitter', () => {
    const ctx = createContext({});
    const cats = ['colors', 'boxShadow', 'fontSize', 'fontWeight', 'fontFamily', 'letterSpacing', 'spacing', 'container',
      'borderRadius', 'zIndex', 'opacity', 'animations', 'animation', 'transitionTimingFunction', 'transitionDuration',
      'transitionDelay', 'blur', 'textShadow', 'dropShadow', 'aspect'];
    const vars = themeToCssVarsAll(Object.fromEntries(cats.map((c) => [c, ctx.theme(c)])) as any);
    const unguarded = ':root,:host {\n' + Object.entries(vars).filter(([k, v]) => !isSelfReferencingVar(k, v))
      .map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n\n';
    expect(toCssVarsBlock(vars)).toBe(unguarded);
    expect(ctx.themeToCssVars()).toBe(unguarded);
    expect(unguarded).toContain('--spacing-0\\.5: 0.125rem;');
  });
});
