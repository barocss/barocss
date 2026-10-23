// The docs check (W0): every sidebar page exists, every page is in the sidebar, and every internal link resolves.
// Run: pnpm --filter @barocss/library-docs check:docs
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sidebar } from '../docs/.vitepress/sidebar.mjs';

const docs = resolve(dirname(fileURLToPath(import.meta.url)), '../docs');
const problems = [];

/** A site link ("/studio/tour", "/agent/") as its Markdown file, or null. */
function fileOf(link) {
  const path = link.split('#')[0];
  const candidates = path.endsWith('/') ? [join(docs, path, 'index.md')] : [join(docs, `${path}.md`), join(docs, path, 'index.md')];
  return candidates.find(existsSync) ?? null;
}

function pagesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...pagesUnder(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const listed = new Set();
for (const group of sidebar) for (const item of group.items) {
  const f = item.link === '/' ? join(docs, 'index.md') : fileOf(item.link);
  if (!f) problems.push(`sidebar: ${item.link} (${item.text}) has no page`);
  else listed.add(f);
  if (!item.lane) problems.push(`sidebar: ${item.link} names no lane`);
}
for (const page of pagesUnder(docs)) {
  if (!listed.has(page)) problems.push(`${relative(docs, page)}: not in the sidebar`);
  const text = readFileSync(page, 'utf8');
  for (const m of text.matchAll(/\]\((\/[^)\s]*)\)/g)) if (m[1] !== '/' && !fileOf(m[1])) problems.push(`${relative(docs, page)}: broken link ${m[1]}`);
}
const writing = [...listed].filter(p => readFileSync(p, 'utf8').includes('::: warning Being written')).length;
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(JSON.stringify({ pages: listed.size, beingWritten: writing }));
