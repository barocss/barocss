import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { astToCss } from '../../src/core/astToCss';
import { escapeClassName } from '../../src/core/registry';
import { isScopedSelector } from '../../src/core/parser';
import '../../src/presets';

// #396: the serializer scope check counts only class matches that are real selector parts. A class-looking
// substring inside a quoted string or an attribute-bracket group names nothing; one inside a parenthesised
// selector function (:is, :where, :not, :has, ...) still counts.
//   pnpm --filter @barocss/kit exec vitest run tests/security/scope-strings-brackets-396.test.ts

const LEGIT_FORMS = [
  'group-hover:underline', 'peer-focus/name:underline', 'group-has-[.x]:underline', '*:p-4', '**:p-4',
  '[&_p]:p-4', '[.x_&]:p-4', '[:root]:p-4', '[&>*]:p-4', 'md:p-4', '@sm:p-4', '@container', 'dark:bg-red-500',
  'rtl:p-4', 'ltr:p-4', 'print:hidden', 'supports-[display:grid]:grid', 'open:p-4', '2xl:p-4', 'nth-3:p-4',
  'group-[.x]:p-4', 'peer-[.x]:p-4', 'in-[.x]:p-4', 'not-first:p-4', 'has-[.x]:p-4', 'aria-checked:p-4',
  'data-[state=open]:p-4', 'space-x-4', 'divide-y', 'placeholder:text-red-500', 'selection:bg-red-500',
  'marker:text-red-500', 'file:p-4', "before:content-['x']", '!p-4', '-m-4', 'bg-red-500/50',
  'bg-[url(/a.png)]', 'animate-spin', 'shadow-md', 'ring-2', 'bg-linear-to-r', 'from-red-500', 'rotate-45',
  'translate-x-4', 'scale-50', 'blur-sm', '[color:red]', 'hover:focus:p-4', 'first:p-4', 'odd:p-4',
  'focus-visible:ring-2', 'disabled:opacity-50', 'lg:hover:p-4', 'space-y-2',
];

const decl = { type: 'decl' as const, prop: 'color', value: 'red' };
const emit = (selector: string, scope: string, nested = false) =>
  astToCss([{ type: 'style-rule', selector, nodes: [decl] } as never], undefined, { scope, nested } as never);

describe('#396 scope check ignores strings and attribute brackets', () => {
  const Q = String.fromCharCode(0x22);
  const A = String.fromCharCode(0x27);

  it('a class that appears only inside a quoted string or brackets does not scope the rule', () => {
    const esc = '.' + escapeClassName('a');
    expect(isScopedSelector('[data-x=' + Q + '.a' + Q + ']', esc)).toBe(false);
    expect(isScopedSelector('[data-x=' + A + '.a' + A + ']', esc)).toBe(false);
    expect(isScopedSelector('.b[data-x=' + Q + 'y .a' + Q + ']', esc)).toBe(false);
    expect(isScopedSelector('[data-x~=a].b', esc)).toBe(false);
    expect(isScopedSelector(':is([data-x=' + Q + '.a' + Q + '])', esc)).toBe(false);
    expect(isScopedSelector('[data-x=' + Q + '&' + Q + ']', esc, true)).toBe(false);
    expect(isScopedSelector('.a, [data-x=' + Q + '.a' + Q + ']', esc)).toBe(false);
  });

  it('real class parts, including inside selector functions, still count', () => {
    const esc = '.' + escapeClassName('a');
    expect(isScopedSelector('.a[data-x=' + Q + '.b' + Q + ']', esc)).toBe(true);
    expect(isScopedSelector('.a[data-x]', esc)).toBe(true);
    expect(isScopedSelector(':where(.a) > *', esc)).toBe(true);
    expect(isScopedSelector(':is(.a, .b)', esc)).toBe(true);
    expect(isScopedSelector('.x:not(.a)', esc)).toBe(true);
    expect(isScopedSelector('.x:has(.a)', esc)).toBe(true);
    expect(isScopedSelector('&[data-x]', esc, true)).toBe(true);
    const bracketed = '.' + escapeClassName('group-[.x]:p-4');
    expect(isScopedSelector(':is(:where(.group):is(.x) *)' + bracketed, bracketed)).toBe(true);
  });

  it('serializer drops rules scoped only through strings or brackets', () => {
    expect(emit('[data-x=' + Q + '.p-4' + Q + ']', 'p-4').trim()).toBe('');
    expect(emit('.b[title=' + A + '.p-4' + A + ']', 'p-4').trim()).toBe('');
    expect(emit('[data-x=' + Q + '&' + Q + ']', 'p-4', true).trim()).toBe('');
    expect(emit('.p-4[data-x=' + Q + 'y' + Q + ']', 'p-4')).toContain('color');
  });

  it('every legitimate form still emits', () => {
    const ctx = createContext({});
    expect(LEGIT_FORMS.length).toBe(55);
    for (const cls of LEGIT_FORMS) expect(generateCss(cls, ctx), cls).toContain('{');
  });
});
