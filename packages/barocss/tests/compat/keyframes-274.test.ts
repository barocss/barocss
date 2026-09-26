import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss, generateCssRules } from '../../src/core/engine';
import { diffKeyframes, runParity } from './parity-compare';
import '../../src/presets';

// #274: animate-* emits the @keyframes it references, once per sheet, matching Tailwind 4.1.13's frames.
const count = (css: string, re: RegExp) => css.match(re)?.length ?? 0;

describe('#274 @keyframes for animate-*', () => {
  const ctx = createContext({ preflight: false });

  it('emits the referenced keyframes once for two classes sharing an animation', () => {
    const css = generateCss('animate-spin hover:animate-spin', ctx);
    expect(count(css, /@keyframes spin\b/g)).toBe(1);
    expect(css).toMatch(/@keyframes spin \{\s*to \{\s*transform: rotate\(360deg\);/);
  });

  it('carries the keyframes as a root block in generateCssRules', () => {
    const [r] = generateCssRules('animate-ping', ctx);
    expect(r.rootCssList.filter((c) => c.startsWith('@keyframes ping'))).toHaveLength(1);
  });

  it('emits nothing for animate-none', () => {
    expect(generateCss('animate-none', ctx)).not.toMatch(/@keyframes/);
  });

  it('matches Tailwind frames for spin/ping/pulse/bounce', async () => {
    const results = await runParity([['animate-spin', 1], ['animate-ping', 1], ['animate-pulse', 1], ['animate-bounce', 1]]);
    expect(results.filter((r) => !r.pass).map((r) => `${r.token}: ${r.diffs.join('; ')}`)).toEqual([]);
  });

  it('supports a custom theme animation (theme.extend.animation + keyframes)', () => {
    const c = createContext({
      preflight: false,
      theme: { extend: { animation: { wiggle: 'wiggle 1s ease-in-out infinite' }, keyframes: { wiggle: { '0%, 100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } } } } },
    });
    const css = generateCss('animate-wiggle', c);
    expect(css).toMatch(/animation: var\(--animate-wiggle\)/);
    expect(css).toMatch(/@keyframes wiggle \{\s*0%, 100% \{\s*transform: rotate\(-3deg\);/);
    expect(c.themeToCssVars()).toMatch(/--animate-wiggle: wiggle 1s ease-in-out infinite;/);
  });

  it('drops a keyframes block whose name or frames could break out of it (#273)', () => {
    const c = createContext({
      preflight: false,
      theme: { extend: { keyframes: { 'x/*': { to: { opacity: '0' } }, y: { to: { opacity: '0} .a{color:red' } } } } },
    });
    const css = generateCss('animate-[x/*_1s] animate-[y_1s]', c);
    expect(css).not.toMatch(/@keyframes/);
  });

  it('comparator flags a missing or different @keyframes', () => {
    const tw = '@keyframes spin { to { transform: rotate(360deg); } }';
    const out: string[] = [];
    diffKeyframes(tw, '.animate-spin{animation:var(--animate-spin)}', out);
    expect(out).toEqual(['@keyframes spin missing']);
    const out2: string[] = [];
    diffKeyframes(tw, '@keyframes spin { 100% { transform: rotate(180deg) } }', out2);
    expect(out2[0]).toMatch(/^@keyframes spin: /);
    const out3: string[] = [];
    diffKeyframes('@keyframes p { 75%, 100% { opacity: 0; } }', '@keyframes p { 75%{opacity:0} 100%{opacity:0} }', out3);
    expect(out3).toEqual([]);
  });
});
