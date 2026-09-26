import { describe, expect, it } from 'vitest';
import { normalizeClassNameList } from '../src/utils';
import { collectJsonRenderClassNames } from '../src/json-render-preload';

// #335: class lists split on ASCII whitespace only, as DOMTokenList does; a non-ASCII space is part of a token.
describe('#335 browser class splitting', () => {
  it('normalizeClassNameList splits on ASCII whitespace only', () => {
    expect(normalizeClassNameList('flex p-4 m-2\t\nunderline　 gap-2')).toEqual(['flex', 'p-4 m-2', 'underline　', 'gap-2']);
  });
  it('matches the DOM classList tokens', () => {
    const el = document.createElement('div');
    el.className = 'flex p-4 m-2\fgap-2';
    expect(normalizeClassNameList(el.className)).toEqual(Array.from(el.classList));
  });
  it('json-render class collection uses the same split', () => {
    expect(collectJsonRenderClassNames({ elements: { a: { props: { className: 'flex p-4 m-2' } } } })).toEqual(['flex', 'p-4 m-2']);
  });
});
