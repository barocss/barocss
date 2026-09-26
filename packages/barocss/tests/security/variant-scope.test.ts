import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { jsonToAst, type BaroJsonInput } from '../../src/core/jsonToAst';
import '../../src/presets';

// #220: a crafted variant value must never make a generated rule apply outside the element carrying the class.
// Each repro must emit nothing, or only rules whose every selector-list member contains the escaped class.
//   pnpm --filter @barocss/kit exec vitest run tests/security/variant-scope.test.ts

// Generic malformed shapes: a top-level list separator, unbalanced or mismatched brackets, and block/statement
// delimiters, each combined with a neutral selector part `.x`.
const BAD_VALUES = [
  '&,.x', '.x,&', '&,_.x',
  '.x),.x,:is(.x', '.x(', '.x)', '.x]', '.x[', '(.x]', '[.x)',
  '&{}.x', '&;.x', '&}.x', '"&',
];
const VARIANT_FORMS: Array<(v: string) => string> = [
  (v) => `[${v}]`,
  (v) => `has-[${v}]`,
  (v) => `not-[${v}]`,
  (v) => `in-[${v}]`,
  (v) => `data-[${v}]`,
  (v) => `aria-[${v}]`,
  (v) => `supports-[${v}]`,
  (v) => `group-[${v}]`,
  (v) => `group-has-[${v}]`,
  (v) => `peer-data-[${v}]`,
  (v) => `nth-[${v}]`,
  (v) => `@[${v}]`,
];
const REPROS = [
  ...VARIANT_FORMS.flatMap((form) => BAD_VALUES.flatMap((v) => [`${form(v)}:hidden`, `hidden:${form(v)}`])),
  'data-[x],.x:hidden',
];

const VALID = [
  '[&_svg]:hidden',
  'has-[:checked]:hidden',
  'has-[:is(a,b)]:hidden',
  'data-[state=open]:hidden',
  'supports-[display:grid]:grid',
  '[&>*]:hidden',
  'group-data-[orientation=horizontal]/tabs:hidden',
  '[a&]:hover:hidden',
  '[&[data-x="a,b"]]:hidden',
  '[&:is(.a,.b)]:hidden',
];

function escapeClass(cls: string): string {
  return cls.replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
}

// Split a selector list on top-level commas (outside ()/[] and quotes).
function splitSelectorList(sel: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === '\\') { cur += c + (sel[i + 1] ?? ''); i++; continue; }
    if (quote) { if (c === quote) quote = ''; cur += c; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

// Selector preludes of style rules (at-rule preludes are skipped).
function selectors(css: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const prelude = m[1].trim();
    if (!prelude || prelude.startsWith('@')) continue;
    out.push(prelude);
  }
  return out;
}

describe('#220 variant values stay element-scoped', () => {
  const ctx = createContext({});

  it.each(REPROS)('%s emits nothing or only element-scoped rules', (cls) => {
    const css = generateCss(cls, ctx).trim();
    if (css === '') return;
    const esc = escapeClass(cls);
    for (const sel of selectors(css)) {
      for (const member of splitSelectorList(sel)) {
        expect(member.includes(esc), `${cls} -> member "${member}" of "${sel}"`).toBe(true);
      }
    }
  });

  it.each(VALID)('%s still emits a rule', (cls) => {
    expect(generateCss(cls, ctx).trim(), cls).not.toBe('');
  });
});

describe('#220 jsonToAst variant input is checked the same way', () => {
  const ctx = createContext({});
  const utility = { name: 'hidden' };
  const bad: BaroJsonInput['variants'][] = [
    ...BAD_VALUES.map((v) => [{ name: '', value: v, arbitrary: true }]),
    ...BAD_VALUES.map((v) => [{ name: 'has', value: v, arbitrary: true }]),
    ...BAD_VALUES.map((v) => [{ name: 'data', value: v }]),
    ...BAD_VALUES.map((v) => ['hover', { name: 'supports', value: v }]),
    ...BAD_VALUES.map((v) => [`[${v}]`]),
    ...BAD_VALUES.map((v) => [{ name: v }]),
  ];

  it.each(bad.map((variants) => [JSON.stringify(variants), variants] as const))('%s produces no rule', (_, variants) => {
    expect(jsonToAst({ utility, variants }, ctx)).toEqual([]);
  });

  it.each([
    [[{ name: '', value: '&_svg', arbitrary: true }]],
    [[{ name: 'has', value: ':is(.a,.b)', arbitrary: true }]],
    [[{ name: 'data', value: 'state=open' }]],
    [['hover', 'focus']],
  ] as BaroJsonInput['variants'][][])('%j still produces a rule', (variants) => {
    expect(jsonToAst({ utility, variants }, ctx)).not.toEqual([]);
  });
});
