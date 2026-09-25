import { afterEach, describe, expect, it } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';
import { shadcnTheme } from '../src/presets/shadcn';

const css = (r: BrowserRuntime, c: string) => {
  r.addClass(c);
  return r.getCss(c) ?? '';
};

describe('shadcnTheme', () => {
  let runtime: BrowserRuntime | undefined;
  afterEach(() => runtime?.destroy());

  it('resolves shadcn classes to the raw :root vars', () => {
    const r = (runtime = new BrowserRuntime({ config: { theme: { extend: shadcnTheme } } }));
    expect(css(r, 'bg-primary')).toContain('var(--primary)');
    expect(css(r, 'text-muted-foreground')).toContain('var(--muted-foreground)');
    expect(css(r, 'border-sidebar-border')).toContain('var(--sidebar-border)');
    // Radii go through theme vars (--radius-lg), which the runtime defines from the preset.
    expect(css(r, 'rounded-lg')).toContain('var(--radius-lg)');
    css(r, 'rounded-sm');
    const vars = document.querySelector('[data-category="css-vars"]')?.textContent ?? '';
    expect(vars).toContain('--radius-lg: var(--radius)');
    expect(vars).toContain('--radius-sm: calc(var(--radius) - 4px)');
  });

  it('supports opacity modifiers', () => {
    const r = (runtime = new BrowserRuntime({ config: { theme: { extend: shadcnTheme } } }));
    const out = css(r, 'bg-primary/90');
    expect(out).toContain('var(--primary)');
    expect(out).toMatch(/90%|0\.9/);
  });
});
