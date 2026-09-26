import { parseWithoutHoverMedia } from './hover-media-test-utils';
import { describe, it, expect } from 'vitest';
import { parseClassToAst, generateCss, generateCssRules } from '../src/core/engine';
import '../src/presets';
import { createContext } from '../src/core/context';
import { rootToCss } from '../src/core/astToCss';
import { functionalModifier } from '../src/core/registry';

// before:/after: register --baro-content so the pseudo-element exists (#191).
const BARO_CONTENT_PROPERTY = '@property --baro-content {\n\tsyntax: "*";\n\tinherits: false;\n\tinitial-value: "";\n}\n';

describe('parseClassToAst (end-to-end)', () => {
  const ctx = createContext({
    theme: {
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      },
      colors: { red: { 500: '#ef4444' }, blue: { 500: '#3b82f6' }, green: { 500: '#22c55e' }, yellow: { 500: '#eab308' } },
      spacing: { 4: '1rem', 8: '2rem' },
      fontSize: { lg: '1.125rem' }
    }
  });

  it('basic utility', () => {
    expect(generateCss('bg-red-500', ctx)).toBe(
      `.bg-red-500 {
  background-color: var(--color-red-500);
}
`
    );
  });

  it('responsive + modifier', () => {
    expect(generateCss('sm:hover:bg-red-500', ctx)).toBe(
      `@media (min-width: 640px) {
  @media (hover: hover) {
    .sm\\:hover\\:bg-red-500:hover {
      background-color: var(--color-red-500);
    }
  }
}
`
    );
  });

  it('group-hover + focus', () => {
    expect(generateCss('group-hover:focus:bg-blue-500', ctx)).toBe(
      `@media (hover: hover) {
  .group-hover\\:focus\\:bg-blue-500:is(:where(.group):hover *):focus {
    background-color: var(--color-blue-500);
  }
}
`
    );
  });

  it('arbitrary value', () => {
    expect(generateCss('bg-[#ff0000]', ctx)).toBe(
      `.bg-\\[\\#ff0000\\] {
  background-color: #ff0000;
}
`
    );
  });

  it('custom property', () => {
    expect(generateCss('bg-(--my-bg)', ctx)).toBe(
      `.bg-\\(--my-bg\\) {
  background-color: var(--my-bg);
}
`
    );
  });

  it('negative value', () => {
    const ast = parseClassToAst('-mt-4', ctx);
    expect(generateCss('-mt-4', ctx)).toBe(
      `.-mt-4 {
  margin-top: calc(var(--spacing) * -4);
}
`
    );
  });

  it('responsive + arbitrary', () => {
    const ast = parseClassToAst('md:bg-[rgba(0,0,0,0.5)]', ctx);
    expect(generateCss('md:bg-[rgba(0,0,0,0.5)]', ctx)).toBe(
      `@media (min-width: 768px) {
  .md\\:bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\] {
    background-color: rgba(0,0,0,0.5);
  }
}
`
    );
  });

  it('complex: sm:group-hover:bg-[red]', () => {
    expect(generateCss('sm:group-hover:bg-[red]', ctx)).toBe(
      `@media (min-width: 640px) {
  @media (hover: hover) {
    .sm\\:group-hover\\:bg-\\[red\\]:is(:where(.group):hover *) {
      background-color: red;
    }
  }
}
`
    );
  });

  it('font size from theme', () => {
    const ast = parseClassToAst('text-lg', ctx);
    expect(generateCss('text-lg', ctx)).toBe(
      `.text-lg {
  font-size: var(--text-lg);
  line-height: var(--baro-leading, var(--text-lg--line-height));
}
`
    );
  });

  it('multiple classNames (applyClassList)', () => {
    const classList = 'bg-red-500 text-lg hover:bg-blue-500';
    expect(generateCss(classList, ctx)).toBe(
      `.bg-red-500 {
  background-color: var(--color-red-500);
}

.text-lg {
  font-size: var(--text-lg);
  line-height: var(--baro-leading, var(--text-lg--line-height));
}

@media (hover: hover) {
  .hover\\:bg-blue-500:hover {
    background-color: var(--color-blue-500);
  }
}
`
    );
  });

  it('multiple variants and arbitrary', () => {
    expect(generateCss('md:focus:bg-yellow-500', ctx)).toBe(
      `@media (min-width: 768px) {
  .md\\:focus\\:bg-yellow-500:focus {
    background-color: var(--color-yellow-500);
  }
}
`
    );
  });

  it('complex arbitrary value', () => {
    expect(generateCss('w-[calc(100%-2rem)]', ctx)).toBe(
      `.w-\\[calc\\(100\\%-2rem\\)\\] {
  width: calc(100% - 2rem);
}
`
    );
  });

  it('does not emit CSS for an unsupported container variant', () => {
    expect(generateCss('container-[size>600px]:p-8', ctx)).toBe('');
  });

  it('escape edge case', () => {
    expect(generateCss('bg-[#abc:def]', ctx)).toBe('');
  });

  it('dark + focus', () => {
    expect(generateCss('dark:focus:bg-yellow-500', ctx)).toBe(
      `@media (prefers-color-scheme: dark) {
  .dark\\:focus\\:bg-yellow-500:focus {
    background-color: var(--color-yellow-500);
  }
}
`
    );
  });

  it('peer-checked + text', () => {
    expect(generateCss('peer-checked:text-green-500', ctx)).toBe(
      `.peer-checked\\:text-green-500:is(:where(.peer):checked~*) {
  color: var(--color-green-500);
}
`
    );
  });

  it('arbitrary variant + important', () => {
    expect(generateCss('!bg-[red]', ctx)).toBe(
      `.\\!bg-\\[red\\] {
  background-color: red !important;
}
`
    );
  });

  it('keeps important per class in generateCssRules', () => {
    const [importantRule, regularRule] = generateCssRules('!bg-[red] bg-blue-500', ctx);
    expect(importantRule.css).toContain('background-color: red !important;');
    expect(regularRule.css).toContain('background-color: var(--color-blue-500);');
    expect(regularRule.css).not.toContain('!important');
  });

  it('rejects an unknown variant and retries after registration', () => {
    const local = createContext({});
    const className = 'missing-variant:block';
    expect(parseClassToAst(className, local)).toEqual([]);
    expect(generateCss(className, local)).toBe('');
    expect(generateCssRules(className, local)[0].css).toBe('');

    functionalModifier(
      (name) => name === 'missing-variant',
      () => '&:where(.ready)',
      undefined,
      {},
      local,
    );
    expect(generateCss(className, local)).toContain(':where(.ready)');
  });

  it('emits gradient root declarations once for multiple classes', () => {
    const css = generateCss('from-red-500 bg-blue-500', ctx);
    expect(css.match(/@property --baro-gradient-from \{/g)).toHaveLength(1);
    expect(css).toMatch(/^@property --baro-gradient-position \{/);
    expect(css).not.toContain(':root,:host {@property');
    expect(css).toContain('background-color: var(--color-blue-500);');
  });

  it('does not emit CSS for an unsupported container orientation variant', () => {
    expect(generateCss('container-[orientation=landscape]:flex', ctx)).toBe('');
  });

  it('multiple variants + arbitrary', () => {
    expect(generateCss('sm:dark:hover:bg-[#123456]', ctx)).toBe(
      `@media (min-width: 640px) {
  @media (prefers-color-scheme: dark) {
    @media (hover: hover) {
      .sm\\:dark\\:hover\\:bg-\\[\\#123456\\]:hover {
        background-color: #123456;
      }
    }
  }
}
`
    );
  });

  it('before:content', () => {
    expect(generateCss("before:content-['foo']", ctx)).toBe(
      `${BARO_CONTENT_PROPERTY}.before\\:content-\\[\\'foo\\'\\]::before {
  --baro-content: "'foo'";
  content: var(--baro-content);
}
`
    );
  });

  it('peer-[.bar]:text-lg', () => {
    expect(generateCss('peer-[.bar]:text-lg', ctx)).toBe(
      `.peer-\\[\\.bar\\]\\:text-lg:is(:where(.peer):is(.bar)~*) {
  font-size: var(--text-lg);
  line-height: var(--baro-leading, var(--text-lg--line-height));
}
`
    );
  });

  it('group-[.foo]:bg-red-500', () => {
    expect(generateCss('group-[.foo]:bg-red-500', ctx)).toBe(
      `.group-\\[\\.foo\\]\\:bg-red-500:is(:where(.group):is(.foo) *) {
  background-color: var(--color-red-500);
}
`
    );
  });

  it('sm:peer-checked:underline', () => {
    expect(generateCss('sm:peer-checked:underline', ctx)).toBe(
      `@media (min-width: 640px) {
  .sm\\:peer-checked\\:underline:is(:where(.peer):checked~*) {
    text-decoration-line: underline;
  }
}
`
    );
  });

  it('sm:before:content-[attr(data-label)]', () => {
    expect(generateCss('sm:before:content-[attr(data-label)]', ctx)).toBe(
      `${BARO_CONTENT_PROPERTY}@media (min-width: 640px) {
  .sm\\:before\\:content-\\[attr\\(data-label\\)\\]::before {
    --baro-content: "attr(data-label)";
    content: var(--baro-content);
  }
}
`
    );
  });

  it('arbitrary + negative', () => {
    expect(generateCss('-mt-[12px]', ctx)).toBe(
      ``
    );
  });

  it('arbitrary + custom property', () => {
    expect(generateCss('text-[var(--my-var)]', ctx)).toBe(
      `.text-\\[var\\(--my-var\\)\\] {
  color: var(--my-var);
}
`
    );
  });

  it('arbitrary + pseudo', () => {
    expect(generateCss("before:bg-[color:var(--brand)]", ctx)).toBe(
      `${BARO_CONTENT_PROPERTY}.before\\:bg-\\[color\\:var\\(--brand\\)\\]::before {
  background-color: var(--brand);
  content: var(--baro-content);
}
`
    );
  });
});

describe('variant chain engine', () => {
  const ctx = createContext({
    theme: { colors: { red: { 500: '#f00' } } }
  });

  it('hover:focus:bg-red-500 → &:focus:hover', () => {
    expect(parseWithoutHoverMedia('hover:focus:bg-red-500', ctx)).toMatchObject([
      {
        type: 'rule',
        selector: '&:hover',
        nodes: [
          { type: 'rule', selector: '&:focus', nodes: [
            { type: 'decl', prop: 'background-color', value: 'var(--color-red-500)' }
          ]}
        ]
      }
    ]);
  });

  it('group-hover:*:bg-red-500 → &:is(:where(.group):hover > *)', () => {
    expect(parseWithoutHoverMedia('group-hover:*:bg-red-500', ctx)).toMatchObject([
      {
        type: 'rule',
        selector: '&:is(:where(.group):hover *)',
        nodes: [
          { type: 'rule', selector: ':is(& > *)', nodes: [
              { type: 'decl', prop: 'background-color', value: 'var(--color-red-500)' }
          ]},
        ]
      }
    ]);
  });

  it('hover:bg-red-500 → @media (hover: hover) { ... }', () => {
    expect(parseWithoutHoverMedia('hover:bg-red-500', ctx)).toMatchObject([
      {
        type: 'rule',
        selector: '&:hover',
        nodes: [
          { type: 'decl', prop: 'background-color', value: 'var(--color-red-500)' }
        ]
      }
    ]);
  });

  it('minifies root at-rules and :root declarations', () => {
    const css = generateCss('from-red-500 bg-blue-500 ring-2', ctx, { minify: true });
    expect(css).not.toMatch(/[\n\t]/);
    expect(css).toContain('@property --baro-gradient-from{');
  });

  it('minified root output equals non-minified after stripping whitespace', () => {
    const classes = 'from-red-500 bg-blue-500 ring-2';
    const strip = (css: string) => css.replace(/\s+/g, '');
    expect(strip(generateCss(classes, ctx, { minify: true }))).toBe(strip(generateCss(classes, ctx)));
  });

  it('rootToCss drops unsafe declarations identically in minified and non-minified mode', () => {
    const unsafe = { type: 'decl', prop: '--x', value: 'a}b' } as any;
    const safe = { type: 'decl', prop: '--y', value: '1' } as any;
    expect(rootToCss([unsafe])).toBe('');
    expect(rootToCss([unsafe], { minify: true })).toBe('');
    const rule = { type: 'at-rule', name: 'property', params: '--z', nodes: [unsafe, safe] } as any;
    const min = rootToCss([rule], { minify: true });
    expect(min).toBe('@property --z{--y:1;}');
    expect(min).not.toMatch(/[\n\t]/);
    expect(rootToCss([rule]).replace(/\s+/g, '')).toBe(min.replace(/\s+/g, ''));
  });

  it('emits no :root block when no root declaration survives', () => {
    const unsafe = { type: 'decl', prop: '--x', value: 'a}b' } as any;
    const kept = [unsafe].map((n) => rootToCss([n], { minify: true })).filter((d) => d !== '');
    expect(kept).toHaveLength(0);
    expect(generateCss('bg-blue-500', ctx, { minify: true })).not.toContain(':root');
  });
});
