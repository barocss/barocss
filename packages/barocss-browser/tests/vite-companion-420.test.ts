import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRuntime } from '../src/baro-boot';

// #420: mirrors main.js in docs/guide/integration/vite-tailwind.md.
// A Tailwind build sheet is present; BaroCSS generates only classes that arrive later and the build lacks.
const injected = () => Array.from(document.querySelectorAll<HTMLStyleElement>('[data-barocss="partition"]'))
  .flatMap(style => Array.from(style.sheet?.cssRules ?? []).map(rule => rule.cssText)).join('\n');

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '<div class="p-4 rounded-lg">built</div><div id="runtime-target"></div>';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { getRuntime().destroy(); vi.restoreAllMocks(); });

describe('Vite + Tailwind companion guide (#420)', () => {
  it('styles classes inserted after the build and skips the ones the build defines', async () => {
    const build = document.createElement('style'); // stands in for the @tailwindcss/vite output
    build.textContent = '@layer utilities{.p-4{padding:calc(var(--spacing)*4)}.rounded-lg{border-radius:var(--radius-lg)}}';
    document.head.appendChild(build);

    const runtime = getRuntime({
      skipExisting: true,
      config: { cssVarPrefix: 'tw', darkMode: 'class', darkModeSelector: '.dark &' },
    });
    runtime.observe(document.body, { scan: true });

    document.getElementById('runtime-target')!.innerHTML =
      '<div class="bg-emerald-700 ring-4 ring-emerald-300 p-4 rounded-lg">Runtime inserted box</div>';

    await vi.waitFor(() => expect(injected()).toContain('.bg-emerald-700'));
    const css = injected();
    expect(css).toContain('.ring-4');
    expect(css).toContain('--tw-');
    expect(css).not.toMatch(/\.p-4\s*\{/);
    expect(css).not.toMatch(/\.rounded-lg\s*\{/);
  });
});
