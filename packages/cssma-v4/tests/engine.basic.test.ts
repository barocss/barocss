import { describe, it, expect } from 'vitest';
import { applyClassName, generateUtilityCss } from '../src/core/engine';
import '../src/presets';
import { createContext } from '../src/core/context';

describe('applyClassName (end-to-end)', () => {
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
    const ast = applyClassName('bg-red-500', ctx);
    console.log('AST for bg-red-500:', JSON.stringify(ast, null, 2));
    expect(generateUtilityCss('bg-red-500', ctx)).toBe(
      `.bg-red-500 {
  background-color: #ef4444;
}`
    );
  });

  it('responsive + modifier', () => {
    const ast = applyClassName('sm:hover:bg-red-500', ctx);
    console.log('AST for sm:hover:bg-red-500:', JSON.stringify(ast, null, 2));
    expect(generateUtilityCss('sm:hover:bg-red-500', ctx)).toBe(
      `@media (min-width: 640px) {
  .sm\\:hover\\:bg-red-500:hover {
    background-color: #ef4444;
  }
}`
    );
  });

  it('group-hover + focus', () => {
    const ast = applyClassName('group-hover:focus:bg-blue-500', ctx);
    console.log('AST for group-hover:focus:bg-blue-500:', JSON.stringify(ast, null, 2));
    expect(generateUtilityCss('group-hover:focus:bg-blue-500', ctx)).toBe(
      `.group:hover .group-hover\\:focus\\:bg-blue-500:focus {
  background-color: #3b82f6;
}`
    );
  });

  it('arbitrary value', () => {
    const ast = applyClassName('bg-[#ff0000]', ctx);
    console.log('AST for bg-[#ff0000]:', JSON.stringify(ast, null, 2));
    expect(generateUtilityCss('bg-[#ff0000]', ctx)).toBe(
      `.bg-\\[\\#ff0000\\] {
  background-color: #ff0000;
}`
    );
  });

  it('custom property', () => {
    const ast = applyClassName('bg-(--my-bg)', ctx);
    console.log('AST for bg-(--my-bg):', JSON.stringify(ast, null, 2));
    expect(generateUtilityCss('bg-(--my-bg)', ctx)).toBe(
      `.bg-\\(--my-bg\\) {
  background-size: var(--my-bg);
}`
    );
  });

  it('negative value', () => {
    const ast = applyClassName('-mt-4', ctx);
    console.log('AST for -mt-4:', JSON.stringify(ast, null, 2));
    expect(generateUtilityCss('-mt-4', ctx)).toBe(
      `.-mt-4 {
  margin-top: calc(var(--spacing) * -4);
}`
    );
  });

  it('responsive + arbitrary', () => {
    const ast = applyClassName('md:bg-[rgba(0,0,0,0.5)]', ctx);
    console.log('AST for md:bg-[rgba(0,0,0,0.5)]:', JSON.stringify(ast, null, 2));
    expect(generateUtilityCss('md:bg-[rgba(0,0,0,0.5)]', ctx)).toBe(
      `@media (min-width: 768px) {
  .md\\:bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\] {
    background-size: rgba(0,0,0,0.5);
  }
}`
    );
  });

  it('complex: sm:group-hover:bg-[red]', () => {
    const ast = applyClassName('sm:group-hover:bg-[red]', ctx);
    console.log('AST for sm:group-hover:bg-[red]:', JSON.stringify(ast, null, 2));
    expect(generateUtilityCss('sm:group-hover:bg-[red]', ctx)).toBe(
      `@media (min-width: 640px) {
  .group:hover .sm\\:group-hover\\:bg-\\[red\\] {
    background-size: red;
  }
}`
    );
  });

  it('font size from theme', () => {
    const ast = applyClassName('text-lg', ctx);
    console.log('AST for text-lg:', JSON.stringify(ast, null, 2));
    expect(generateUtilityCss('text-lg', ctx)).toBe(
      `.text-lg {
  font-size: var(--text-lg);
  line-height: var(--text-lg--line-height);
}`
    );
  });

  it('multiple classNames (applyClassList)', () => {
    const classList = 'bg-red-500 text-lg hover:bg-blue-500';
    const asts = classList.split(/\s+/).map(cls => applyClassName(cls, ctx));
    console.log('ASTs for multiple classNames:', JSON.stringify(asts, null, 2));
    expect(generateUtilityCss(classList, ctx)).toBe(
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
    expect(generateUtilityCss('md:focus:bg-yellow-500', ctx)).toBe(
      `@media (min-width: 768px) {
  .md\\:focus\\:bg-yellow-500:focus {
    background-color: #eab308;
  }
}`
    );
  });

  it('complex arbitrary value', () => {
    expect(generateUtilityCss('w-[calc(100%-2rem)]', ctx)).toBe(
      `.w-\\[calc\\(100\\%-2rem\\)\\] {
  width: calc(100%-2rem);
}`
    );
  });

  it('container query', () => {
    expect(generateUtilityCss('container-[size>600px]:p-8', ctx)).toBe(
      `.container-\\[size\\>600px\\]\\:p-8 {
  padding: calc(var(--spacing) * 8);
}`
    );
  });

  it('escape edge case', () => {
    expect(generateUtilityCss('bg-[#abc:def]', ctx)).toBe(
      `.bg-\\[\\#abc\\:def\\] {
  background-size: #abc:def;
}`
    );
  });

  it('dark + focus', () => {
    expect(generateUtilityCss('dark:focus:bg-yellow-500', ctx)).toBe(
      `@media (prefers-color-scheme: dark) {
  .dark\\:focus\\:bg-yellow-500:focus {
    background-color: #eab308;
  }
}`
    );
  });

  it('peer-checked + text', () => {
    expect(generateUtilityCss('peer-checked:text-green-500', ctx)).toBe(
      `.peer:checked ~ .peer-checked\\:text-green-500 {
  color: #22c55e;
}`
    );
  });

  it('arbitrary variant + important', () => {
    expect(generateUtilityCss('!bg-[red]', ctx)).toBe(
      ``
    );
  });

  it('container query orientation', () => {
    expect(generateUtilityCss('container-[orientation=landscape]:flex', ctx)).toBe(
      `.container-\\[orientation\\=landscape\\]\\:flex {
  display: flex;
}`
    );
  });

  it('multiple variants + arbitrary', () => {
    expect(generateUtilityCss('sm:dark:hover:bg-[#123456]', ctx)).toBe(
      `@media (min-width: 640px) {
  @media (prefers-color-scheme: dark) {
    .sm\\:dark\\:hover\\:bg-\\[\\#123456\\]:hover {
      background-color: #123456;
    }
  }
}`
    );
  });

  it('before:content', () => {
    expect(generateUtilityCss("before:content-['foo']", ctx)).toBe(
      `.before\\:content-\\[\\'foo\\'\\]::before {
  content: "'foo'";
}`
    );
  });

  it('peer-[.bar]:text-lg', () => {
    expect(generateUtilityCss('peer-[.bar]:text-lg', ctx)).toBe(
      `.peer-\\[\\.bar\\]\\:text-lg {
  font-size: var(--text-lg);
  line-height: var(--text-lg--line-height);
}`
    );
  });

  it('group-[.foo]:bg-red-500', () => {
    expect(generateUtilityCss('group-[.foo]:bg-red-500', ctx)).toBe(
      `.group-\\[\\.foo\\]\\:bg-red-500 {
  background-color: #ef4444;
}`
    );
  });

  it('sm:peer-checked:underline', () => {
    expect(generateUtilityCss('sm:peer-checked:underline', ctx)).toBe(
      `@media (min-width: 640px) {
  .peer:checked ~ .sm\\:peer-checked\\:underline {
    text-decoration-line: underline;
  }
}`
    );
  });

  it('sm:before:content-[attr(data-label)]', () => {
    expect(generateUtilityCss('sm:before:content-[attr(data-label)]', ctx)).toBe(
      `@media (min-width: 640px) {
  .sm\\:before\\:content-\\[attr\\(data-label\\)\\]::before {
    content: "attr(data-label)";
  }
}`
    );
  });

  it('arbitrary + negative', () => {
    expect(generateUtilityCss('-mt-[12px]', ctx)).toBe(
      ``
    );
  });

  it('arbitrary + custom property', () => {
    expect(generateUtilityCss('text-[(--my-var)]', ctx)).toBe(
      `.text-\\[\\(--my-var\\)\\] {
  color: (--my-var);
}`
    );
  });

  it('arbitrary + pseudo', () => {
    expect(generateUtilityCss("before:bg-[color:var(--brand)]", ctx)).toBe(
      `.before\\:bg-\\[color\\:var\\(--brand\\)\\]::before {
  background-color: var(--brand);
}`
    );
  });
});

describe('variant chain engine (tailwind v4 style)', () => {
  const ctx = createContext({
    theme: { colors: { red: { 500: '#f00' } } }
  });

  it('hover:focus:bg-red-500 → &:focus:hover', () => {
    expect(applyClassName('hover:focus:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:focus:hover',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' }
        ]
      }
    ]);
  });

  it('group-hover:*:bg-red-500 → &:is(:where(.group):hover > *)', () => {
    expect(applyClassName('group-hover:*:bg-red-500', ctx)).toEqual([
      {
        type: 'style-rule',
        selector: '&:is(:where(.group):hover > *)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' }
        ]
      }
    ]);
  });

  it('hover:bg-red-500 → @media (hover: hover) { ... }', () => {
    expect(applyClassName('hover:bg-red-500', ctx)).toEqual([
      {
        type: 'style-rule',
        selector: '&:hover',
        nodes: [
          {
            type: 'at-rule',
            name: 'media',
            params: '(hover: hover)',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' }
            ]
          }
        ]
      }
    ]);
  });
}); 