import { describe, expect, it } from 'vitest';
import { ServerRuntime } from '../src/index';

// #274: every server output path emits the @keyframes an animate-* class references, once per sheet.
const count = (css: string, re: RegExp) => css.match(re)?.length ?? 0;

describe('#274 server @keyframes', () => {
  it('generateCss emits the keyframes once for two classes sharing an animation', () => {
    const css = new ServerRuntime().generateCss('animate-spin md:animate-spin animate-ping');
    expect(count(css, /@keyframes spin\b/g)).toBe(1);
    expect(count(css, /@keyframes ping\b/g)).toBe(1);
    expect(css).toMatch(/--animate-spin: spin 1s linear infinite;/);
  });

  it('generateCssForHtml emits them once per sheet, and not when the build CSS defines them', () => {
    const rt = new ServerRuntime();
    const html = '<a class="animate-spin"></a><b class="hover:animate-spin animate-bounce"></b>';
    const full = rt.generateCssForHtml(html);
    expect(count(full, /@keyframes spin\b/g)).toBe(1);
    expect(count(full, /@keyframes bounce\b/g)).toBe(1);
    const delta = rt.generateCssForHtml(html, { skip: '@keyframes spin { to { transform: rotate(360deg) } }' });
    expect(delta).not.toMatch(/@keyframes spin/);
    expect(count(delta, /@keyframes bounce\b/g)).toBe(1);
    expect(delta).toMatch(/\.animate-spin/);
  });

  it('generateCssForClasses entries stay self-contained', () => {
    const entries = new ServerRuntime().generateCssForClasses(['animate-spin', 'hover:animate-spin']);
    for (const e of entries) expect(count(e.css, /@keyframes spin\b/g)).toBe(1);
  });

  it('supports a custom theme animation', () => {
    const rt = new ServerRuntime({
      theme: { extend: { animation: { wiggle: 'wiggle 1s ease-in-out infinite' }, keyframes: { wiggle: { '0%, 100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } } } } },
    });
    const css = rt.generateCss('animate-wiggle');
    expect(css).toMatch(/--animate-wiggle: wiggle 1s ease-in-out infinite;/);
    expect(count(css, /@keyframes wiggle\b/g)).toBe(1);
  });
});
