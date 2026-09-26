import { describe, expect, it } from 'vitest';
import { ServerRuntime } from '../src/index';
import { extractClasses } from '../src/ssr';

// #335: class lists split on ASCII whitespace only (HTML classList, Tailwind's scanner); a non-ASCII space
// is part of the token, so `p-4 m-2` is one class that matches nothing.
describe('#335 server class splitting', () => {
  it('extractClasses keeps a non-ASCII space inside the token', () => {
    expect(extractClasses('<div class="flex p-4 m-2\tunderline"></div>')).toEqual(['flex', 'p-4 m-2', 'underline']);
  });
  it('generateCss and generateCssForHtml ignore non-ASCII separators', () => {
    const rt = new ServerRuntime();
    for (const css of [rt.generateCss('flex p-4 m-2 gap-2　'), rt.generateCssForHtml('<i class="flex p-4 m-2 gap-2　"></i>'),
      rt.generateCssForHtml(['flex p-4 m-2', 'gap-2　'])]) {
      expect(css).toContain('.flex');
      expect(css).not.toMatch(/\.p-4|\.m-2|\.gap-2/);
    }
  });
});
