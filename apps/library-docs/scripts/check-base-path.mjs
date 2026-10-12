// After each build: node apps/library-docs/scripts/check-base-path.mjs /manual/
// Run once with / (default host), once with /manual/ (project Pages).
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { exampleCatalog, exampleHref } from '../docs/.vitepress/example-catalog.mjs';

const base = process.argv[2] || '/';
assert.match(base, /^\/(?:[a-zA-Z0-9_-]+\/)*$/);
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(app, 'docs/.vitepress/dist');
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(file); else files.push(file);
  }
}
await walk(dist);
const urls = new Map();
async function resolveUrl(href, page) {
  const url = new URL(href.replaceAll('&amp;', '&'), `http://manual.test${base}${page}`);
  if (url.origin !== 'http://manual.test') return;
  assert.ok(url.pathname.startsWith(base), `URL escapes ${base}: ${href} in ${page}`);
  const path = decodeURIComponent(url.pathname.slice(base.length));
  const candidates = [resolve(dist, path), resolve(dist, `${path}.html`), resolve(dist, path, 'index.html')];
  let found;
  for (const candidate of candidates) {
    assert.ok(candidate === dist || candidate.startsWith(dist + '/'), `Unsafe path: ${href}`);
    if (await stat(candidate).then(s => s.isFile()).catch(() => false)) { found = candidate; break; }
  }
  assert.ok(found, `Missing built target: ${href} in ${page}`);
  if (url.hash && found.endsWith('.html')) {
    const html = await readFile(found, 'utf8');
    assert.ok(html.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Missing anchor: ${href}`);
  }
  urls.set(url.pathname, found);
}
let htmlPages = 0, iframeReferences = 0, downloadReferences = 0;
for (const file of files.filter(f => f.endsWith('.html'))) {
  const page = relative(dist, file), html = await readFile(file, 'utf8');
  htmlPages++;
  assert.ok(html.includes(`href="${base}favicon.svg"`), `Favicon base: ${page}`);
  for (const match of html.matchAll(/<(?:a|link|script|img|iframe)\b[^>]*>/g)) {
    const tag = match[0], attr = tag.match(/\b(?:href|src)="([^"<>]+)"/);
    if (!attr) continue;
    if (tag.startsWith('<iframe')) iframeReferences++;
    if (/\bdownload(?:[\s=>])/.test(tag)) downloadReferences++;
    await resolveUrl(attr[1], page);
  }
}
const catalogHtml = await readFile(resolve(dist, 'examples/index.html'), 'utf8');
for (const [key, entry] of Object.entries(exampleCatalog)) {
  assert.ok(catalogHtml.includes(`href="${base}${exampleHref(key).slice(1)}"`), `Catalog example: ${key}`);
  assert.ok(catalogHtml.includes(`href="${base}${entry.guide.slice(1)}"`), `Catalog guide: ${key}`);
}
assert.ok(downloadReferences >= 4, 'Expected complete-input download links');
for (const [url, file] of urls) {
  if (!url.startsWith(`${base}examples/`) || file.endsWith('.html')) continue;
  const source = resolve(app, 'docs/public', relative(dist, file));
  assert.deepEqual(await readFile(file), await readFile(source), `Public asset bytes: ${url}`);
}
// Search is VitePress's generated local index; verify its real result URLs.
const indexes = files.filter(f => /@localSearchIndex.*\.js$/.test(f));
assert.ok(indexes.length, 'Missing local search index');
let searchResults = 0;
for (const file of indexes) {
  const index = JSON.parse((await import(pathToFileURL(file).href)).default);
  for (const href of Object.values(index.documentIds)) { await resolveUrl(href, 'index.html'); searchResults++; }
}
// Check static and dynamic module imports, including the lazy search component/index.
let moduleReferences = 0;
for (const file of files.filter(f => f.endsWith('.js'))) {
  const code = await readFile(file, 'utf8');
  for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(["'])(\.[^"']+\.js)\1/g)) {
    await resolveUrl(match[2], relative(dist, file)); moduleReferences++;
  }
}
let cssReferences = 0;
for (const file of files.filter(f => f.endsWith('.css'))) {
  const css = await readFile(file, 'utf8');
  for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
    if (match[1].startsWith('#')) continue;
    await resolveUrl(match[1], relative(dist, file)); cssReferences++;
  }
}
// Same-executor HTTP fetches prove paths serve exact built bytes, not browser interaction.
const server = createServer(async (request, response) => {
  const file = urls.get(new URL(request.url, 'http://manual.test').pathname);
  if (!file) { response.writeHead(404).end(); return; }
  response.end(await readFile(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (const [url, file] of urls) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`);
    assert.equal(response.status, 200, url);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(file), url);
  }
} finally { await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify({ base, htmlPages, catalogEntries: Object.keys(exampleCatalog).length, downloadReferences, iframeReferences, searchResults, moduleReferences, cssReferences, httpRoutes: urls.size, publicAssetBytes: 'unchanged', browserInteraction: 'not tested' }));
