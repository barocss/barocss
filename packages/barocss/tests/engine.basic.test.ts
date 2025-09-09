import { describe, it, expect } from 'vitest';
import { parseClassToAst, generateCss } from '../src/core/engine';
import '../src/presets';
import { createContext } from '../src/core/context';

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
    const ast = parseClassToAst('bg-red-500', ctx);
    expect(generateCss('bg-red-500', ctx)).toBe(
      `.bg-red-500 {
  background-color: #ef4444;
}`
    );
  });

  it('responsive + modifier', () => {
    const ast = parseClassToAst('sm:hover:bg-red-500', ctx);
    expect(generateCss('sm:hover:bg-red-500', ctx)).toBe(
      `@media (min-width: 640px) {
  .sm\\:hover\\:bg-red-500:hover {
    background-color: #ef4444;
  }
}`
    );
  });

  it('group-hover + focus', () => {
    const ast = parseClassToAst('group-hover:focus:bg-blue-500', ctx);
    expect(generateCss('group-hover:focus:bg-blue-500', ctx)).toBe(
      `.group:hover .group-hover\\:focus\\:bg-blue-500:focus {
  background-color: #3b82f6;
}`
    );
  });

  it('arbitrary value', () => {
    const ast = parseClassToAst('bg-[#ff0000]', ctx);
    expect(generateCss('bg-[#ff0000]', ctx)).toBe(
      `.bg-\\[\\#ff0000\\] {
  background-color: #ff0000;
}`
    );
  });

  it('custom property', () => {
    const ast = parseClassToAst('bg-(--my-bg)', ctx);
    expect(generateCss('bg-(--my-bg)', ctx)).toBe(
      `.bg-\\(--my-bg\\) {
  background-size: var(--my-bg);
}`
    );
  });

  it('negative value', () => {
    const ast = parseClassToAst('-mt-4', ctx);
    expect(generateCss('-mt-4', ctx)).toBe(
      `.-mt-4 {
  margin-top: calc(var(--spacing) * -4);
}`
    );
  });

  it('responsive + arbitrary', () => {
    const ast = parseClassToAst('md:bg-[rgba(0,0,0,0.5)]', ctx);
    expect(generateCss('md:bg-[rgba(0,0,0,0.5)]', ctx)).toBe(
      `@media (min-width: 768px) {
  .md\\:bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\] {
    background-size: rgba(0,0,0,0.5);
  }
}`
    );
  });

  it('complex: sm:group-hover:bg-[red]', () => {
    const ast = parseClassToAst('sm:group-hover:bg-[red]', ctx);
    expect(generateCss('sm:group-hover:bg-[red]', ctx)).toBe(
      `@media (min-width: 640px) {
  .group:hover .sm\\:group-hover\\:bg-\\[red\\] {
    background-size: red;
  }
}`
    );
  });

  it('font size from theme', () => {
    const ast = parseClassToAst('text-lg', ctx);
    expect(generateCss('text-lg', ctx)).toBe(
      `.text-lg {
  font-size: var(--text-lg);
  line-height: var(--text-lg--line-height);
}`
    );
  });

  it('multiple classNames (applyClassList)', () => {
    const classList = 'bg-red-500 text-lg hover:bg-blue-500';
    expect(generateCss(classList, ctx)).toBe(
      `.bg-red-500 {
  background-color: #ef4444;
}
.text-lg {
  font-size: var(--text-lg);
  line-height: var(--text-lg--line-height);
}
.hover\\:bg-blue-500:hover {
  background-color: #3b82f6;
}`
    );
  });

  it('multiple variants and arbitrary', () => {
    expect(generateCss('md:focus:bg-yellow-500', ctx)).toBe(
      `@media (min-width: 768px) {
  .md\\:focus\\:bg-yellow-500:focus {
    background-color: #eab308;
  }
}`
    );
  });

  it('complex arbitrary value', () => {
    expect(generateCss('w-[calc(100%-2rem)]', ctx)).toBe(
      `.w-\\[calc\\(100\\%-2rem\\)\\] {
  width: calc(100%-2rem);
}`
    );
  });

  it('container query', () => {
    expect(generateCss('container-[size>600px]:p-8', ctx)).toBe(
      `.container-\\[size\\>600px\\]\\:p-8 {
  padding: calc(var(--spacing) * 8);
}
`
    );
  });

  it('escape edge case', () => {
    expect(generateCss('bg-[#abc:def]', ctx)).toBe(
      `
`
    );
  });

  it('dark + focus', () => {
    expect(generateCss('dark:focus:bg-yellow-500', ctx)).toBe(
      `@media (prefers-color-scheme: dark) {
  .dark\\:focus\\:bg-yellow-500:focus {
    background-color: #eab308;
  }
}
`
    );
  });

  it('peer-checked + text', () => {
    expect(generateCss('peer-checked:text-green-500', ctx)).toBe(
      `.peer:checked ~ .peer-checked\\:text-green-500 {
  color: #22c55e;
}
`
    );
  });

  it('arbitrary variant + important', () => {
    expect(generateCss('!bg-[red]', ctx)).toBe(
      ``
    );
  });

  it('container query orientation', () => {
    expect(generateCss('container-[orientation=landscape]:flex', ctx)).toBe(
      `.container-\\[orientation\\=landscape\\]\\:flex {
  display: flex;
}
`
    );
  });

  it('multiple variants + arbitrary', () => {
    expect(generateCss('sm:dark:hover:bg-[#123456]', ctx)).toBe(
      `@media (min-width: 640px) {
  @media (prefers-color-scheme: dark) {
    .sm\\:dark\\:hover\\:bg-\\[\\#123456\\]:hover {
      background-color: #123456;
    }
  }
}
`
    );
  });

  it('before:content', () => {
    expect(generateCss("before:content-['foo']", ctx)).toBe(
      `.before\\:content-\\[\\'foo\\'\\]::before {
  content: "'foo'";
}
`
    );
  });

  it('peer-[.bar]:text-lg', () => {
    expect(generateCss('peer-[.bar]:text-lg', ctx)).toBe(
      `.peer-\\[\\.bar\\]\\:text-lg {
  font-size: var(--text-lg);
  line-height: var(--text-lg--line-height);
}
`
    );
  });

  it('group-[.foo]:bg-red-500', () => {
    expect(generateCss('group-[.foo]:bg-red-500', ctx)).toBe(
      `.group-\\[\\.foo\\]\\:bg-red-500 {
  background-color: #ef4444;
}
`
    );
  });

  it('sm:peer-checked:underline', () => {
    expect(generateCss('sm:peer-checked:underline', ctx)).toBe(
      `@media (min-width: 640px) {
  .peer:checked ~ .sm\\:peer-checked\\:underline {
    text-decoration-line: underline;
  }
}
`
    );
  });

  it('sm:before:content-[attr(data-label)]', () => {
    expect(generateCss('sm:before:content-[attr(data-label)]', ctx)).toBe(
      `@media (min-width: 640px) {
  .sm\\:before\\:content-\\[attr\\(data-label\\)\\]::before {
    content: "attr(data-label)";
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
      `.before\\:bg-\\[color\\:var\\(--brand\\)\\]::before {
  background-color: var(--brand);
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
    expect(parseClassToAst('hover:focus:bg-red-500', ctx)).toMatchObject([
      {
        type: 'rule',
        selector: '&:hover',
        nodes: [
          { type: 'rule', selector: '&:focus', nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' }
          ]}
        ]
      }
    ]);
  });

  it('group-hover:*:bg-red-500 → &:is(:where(.group):hover > *)', () => {
    expect(parseClassToAst('group-hover:*:bg-red-500', ctx)).toMatchObject([
      {
        type: 'rule',
        selector: '.group:hover &',
        nodes: [
          { type: 'style-rule', selector: ':is(.group-hover\\:\\*\\:bg-red-500 > *)', nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' }
          ]},
        ]
      }
    ]);
  });

  it('hover:bg-red-500 → @media (hover: hover) { ... }', () => {
    expect(parseClassToAst('hover:bg-red-500', ctx)).toMatchObject([
      {
        type: 'rule',
        selector: '&:hover',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' }
        ]
      }
    ]);
  });
}); 