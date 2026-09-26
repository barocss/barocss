import { describe, expect, it } from 'vitest';
import { functionalUtility } from '@barocss/kit';
import { ServerRuntime } from '../src/index';

// #333: one class whose generation throws (or whose colour theme lookup is a palette object) contributes
// nothing; the rest of the sheet still generates in every server output path.
functionalUtility({ name: 'zz-throws-333', handleBareValue: () => { throw new Error('boom'); } });
const config = { theme: { extend: { colors: { brand: { 500: '#ff0000' } } } } };
const classes = 'p-4 zz-throws-333-1 text-brand to-brand underline';

describe('#333 server generation never throws', () => {
  it('generateCss', () => {
    const css = new ServerRuntime(config).generateCss(classes);
    expect(css).toContain('.p-4');
    expect(css).toContain('.underline');
    expect(css).not.toMatch(/zz-throws|\.text-brand|\.to-brand/);
  });

  it('generateCssForHtml', () => {
    const css = new ServerRuntime(config).generateCssForHtml(`<div class="${classes}"></div>`);
    expect(css).toContain('.p-4');
    expect(css).toContain('.underline');
    expect(css).not.toContain('zz-throws');
  });

  it('generateCssForClasses', () => {
    const out = new ServerRuntime(config).generateCssForClasses(classes.split(' '));
    expect(out.find((e) => e.className === 'p-4')?.css).toContain('.p-4');
    expect(out.find((e) => e.className === 'zz-throws-333-1')?.css).toBe('');
  });
});
