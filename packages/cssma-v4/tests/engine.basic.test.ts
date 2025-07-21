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
}); 