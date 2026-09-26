/**
 * #346 phase 1 (report-only): which class forms emit a resource-loading function (url( / image-set( / image( /
 * src( / cross-fade( / element( / -webkit-image-set() in declaration values. Never fails on counts; prints a table.
 */
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

export const RESOURCE_FN = /(?:^|[^\w-])(?:url|image-set|-webkit-image-set|image|src|cross-fade|element)\s*\(/i;
const U = 'https://x.test/a.png';
export const URL_FORMS: Array<[string, string]> = [
  ['bg-[url(…)]', `bg-[url(${U})]`],
  ['bg-[image:url(…)]', `bg-[image:url(${U})]`],
  ['bg-[image-set(…)]', `bg-[image-set(url(${U})_1x)]`],
  ['bg-[image:cross-fade(…)]', `bg-[image:cross-fade(url(${U}),url(${U}),50%)]`],
  ['list-image-[…]', `list-image-[${U}]`],
  ['list-image-[url(…)]', `list-image-[url(${U})]`],
  ['content-[url(…)]', `content-[url(${U})]`],
  ['mask-[url(…)]', `mask-[url(${U})]`],
  ['mask-image-[url(…)]', `mask-image-[url(${U})]`],
  ['border-image-[url(…)]', `border-image-[url(${U})]`],
  ['cursor-[url(…),auto]', `cursor-[url(${U}),auto]`],
  ['filter-[url(#f)]', 'filter-[url(#f)]'],
  ['font-[url(…)]', `font-[url(${U})]`],
  ['fill-[url(#g)]', 'fill-[url(#g)]'],
  ['[background-image:url(…)]', `[background-image:url(${U})]`],
  ['[background:url(…)]', `[background:url(${U})]`],
  ['[cursor:url(…),auto]', `[cursor:url(${U}),auto]`],
  ['[mask-image:url(…)]', `[mask-image:url(${U})]`],
  ['[list-style-image:url(…)]', `[list-style-image:url(${U})]`],
  ['[content:url(…)]', `[content:url(${U})]`],
  ['[--x:url(…)]', `[--x:url(${U})]`],
  ['[--x:url(…)] + bg-(--x)', `[--x:url(${U})] bg-(--x)`],
  ['bg-(image:--x)', 'bg-(image:--x)'],
  ['bg-[URL(…)] (case)', `bg-[URL(${U})]`],
  ['bg-[u\\72l(…)] (escape)', `bg-[u\\72l(${U})]`],
];

describe('#346 url() audit (report-only)', () => {
  it('reports which forms emit a resource-loading function', () => {
    const ctx = createContext({});
    const rows = URL_FORMS.map(([form, cls]) => {
      let css = '';
      try { css = generateCss(cls, ctx); } catch { css = '<throw>'; }
      const decl = css.split(/[{};]/).map((s) => s.trim()).find((s) => RESOURCE_FN.test(s)) ?? css.replace(/\s+/g, ' ').slice(0, 60);
      return `${RESOURCE_FN.test(css) ? 'URL ' : '--- '}${form.padEnd(30)} ${decl.slice(0, 70)}`;
    });
    console.log(['[#346 url-audit]', ...rows].join('\n'));
    expect(rows.length).toBe(URL_FORMS.length);
  });
});
