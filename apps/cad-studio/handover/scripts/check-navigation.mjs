/** Validate the bounded D418 handover split, including files not yet staged. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: scriptRoot, encoding: 'utf8' }).trim();
const folder = 'apps/cad-studio/handover';
const { createMarkdownRenderer, disposeMdItInstance } = await import(
  pathToFileURL(resolve(root, 'node_modules/vitepress/dist/node/index.js')).href
);
const md = await createMarkdownRenderer(root, { highlight: code => code });
const originalHashes = {
  'roadmap': '1325b18b05f71ca1ffb8cb56552d7e0ee95bb516792a1ef77096a2b24cf1ad2e',
  'decisions': 'ab13b705211d7b76b52e43b2f3fa7d603a7db95a941a53c9ac5e709c8a3075c7',
};
const knownMissing = `${folder}/evidence/2443211888b5bc5d219fa3075dfea444bd6d5d4a/final-window/lanes/kernel-D.md`;
const legacyAlias = 'additional-package-acceptance-gates--2026-10-29';
const cache = new Map();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function parse(file) {
  if (cache.has(file)) return cache.get(file);
  const text = readFileSync(resolve(root, file), 'utf8');
  const headings = [], headingLines = [], links = [], lines = text.split('\n');
  for (const token of md.parse(text, { path: resolve(root, file), relativePath: file })) {
    if (token.type === 'heading_open') {
      headings.push(token.attrGet('id'));
      headingLines.push(lines[token.map[0]]);
    }
    for (const child of token.children ?? []) {
      if (child.type === 'link_open') links.push({ href: child.attrGet('href'), generated: child.attrGet('class') === 'header-anchor' });
    }
  }
  const explicit = [...text.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  const result = { text, headings, headingLines, links, ids: new Set([...headings, ...explicit]) };
  cache.set(file, result);
  return result;
}
function destination(file, href) {
  const url = new URL(href, pathToFileURL(resolve(root, file)));
  if (url.protocol !== 'file:') return null;
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('.html') && !existsSync(path)) path = path.slice(0, -5) + '.md';
  return { file: relative(root, path), fragment: decodeURIComponent(url.hash.slice(1)) };
}
const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.md'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
// Explicitly include every new file before git add; git ls-files alone is insufficient.
const newFiles = ['roadmap.md', 'decisions.md', 'roadmap-history-through-D417.md', 'decisions-history-through-D417.md',
  'notes/roadmap-index-2026-11-01/README.md',
  ...Array.from({ length: 34 }, (_, i) => `roadmap-rows/${String(i + 1).padStart(2, '0')}.md`)].map(file => `${folder}/${file}`);
const candidates = new Set([...tracked.filter(file => /(?:roadmap|decisions)\.md/.test(readFileSync(resolve(root, file), 'utf8'))), ...newFiles]);
const result = { status: 'PASS', archives: {}, rowPages: 34, parsedLegacyOutboundLinks: 0, oldHeadingFragments: 0,
  authoredInboundLinks: 0, checkedLocalLinks: 0, knownMissingPaths: [], newBroken: [], limits: [
    'Actual local VitePress parser; GitHub slug equivalence is not assumed.',
    'Original literal heading sequence preserves renderer input in both original filenames.',
    'The pre-existing double-hyphen renderer discrepancy is retained as an explicit root alias.',
    'Documentation-only validation; new Studio/build/kernel/type/API checks NOT_RUN.',
  ] };
for (const [name, expected] of Object.entries(originalHashes)) {
  const archiveFile = `${folder}/${name}-history-through-D417.md`;
  const archive = parse(archiveFile), current = parse(`${folder}/${name}.md`);
  assert.equal(hash(Buffer.from(archive.text)), expected, `${name} archive bytes changed`);
  const marker = current.text.indexOf('<!-- D418 LEGACY COMPATIBILITY BEGIN');
  assert.ok(marker >= 0);
  const oldLines = archive.headingLines;
  const compatibilityLines = current.text.slice(marker).split('\n').filter(line => /^#{1,6} /.test(line));
  assert.deepEqual(compatibilityLines, oldLines, `${name} literal heading sequence changed`);
  for (const id of archive.headings) assert.ok(current.ids.has(id), `${name} lost old fragment ${id}`);
  for (const id of archive.headings) {
    const sectionLink = current.links.some(link => {
      const target = destination(`${folder}/${name}.md`, link.href);
      return target?.file === archiveFile && target.fragment === id;
    });
    assert.ok(sectionLink, `${name} lacks direct archived-section navigation: ${id}`);
  }
  assert.equal(current.headings.length, new Set(current.headings).size, `${name} heading collision`);
  result.oldHeadingFragments += archive.headings.length;
  result.parsedLegacyOutboundLinks += archive.links.length;
  result.archives[name] = { sha256: expected, bytes: Buffer.byteLength(archive.text), headings: oldLines.length,
    currentBytes: Buffer.byteLength(current.text), currentFrontMatterLines: current.text.slice(0, marker).split('\n').length - 1,
    compatibilityLines: current.text.slice(marker).split('\n').length - 1 };
}
assert.equal(result.parsedLegacyOutboundLinks, 913);
assert.equal(result.oldHeadingFragments, 552);
assert.ok(parse(`${folder}/roadmap.md`).ids.has(legacyAlias));
const rowIds = [...parse(`${folder}/roadmap.md`).text.matchAll(/^\| (\d{2}) \|/gm)].map(match => match[1]);
assert.deepEqual(rowIds, Array.from({ length: 34 }, (_, i) => String(i + 1).padStart(2, '0')));
for (const file of candidates) {
  for (const link of parse(file).links) {
    const target = destination(file, link.href);
    if (!target) continue;
    const incoming = [`${folder}/roadmap.md`, `${folder}/decisions.md`].includes(target.file);
    if (!newFiles.includes(file) && !incoming) continue;
    result.checkedLocalLinks++;
    if (!existsSync(resolve(root, target.file))) {
      if (file === `${folder}/decisions-history-through-D417.md` && target.file === knownMissing) result.knownMissingPaths.push({ file, href: link.href });
      else result.newBroken.push({ file, href: link.href, reason: 'MISSING_PATH' });
      continue;
    }
    if (target.fragment && target.file.endsWith('.md') && !parse(target.file).ids.has(target.fragment)) {
      // Historical outbound fragment discrepancies are retained, not repaired by the split.
      // Validate new links and all incoming fragments to the two original root filenames.
      if (newFiles.includes(file) && !file.includes('-history-through-D417')) result.newBroken.push({ file, href: link.href, reason: 'MISSING_FRAGMENT' });
    }
    if (!link.generated && [`${folder}/roadmap.md`, `${folder}/decisions.md`].includes(target.file)) {
      result.authoredInboundLinks++;
      assert.ok(!target.fragment || parse(target.file).ids.has(target.fragment), `lost inbound ${file}: ${link.href}`);
    }
  }
}
assert.equal(result.knownMissingPaths.length, 1, 'Historical missing-path baseline changed');
assert.deepEqual(result.newBroken, [], 'New broken navigation');
console.log(JSON.stringify(result, null, 2));
await disposeMdItInstance();
