import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { astToCss } from '../../src/core/astToCss';
import '../../src/presets';

// #224: an arbitrary or custom-property value must never change the structure of the generated declaration block.
// Each repro must emit nothing, or exactly one rule whose declarations are the utility's own property only.
//   pnpm --filter @barocss/kit exec vitest run tests/security/value-structure.test.ts

// Generic malformed shapes: statement/block delimiters outside strings, unbalanced or mismatched brackets and an
// unclosed quote, combined with neutral fragments.
const BAD_VALUES = [
  '1px;color:red', '1px;', ';1px', '1px}.x{color:red', '1px{', '1px}', '{1px', '}1px',
  '1px)', '(1px', '1px]', '[1px', '(1px]', '[1px)', "'1px",
];

// [form, expected property]
const FORMS: Array<[(v: string) => string, string]> = [
  [(v) => `p-[${v}]`, 'padding'],
  [(v) => `w-[${v}]`, 'width'],
  [(v) => `bg-[color:${v}]`, 'background-color'],
  [(v) => `[color:${v}]`, 'color'],
  [(v) => `bg-(--x${v})`, 'background-color'],
  [(v) => `p-(--x${v})`, 'padding'],
  [(v) => `text-(length:--x${v})`, 'font-size'],
  [(v) => `font-features-[${v}]`, 'font-feature-settings'],
  [(v) => `font-features-(--x${v})`, 'font-feature-settings'],
];

const REPROS = FORMS.flatMap(([form, prop]) => BAD_VALUES.map((v) => [form(v), prop] as const));

// Bare `[prop:value]` classes (e.g. `[--x:1]`) emit no rule in BaroCSS today with or without this guard, so they
// appear only as repro forms above.
const VALID = [
  'grid-cols-[1fr_2fr]',
  "bg-[url('a(b).png')]",
  'bg-[url(a.png)]',
  'w-[calc(100%-min(1px,2px))]',
  'w-[clamp(1px,2vw,3px)]',
  'p-[min(1px,calc(2px+3px))]',
  'bg-(--brand)',
  'text-(length:--x)',
  "content-['a;b']",
  'font-[family-name:x]',
  'bg-[red]/50',
];

describe('#224 arbitrary and custom-property values keep the declaration block intact', () => {
  const ctx = createContext({});

  it.each(REPROS)('%s emits nothing or one rule with only %s', (cls, prop) => {
    const css = generateCss(cls, ctx).trim();
    if (css === '') return;
    const root = postcss.parse(css);
    const rules: string[] = [];
    const props: string[] = [];
    root.walkRules((r) => { rules.push(r.selector); });
    root.walkAtRules((a) => { rules.push('@' + a.name); });
    root.walkDecls((d) => { props.push(d.prop); });
    expect(rules.length, `${cls} -> ${css}`).toBe(1);
    expect(props, `${cls} -> ${css}`).toEqual([prop]);
  });

  it.each(VALID)('%s still emits a rule', (cls) => {
    expect(generateCss(cls, ctx).trim(), cls).not.toBe('');
  });

  it("keeps a quoted semicolon inside content-['a;b']", () => {
    const css = generateCss("content-['a;b']", ctx);
    expect(css).toContain("'a;b'");
  });

  it('keeps underscores as spaces in grid-cols-[1fr_2fr]', () => {
    expect(generateCss('grid-cols-[1fr_2fr]', ctx)).toContain('1fr 2fr');
  });
});

describe('#224 serializer drops a declaration that would change block structure', () => {
  it.each(BAD_VALUES)('decl value %s is not emitted', (value) => {
    const css = astToCss([{ type: 'decl', prop: 'color', value }], 'x', { minify: true });
    expect(css.includes(value), css).toBe(false);
  });

  it('keeps a legitimate declaration', () => {
    expect(astToCss([{ type: 'decl', prop: 'content', value: "'a;b'" }], 'x', { minify: true })).toContain("'a;b'");
  });
});
