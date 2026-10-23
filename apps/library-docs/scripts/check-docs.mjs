// The docs check (W0): every sidebar page exists, every page is in the sidebar, and every internal link resolves.
// A link to a file (a shot) resolves under docs/public. The shots keep to the budget (250 KB each, 10 MB in all), and
// every shot is shown on a page. Files named `_*.md` are parts a page includes, not pages. The generated parts match
// the code they come from (scripts/agent-tools.mjs and scripts/refusals.mjs, --check); the .bcad page names every
// document field, and the cad-model page every module folder; every bold UI label on the studio and agent pages is in
// the studio's sources (scripts/labels-allow.json for what is not a label as written).
// Run: pnpm --filter @barocss/library-docs check:docs
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sidebar } from '../docs/.vitepress/sidebar.mjs';

const docs = resolve(dirname(fileURLToPath(import.meta.url)), '../docs');
const problems = [];
const publicDir = join(docs, 'public'), SHOT_MAX = 250 * 1024, TOTAL_MAX = 10 * 1024 * 1024;
/** A link to a file (it has an extension), not a page. */
const isFile = link => /\.[a-z0-9]+$/i.test(link.split('#')[0]);

/** A site link ("/studio/tour", "/agent/") as its Markdown file, or null. */
function fileOf(link) {
  const path = link.split('#')[0];
  const candidates = path.endsWith('/') ? [join(docs, path, 'index.md')] : [join(docs, `${path}.md`), join(docs, path, 'index.md')];
  return candidates.find(existsSync) ?? null;
}

function filesUnder(dir, keep) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (p !== publicDir) out.push(...filesUnder(p, keep)); }
    else if (keep(name)) out.push(p);
  }
  return out;
}
const pagesUnder = dir => filesUnder(dir, name => name.endsWith('.md') && !name.startsWith('_'));

const listed = new Set(), shown = new Set();
for (const group of sidebar) for (const item of group.items) {
  const f = item.link === '/' ? join(docs, 'index.md') : fileOf(item.link);
  if (!f) problems.push(`sidebar: ${item.link} (${item.text}) has no page`);
  else listed.add(f);
  if (!item.lane) problems.push(`sidebar: ${item.link} names no lane`);
}
for (const page of pagesUnder(docs)) {
  if (!listed.has(page)) problems.push(`${relative(docs, page)}: not in the sidebar`);
  const text = readFileSync(page, 'utf8');
  for (const m of text.matchAll(/\]\((\/[^)\s]*)\)/g)) {
    if (m[1] === '/') continue;
    if (isFile(m[1])) { shown.add(m[1].split('#')[0]); if (!existsSync(join(publicDir, m[1]))) problems.push(`${relative(docs, page)}: missing file ${m[1]}`); }
    else if (!fileOf(m[1])) problems.push(`${relative(docs, page)}: broken link ${m[1]}`);
  }
}
const shots = filesUnder(join(publicDir, 'shots'), name => /\.(png|jpe?g)$/i.test(name));
let shotBytes = 0;
for (const f of shots) {
  const bytes = statSync(f).size, link = '/' + relative(publicDir, f);
  shotBytes += bytes;
  if (bytes > SHOT_MAX) problems.push(`${link}: ${Math.round(bytes / 1024)} KB, over the 250 KB a shot`);
  if (!shown.has(link)) problems.push(`${link}: no page shows it`);
}
for (const script of ['agent-tools.mjs', 'refusals.mjs']) {
  const r = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), script), '--check'], { encoding: 'utf8' });
  if (r.status !== 0) problems.push((r.stderr || r.stdout || `${script} --check failed`).trim());
}
// (The .bcad page names every field the document model lists: engine/doc.ts's STUDIO_DOC_FIELDS.)
const docSource = readFileSync(resolve(docs, '../../../packages/barocss-cad-model/src/engine/doc.ts'), 'utf8');
const fields = /export const STUDIO_DOC_FIELDS = \[([^\]]*)\]/.exec(docSource)?.[1].match(/'[^']+'/g)?.map(f => f.slice(1, -1)) ?? [];
if (!fields.length) problems.push('engine/doc.ts: STUDIO_DOC_FIELDS not found');
const documentPage = readFileSync(join(docs, 'reference/document.md'), 'utf8');
for (const f of fields) if (!documentPage.includes(`\`${f}\``)) problems.push(`reference/document.md: the field \`${f}\` is not named`);
// (The cad-model page's module map names every top-level folder of the package's src.)
const modelSrc = resolve(docs, '../../../packages/barocss-cad-model/src'), modelPage = readFileSync(join(docs, 'packages/cad-model/index.md'), 'utf8');
for (const name of readdirSync(modelSrc)) if (statSync(join(modelSrc, name)).isDirectory() && !modelPage.includes(`\`${name}/\``)) problems.push(`packages/cad-model/index.md: the module \`${name}/\` is not in the map`);
// (UI labels: every bold span on the studio, agent and Getting started pages names something the studio shows, so it is
// found in the studio's or the document model's sources, case aside and &amp; read as &. A span ending in . : or , is a
// lead phrase, and a code span is code; scripts/labels-allow.json lists the rest that are not labels as written, and why.)
const sourceText = ['apps/cad-studio/src', 'apps/cad-studio/server', 'packages/barocss-cad-model/src'].flatMap(d => filesUnder(resolve(docs, '../../..', d), n => /\.tsx?$/.test(n)))
  .map(f => readFileSync(f, 'utf8')).join('\n').replace(/&amp;/g, '&').replace(/\\u2019/g, '’').toLowerCase();
const allowed = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'labels-allow.json'), 'utf8'));
const allow = new Set([...Object.keys(allowed.emphasis), ...Object.keys(allowed.composed)]);
const labelPages = [...pagesUnder(join(docs, 'studio')), ...pagesUnder(join(docs, 'agent')), join(docs, 'guide/getting-started.md')];
let labels = 0;
for (const page of labelPages) for (const [, label] of readFileSync(page, 'utf8').matchAll(/\*\*([^*\n]+?)\*\*/g)) {
  if (/[.:,]$/.test(label.trim()) || /^`.*`$/.test(label) || allow.has(label)) continue;
  labels++;
  if (![label, label.replace(/'/g, '’')].some(l => sourceText.includes(l.toLowerCase()))) problems.push(`${relative(docs, page)}: the label **${label}** is not in the studio's sources`);
}
for (const label of allow) if (!labelPages.some(p => readFileSync(p, 'utf8').includes(`**${label}**`))) problems.push(`scripts/labels-allow.json: ${label} is no longer used on a page`);
if (shotBytes > TOTAL_MAX) problems.push(`shots: ${Math.round(shotBytes / 1024)} KB in all, over the 10 MB`);
const writing = [...listed].filter(p => readFileSync(p, 'utf8').includes('::: warning Being written')).length;
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(JSON.stringify({ pages: listed.size, beingWritten: writing, shots: shots.length, shotKB: Math.round(shotBytes / 1024), labels }));
