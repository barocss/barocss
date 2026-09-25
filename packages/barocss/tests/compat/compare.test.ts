import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import postcss, { type ChildNode } from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { fixtures } from './fixtures';

const tailwindInput = `
@theme inline {
  --spacing: 0.25rem;
  --breakpoint-md: 48rem;
}
@theme {
  --color-red-500: #ef4444;
}
@tailwind utilities;
`;

type CssNode = {
  type: string;
  name?: string;
  params?: string;
  selector?: string;
  prop?: string;
  value?: string;
  nodes?: CssNode[];
};

// Ignore whitespace and the Tailwind license header. Preserve selectors,
// declarations, nesting, and at-rules so a different CSS result stays visible.
function normalizeCss(css: string): CssNode[] {
  const normalizeNode = (node: ChildNode): CssNode => {
    if (node.type === 'decl') {
      return { type: node.type, prop: node.prop, value: node.value };
    }
    if (node.type === 'rule') {
      return { type: node.type, selector: node.selector, nodes: node.nodes.map(normalizeNode) };
    }
    if (node.type === 'atrule') {
      return { type: node.type, name: node.name, params: node.params, nodes: node.nodes?.map(normalizeNode) };
    }
    return { type: node.type };
  };
  return postcss.parse(css).nodes
    .filter((node) => node.type !== 'comment')
    // The theme-variable block (Tailwind's :root, :host) is emitted separately by BaroCSS's theme converter.
    .filter((node) => !(node.type === 'rule' && node.selector === ':root, :host'))
    .map(normalizeNode);
}

async function compare(candidate: string) {
  const compiler = await compile(tailwindInput);
  const tailwindCss = compiler.build([candidate]);
  const context = createContext({
    preflight: false,
    theme: { colors: { red: { 500: '#ef4444' } }, breakpoints: { md: '48rem' } },
  });
  const baroCss = generateCss(candidate, context);
  const tailwindNodes = normalizeCss(tailwindCss);
  const baroNodes = normalizeCss(baroCss);
  const result = tailwindNodes.length === 0 ? 'no-tailwind-rule'
    : baroNodes.length === 0 ? 'unsupported'
    : JSON.stringify(tailwindNodes) === JSON.stringify(baroNodes) ? 'match' : 'different';
  return { result, tailwindCss, baroCss };
}

describe('Tailwind CSS 4.1.13 output comparison', () => {
  it.each(fixtures)('$name: $candidate', async ({ candidate, expected }) => {
    const output = await compare(candidate);
    expect(output.tailwindCss).toContain('/*! tailwindcss v4.1.13');
    expect(output.result, `Tailwind:\n${output.tailwindCss}\nBaroCSS:\n${output.baroCss}`).toBe(expected);
  });

  it('emits a usable standalone mask rule while global property support differs', async () => {
    const { baroCss } = await compare('mask-linear-from-50%');
    expect(baroCss).toContain('--tw-mask-linear-from-position: 50%;');
    expect(baroCss).toContain('--tw-mask-linear: linear-gradient(var(--tw-mask-linear-stops));');
    expect(baroCss).toContain('var(--tw-mask-radial, linear-gradient(#fff, #fff))');
  });

  it('uses current color and defined shadow fallbacks for inset rings', async () => {
    const { baroCss } = await compare('inset-ring-2');
    expect(baroCss).toContain('var(--baro-inset-ring-color, currentcolor)');
    expect(baroCss).toContain('--baro-inset-shadow');
    expect(baroCss).toContain('initial-value: 0 0 #0000');
    expect(baroCss).not.toContain('rgb(59 130 246 / 0.5)');
  });

  it('uses the same md breakpoint value on both sides', async () => {
    const { tailwindCss, baroCss } = await compare('md:block');
    expect(tailwindCss).toContain('(width >= 48rem)');
    expect(baroCss).toContain('(min-width: 48rem)');
  });
});
