// Code-shape guard for the kernel's hot folders (P4 of apps/cad-studio/handover/notes/research-js-perf-review-2026-10-27.md).
// Counts, per file, four patterns that cost time or risk a RangeError on large inputs, and fails when a file has more of
// one than the recorded baseline (fixing them only lowers the counts; `--write` records the new ones):
//   spread-minmax  Math.max(...xs) / Math.min(...xs): every element an argument (the call stack overflows past ~100k);
//                  use minOf/maxOf/minAt/maxAt from src/core/extent.ts.
//   spread-push    xs.push(...ys): the same limit.
//   loop-spread    [...a, x] or {...o} built inside a loop or an iteration callback: the accumulator form is O(n²).
//   loop-literal   a constant array literal of 3 or more entries made inside a loop or an iteration callback: hoist it.
// Functions made in loops that read loop state are ESLint's no-loop-func (eslint.config.mjs), not counted here.
//   node scripts/code-shape.mjs [--check | --write]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';

const pkg = resolve(import.meta.dirname, '..'), root = resolve(pkg, '../..');
const ts = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'))('typescript');
const HOT = ['brep', 'intersect', 'core', 'blend', 'mesh'];
const PATTERNS = ['spread-minmax', 'spread-push', 'loop-spread', 'loop-literal'];
const ITER = new Set(['map', 'forEach', 'filter', 'some', 'every', 'reduce', 'reduceRight', 'flatMap', 'find', 'findIndex', 'findLast', 'findLastIndex', 'sort']);
const baselineFile = join(pkg, 'scripts/code-shape-baseline.json');

/** The .ts sources under a folder, in a stable order. */
function sources(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const isLoop = n => ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n);
const isFunction = n => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n);
/** Whether n is a function passed to an iteration method (its body runs once an element). */
const isIterationCallback = n => isFunction(n) && n.parent && ts.isCallExpression(n.parent) && n.parent.arguments.includes(n) && ts.isPropertyAccessExpression(n.parent.expression) && ITER.has(n.parent.expression.name.text);
function isConstLiteral(n) {
  if (ts.isNumericLiteral(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand)) return true;
  if (ts.isArrayLiteralExpression(n)) return n.elements.length > 0 && n.elements.every(isConstLiteral);
  if (ts.isAsExpression(n) || ts.isParenthesizedExpression(n)) return isConstLiteral(n.expression);
  return false;
}
/** The pattern counts of one source file. */
function countsOf(file) {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const c = Object.fromEntries(PATTERNS.map(p => [p, 0]));
  const visit = (n, hot, inFunction) => {
    if (isFunction(n)) { ts.forEachChild(n, k => visit(k, isIterationCallback(n), true)); return; }
    if (ts.isCallExpression(n) && n.arguments.some(a => ts.isSpreadElement(a))) {
      const callee = n.expression.getText(sf);
      if (callee === 'Math.max' || callee === 'Math.min') c['spread-minmax']++;
      else if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'push') c['spread-push']++;
    }
    if (hot && (ts.isArrayLiteralExpression(n) && n.elements.some(e => ts.isSpreadElement(e)) || ts.isObjectLiteralExpression(n) && n.properties.some(p => ts.isSpreadAssignment(p)))) c['loop-spread']++;
    if (hot && ts.isArrayLiteralExpression(n) && n.elements.length >= 3 && isConstLiteral(n) && !(n.parent && ts.isArrayLiteralExpression(n.parent))) c['loop-literal']++;
    // (A for-of's or for-in's iterable and a for's initializer are evaluated once, before the loop: not inside it.)
    const next = hot || (inFunction && isLoop(n)), once = k => (ts.isForOfStatement(n) || ts.isForInStatement(n)) && k === n.expression || ts.isForStatement(n) && k === n.initializer;
    ts.forEachChild(n, k => visit(k, once(k) ? hot : next, inFunction));
  };
  visit(sf, false, false);
  return c;
}

const now = Object.fromEntries(PATTERNS.map(p => [p, {}]));
for (const dir of HOT) for (const file of sources(join(pkg, 'src', dir))) {
  const rel = relative(pkg, file), c = countsOf(file);
  for (const p of PATTERNS) if (c[p]) now[p][rel] = c[p];
}
const total = p => Object.values(now[p]).reduce((a, b) => a + b, 0);
const mode = process.argv[2];
if (mode === '--write') {
  writeFileSync(baselineFile, JSON.stringify(now, null, 1) + '\n');
  console.log('code-shape baseline written:', PATTERNS.map(p => `${p} ${total(p)}`).join(', '));
} else {
  const base = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')) : {};
  const over = [];
  for (const p of PATTERNS) for (const [f, n] of Object.entries(now[p])) { const b = base[p]?.[f] ?? 0; if (n > b) over.push(`${f}: ${p} ${b} → ${n}`); }
  console.log('code-shape (hot folders):', PATTERNS.map(p => `${p} ${total(p)}`).join(', '));
  if (over.length) {
    console.error('code-shape: more than the recorded baseline (see scripts/code-shape.mjs for the fix of each pattern):\n  ' + over.join('\n  '));
    if (mode === '--check') process.exit(1);
  }
}
