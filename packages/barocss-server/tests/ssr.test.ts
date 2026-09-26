import { describe, expect, it } from 'vitest';
import { ServerRuntime, extractClasses, parseCssDefinitions, ssrStyleTag, SSR_STYLE_ATTRIBUTE } from '../src/index';

describe('extractClasses (#268)', () => {
  it('reads double, single and unquoted values with any whitespace', () => {
    const html = `<div class="p-4  m-2\n\tflex"><span class='text-sm'></span><b class=font-bold></b><i CLASS = "italic"></i></div>`;
    expect(extractClasses(html)).toEqual(['p-4', 'm-2', 'flex', 'text-sm', 'font-bold', 'italic']);
  });
  it('decodes entities and keeps arbitrary values intact', () => {
    const html = `<p class="bg-[url(&quot;/a.png&quot;)] w-[calc(100%&#45;2rem)] content-[&#x27;x&#x27;] a&amp;b"></p>`;
    expect(extractClasses(html)).toEqual(['bg-[url("/a.png")]', 'w-[calc(100%-2rem)]', "content-['x']", 'a&b']);
  });
  it('ignores script/style contents, comments and look-alike attributes', () => {
    const html = `<script>el.innerHTML = '<div class="from-script"></div>'</script><style>.x{}</style>
<!-- <div class="commented"></div> --><div data-class="nope" subclass="nope" title='class="nope"' class="yes"></div>`;
    expect(extractClasses(html)).toEqual(['yes']);
  });
  it('dedupes in first-seen order', () => {
    expect(extractClasses('<a class="a b"></a><a class="b c a"></a>')).toEqual(['a', 'b', 'c']);
  });
});

describe('parseCssDefinitions (#268)', () => {
  it('collects leading classes, root vars, @property, @keyframes and @layer statements', () => {
    const css = `@layer theme, base, utilities;
@layer theme { :root, :host { --color-red-500: oklch(1 0 0); --spacing: .25rem } }
@property --tw-x { syntax: "*"; inherits: false }
@keyframes spin { to { transform: rotate(1turn) } }
/* .commented { } */
@layer utilities { .p-4 { padding: 1rem } @media (width >= 40rem) { .sm\\:p-4 { padding: 1rem } }
  .hover\\:x { &:hover { color: red } } .group .inner { color: red } :where(.divide-y > :not(:last-child)) { border-width: 1px } .content-\\[\\'\\{\\'\\] { content: '{' } }`;
    const d = parseCssDefinitions(css);
    expect([...d.classes].sort()).toEqual(['content-[\'{\']', 'divide-y', 'group', 'hover:x', 'p-4', 'sm:p-4']);
    expect([...d.vars].sort()).toEqual(['--color-red-500', '--spacing']);
    expect([...d.properties]).toEqual(['--tw-x']);
    expect([...d.keyframes]).toEqual(['spin']);
    expect(d.layerStatement).toBe(true);
  });
});

describe('ServerRuntime.generateCssForHtml (#268)', () => {
  const html = '<div class="p-4 text-red-500 sm:p-6 lg:p-8 shadow-md"><script>"<i class=\'m-9\'>"</script></div>';

  it('equals generateCss over the extracted classes when nothing is skipped', () => {
    const rt = new ServerRuntime();
    expect(rt.generateCssForHtml(html)).toBe(rt.generateCss('p-4 text-red-500 sm:p-6 lg:p-8 shadow-md'));
    expect(rt.generateCssForHtml(['p-4 text-red-500', 'sm:p-6', 'lg:p-8', 'shadow-md'])).toBe(rt.generateCssForHtml(html));
    expect(rt.generateCssForHtml(html)).not.toContain('m-9');
  });

  it('skips a set of class names', () => {
    const css = new ServerRuntime().generateCssForHtml(html, { skip: new Set(['p-4', 'shadow-md']) });
    expect(css).not.toMatch(/\.p-4\b|shadow-md/);
    expect(css).toMatch(/\.sm\\:p-6/);
    expect(new ServerRuntime().generateCssForHtml(html, { skip: ['p-4', 'shadow-md'] })).toBe(css);
  });

  it('skips classes, theme vars, @property and @keyframes the build CSS defines', () => {
    const rt = new ServerRuntime();
    const full = rt.generateCssForHtml('<a class="p-4 shadow-md animate-spin text-red-500 sm:p-6"></a>');
    const props = [...full.matchAll(/@property (--[\w-]+)/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    expect(full).toMatch(/--color-red-500:/);
    const build = `@layer theme, base, components, utilities;
@layer theme { :root, :host { --color-red-500: red; --spacing: 0.25rem; } }
${props.map((p) => `@property ${p} { syntax: "*"; inherits: false; }`).join('\n')}
@keyframes spin { to { transform: rotate(360deg) } }
@layer utilities { .p-4 { padding: 1rem } }`;
    const delta = rt.generateCssForHtml('<a class="p-4 shadow-md animate-spin text-red-500 sm:p-6"></a>', { skip: build });
    expect(delta).not.toMatch(/\.p-4\b/);
    expect(delta).not.toMatch(/--color-red-500:|--spacing:/);
    expect(delta).not.toMatch(/@property|@keyframes|@layer/);
    expect(delta).toMatch(/\.sm\\:p-6/);
    expect(delta).toMatch(/\.shadow-md/);
    expect(delta).toMatch(/\.animate-spin/);
  });

  it('returns each request its own delta, never a cumulative sheet', () => {
    const rt = new ServerRuntime();
    const a = rt.generateCssForHtml('<a class="p-4 m-2"></a>');
    const b = rt.generateCssForHtml('<a class="p-4 flex"></a>');
    expect(a).toMatch(/\.m-2/);
    expect(b).not.toMatch(/\.m-2/);
    expect(b).toMatch(/\.p-4/);
    expect(b).toBe(new ServerRuntime().generateCssForHtml('<a class="p-4 flex"></a>'));
  });

  it('keeps the #267 variant order', () => {
    const css = new ServerRuntime().generateCssForHtml('<a class="lg:p-8 sm:p-6 p-4"></a>');
    expect(css.indexOf('.p-4')).toBeLessThan(css.indexOf('sm\\:p-6'));
    expect(css.indexOf('sm\\:p-6')).toBeLessThan(css.indexOf('lg\\:p-8'));
  });
});

describe('ssrStyleTag (#268)', () => {
  it('wraps the sheet in the marked style tag and neutralises </style', () => {
    expect(ssrStyleTag('.a{}')).toBe(`<style ${SSR_STYLE_ATTRIBUTE}>.a{}</style>`);
    expect(ssrStyleTag('.a{content:"</style>"}', { nonce: 'n"1' })).toBe('<style data-barocss-ssr nonce="n&#34;1">.a{content:"<\\/style>"}</style>');
  });
});
