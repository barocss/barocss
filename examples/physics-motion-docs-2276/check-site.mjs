// Scoped documentation verification. No network access or numerical campaign.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sidebar } from '../../apps/library-docs/docs/.vitepress/sidebar.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const docs = join(root, 'apps/library-docs/docs');
const dist = join(docs, '.vitepress/dist');
const routes = ['/packages/physics/', '/packages/physics/units-and-frames',
  '/packages/physics/profiles-and-lifecycle', '/guide/robot-motion', '/reference/physics-verification'];
const crosslinks = ['index.md', 'reference/limits.md', 'reference/verification.md',
  'studio/robots.md', 'packages/cad-model/index.md'];
const sha = data => createHash('sha256').update(data).digest('hex');
const sourceOf = route => join(docs, route.endsWith('/') ? `${route}index.md` : `${route}.md`);
const outputOf = route => join(dist, route.endsWith('/') ? `${route}index.html` : `${route}.html`);
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
let anchors = 0, links = 0, regions = 0, copies = 0;
const outputs = new Map();
function checkLink(link, from) {
  if (!link.startsWith('/') && !link.startsWith('#') && !link.startsWith('.')) return;
  const url = new URL(decode(link), `https://local.invalid${from}`);
  if (url.origin !== 'https://local.invalid') return;
  const route = decodeURIComponent(url.pathname);
  const output = /\.[a-z0-9]+$/i.test(route) ? join(dist, route) : outputOf(route);
  assert.ok(existsSync(output), `missing built target: ${link} from ${from}`);
  if (url.hash) {
    assert.ok(output.endsWith('.html'), `fragment on non-HTML asset: ${link}`);
    if (!outputs.has(output)) outputs.set(output, readFileSync(output, 'utf8'));
    const id = decodeURIComponent(url.hash.slice(1));
    assert.ok([...outputs.get(output).matchAll(/\bid="([^"]+)"/g)].some(m => decode(m[1]) === id),
      `missing built anchor: ${link} from ${from}`);
    anchors++;
  }
  links++;
}

for (const route of routes) {
  const source = sourceOf(route), text = readFileSync(source, 'utf8');
  const html = readFileSync(outputOf(route), 'utf8');
  assert.ok(html.includes('<main'), `${route}: no rendered main`);
  // Built hrefs include relative Markdown links, local anchors and shared navigation.
  for (const [, href] of html.matchAll(/\bhref="([^"]+)"/g)) checkLink(href, route);
  // VitePress can quietly omit a misspelled snippet region: check the source contract too.
  for (const [, path, region] of text.matchAll(/^<<< @\/([^#\s]+)#([^\s]+)$/gm)) {
    const sample = resolve(docs, path), code = readFileSync(sample, 'utf8');
    assert.ok(code.includes(`// #region ${region}\n`) && code.includes(`// #endregion ${region}`),
      `${relative(root, source)}: missing region ${region}`);
    regions++;
  }
  assert.ok(!html.includes('<<< @/'), `${route}: unrendered snippet`);
}
for (const page of crosslinks) {
  const text = readFileSync(join(docs, page), 'utf8');
  for (const [, link] of text.matchAll(/\]\((\/[^)\s]+)\)/g)) {
    if (link.startsWith('/packages/physics') || link.startsWith('/guide/robot-motion')
      || link.startsWith('/reference/physics-verification')) checkLink(link, `/${page.replace(/(?:index)?\.md$/, '')}`);
  }
}
function walk(items) {
  for (const item of items) {
    if (item.link) checkLink(item.link, '/');
    if (item.items) walk(item.items);
  }
}
walk(sidebar);

const evidence = join(docs, 'public/physics-evidence');
const manifest = JSON.parse(readFileSync(join(evidence, 'manifest.json')));
for (const row of manifest.files) {
  const original = readFileSync(join(root, row.source));
  const copy = readFileSync(join(evidence, row.asset));
  assert.ok(original.equals(copy), `${row.asset}: differs from original receipt`);
  assert.equal(copy.length, row.bytes);
  assert.equal(sha(copy), row.sha256);
  assert.ok(copy.equals(readFileSync(join(dist, 'physics-evidence', row.asset))), `${row.asset}: stale build copy`);
  copies++;
}
assert.ok(readFileSync(join(evidence, 'api-roadmap.txt')).equals(readFileSync(join(root, 'packages/barocss-physics/ROADMAP.md'))));
assert.ok(readFileSync(join(evidence, 'api-roadmap.txt')).equals(readFileSync(join(dist, 'physics-evidence/api-roadmap.txt'))));
console.log(JSON.stringify({ pages: routes.length, links, anchors, snippetRegions: regions,
  byteIdenticalHistoricalCopies: copies, proposedRoadmapCopy: true, networkChecks: 'NOT_RUN' }));
