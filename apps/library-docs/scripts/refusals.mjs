// The Refusal codes page's tables, generated from the sources: every bracketed refusal code (`[FASTENER_SIZE_ROW] …`) in
// the kernel, the document model and the studio, with the folders it is raised in and one message as written (the
// string literal read whole: escapes, and a template's `${…}` shown as …). The sources are read with the TypeScript
// parser and only string and template literals count, so comments are never read as messages. Writes
// docs/reference/_refusals.md, which reference/refusals.md includes. `--check` writes nothing and exits 1 when the file
// differs from the code.
// (Codes kept only as a TypeScript union, their messages built as `[${code}] …` — the cad-model facade's FacadeCode —
// can't be read from strings and are not listed. R7.3 moves every package to such unions; the table will then be
// generated from the types.)
//   node scripts/refusals.mjs [--check]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';

const docs = resolve(import.meta.dirname, '..'), repo = resolve(docs, '../..');
const target = join(docs, 'docs/reference/_refusals.md');
const ts = createRequire(join(repo, 'package.json'))('typescript');
const AREAS = [
  ['The kernel (`@barocss/cad`)', 'packages/barocss-cad/src'],
  ['The document model (`@barocss/cad-model`)', 'packages/barocss-cad-model/src'],
  ['The studio', 'apps/cad-studio/src'],
  ['The studio\'s servers', 'apps/cad-studio/server'],
];

/** The .ts files under a folder, in a stable order. */
function sources(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}
/** A literal's text, a template's `${…}` shown as …; null for anything else. */
const literalText = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text
  : ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map(span => `…${span.literal.text}`).join('') : null;
/** R7.3a's refusal builders: `refusal('CODE', '…')`, `problem('CODE', '…')`, `coded('CODE', '[CODE] …')` — the code a literal of its own. */
const BUILDERS = new Set(['refusal', 'problem', 'coded']);
/**
 * Every string and template literal in a source file, as literalText; and each refusal builder's call as the text it
 * makes, `[CODE] message` (its message `…` when it is not a literal).
 */
function literals(file, text) {
  const out = [], sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    const t = literalText(node);
    if (t !== null) out.push(t);
    else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && BUILDERS.has(node.expression.text) && node.arguments.length >= 2 && ts.isStringLiteral(node.arguments[0]) && CODE.test(node.arguments[0].text)) {
      const code = node.arguments[0].text, said = literalText(node.arguments[1]) ?? '…';
      if (!said.startsWith(`[${code}]`)) out.push(`[${code}] ${said}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
/** A message as a reader reads it: whitespace folded, cut at a word near 160 characters, pipes escaped. */
function message(text) {
  let m = text.replace(/\s+/g, ' ').trim();
  if (m.length > 160) m = `${m.slice(0, m.lastIndexOf(' ', 157))} …`;
  return m.replace(/\|/g, '\\|');
}
/** The folder a file is in, under its area (`chat/part`, or `.` at the top). */
const folderOf = (root, file) => relative(root, file).split('/').slice(0, -1).join('/') || '.';
/** The example a code is shown with: its first message of 20 characters or more, else its first. */
/** (A message that holds comment markers was read wrong, never shown: the scanner's guard.) */
const readable = m => !/\/\*|\*\/|(^|\s)\/\/\s/.test(m);
const example = list => { const ok = list.filter(readable); return ok.find(m => m.length >= 20) ?? ok[0] ?? ''; };

/** A refusal code as written: upper-snake, four characters or more. */
const CODE = /^[A-Z][A-Z0-9_]{3,}$/;
/** A literal that is a refusal: its code in brackets at its start, then the message. */
const BRACKETED = /^\[([A-Z][A-Z0-9_]{3,})\]\s*([\s\S]*)$/;

const codes = AREAS.map(([title, dir]) => {
  const root = join(repo, dir), found = new Map();
  for (const file of sources(root)) {
    const text = readFileSync(file, 'utf8');
    for (const literal of literals(file, text)) {
      const m = BRACKETED.exec(literal); if (!m) continue;
      const code = m[1], said = message(m[2].replace(/\n/g, ' '));
      const c = found.get(code) ?? { folders: new Set(), messages: [] };
      c.folders.add(folderOf(root, file)); if (said) c.messages.push(said); found.set(code, c);
    }
  }
  return [title, found];
});

const lines = ['<!-- Generated by scripts/refusals.mjs from the sources. Do not edit by hand. -->', ''];
for (const [title, found] of codes) {
  if (!found.size) continue;
  lines.push(`### ${title}`, '', '| Code | Raised in | For example |', '|---|---|---|');
  for (const code of [...found.keys()].sort()) {
    const c = found.get(code);
    lines.push(`| \`[${code}]\` | ${[...c.folders].sort().map(f => `\`${f}\``).join(', ')} | ${example(c.messages) || '—'} |`);
  }
  lines.push('');
}
const text = lines.join('\n');
if (process.argv.includes('--check')) {
  let now = '';
  try { now = readFileSync(target, 'utf8'); } catch { /* not written yet */ }
  if (now !== text) { console.error('docs/reference/_refusals.md differs from the sources: run node scripts/refusals.mjs'); process.exit(1); }
} else writeFileSync(target, text);
