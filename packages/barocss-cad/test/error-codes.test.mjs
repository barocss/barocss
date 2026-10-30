import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { CAD_ERROR_CODES, CAD_REFUSAL_CODES, CadPartError, evaluateCadPart, refusalCodeOf } from '../dist/index.js';

// R7.3a batch 2 (D278): the kernel's one list of codes, kept whole against the sources.
const pkg = resolve(import.meta.dirname, '..'), ts = createRequire(join(pkg, 'package.json'))('typescript');
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } })(join(pkg, 'src'));

test('R7.3a: CAD_REFUSAL_CODES is every bracketed code the kernel\'s string literals carry, and only those', () => {
  const found = new Set();
  for (const f of files) {
    const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.ES2022, true);
    ts.forEachChild(sf, function visit(n) {
      const text = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : ts.isTemplateExpression(n) ? [n.head.text, ...n.templateSpans.map(s => s.literal.text)].join('…') : null;
      if (text !== null) for (const m of text.matchAll(/\[([A-Z][A-Z0-9_]+)\]/g)) found.add(m[1]);
      // (A refusal type's members, bracketed at run time by its helper: `[${code}]` in refuseFillet.)
      if (ts.isTypeAliasDeclaration(n) && /Refusal$/.test(n.name.text) && ts.isUnionTypeNode(n.type)) {
        for (const t of n.type.types) if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) found.add(t.literal.text);
      }
      ts.forEachChild(n, visit);
    });
  }
  assert.deepEqual([...CAD_REFUSAL_CODES].sort(), [...found].sort());
});

test('R7.3a: CAD_ERROR_CODES holds every code a kernel error class can carry', () => {
  const program = ts.createProgram(files, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true });
  const checker = program.getTypeChecker(), all = new Set(CAD_ERROR_CODES), missing = [];
  let classes = 0, factories = 0;
  for (const sf of program.getSourceFiles()) {
    if (!sf.fileName.startsWith(join(pkg, 'src'))) continue;
    ts.forEachChild(sf, function visit(n) {
      if (ts.isClassDeclaration(n) && n.name && n.heritageClauses?.some(h => h.types.some(t => t.expression.getText() === 'KernelError'))) {
        classes++;
        const p = checker.getTypeAtLocation(n).getProperty('code'), t = checker.getTypeOfSymbolAtLocation(p, n);
        for (const u of t.isUnion() ? t.types : [t]) if (u.isStringLiteral() && !all.has(u.value)) missing.push(`${n.name.text}: ${u.value}`);
      }
      // (A module's refusal folded into a factory (D279): `kernelRefusal(…) as KernelError & { readonly code: C }`, its C.)
      if (ts.isAsExpression(n) && ts.isCallExpression(n.expression) && n.expression.expression.getText() === 'kernelRefusal') {
        factories++;
        const p = checker.getTypeAtLocation(n).getProperty('code'), t = checker.getTypeOfSymbolAtLocation(p, n);
        for (const u of t.isUnion() ? t.types : [t]) if (u.isStringLiteral() && !all.has(u.value)) missing.push(`${sf.fileName}: ${u.value}`);
      }
      // (A class whose code is a plain string passes it as `{ code: 'X' }`.)
      if (ts.isPropertyAssignment(n) && n.name.getText() === 'code' && ts.isStringLiteral(n.initializer) && /^[A-Z][A-Z0-9_]+$/.test(n.initializer.text) && !all.has(n.initializer.text) && /KernelError|super\(/.test(n.parent.parent?.getText() ?? '')) missing.push(`${sf.fileName}: ${n.initializer.text}`);
      ts.forEachChild(n, visit);
    });
  }
  assert.ok(classes > 100 && factories >= 21, // (106 classes after R7.3d)
    `${classes} classes, ${factories} module refusals`);
  assert.deepEqual(missing, []);
});

test('R7.3a batch 2: a part-model refusal carries its message\'s specific code, its category in details', () => {
  const coded = new CadPartError('PARAMETER', 'n3', '[RADIUS_EXCEEDS_FACE] the radius 9 mm exceeds the face');
  assert.equal(coded.code, 'RADIUS_EXCEEDS_FACE'); assert.deepEqual(coded.details, { category: 'PARAMETER' });
  assert.equal(coded.message, 'n3: [RADIUS_EXCEEDS_FACE] the radius 9 mm exceeds the face');
  const plain = new CadPartError('INPUT', 'n2', 'edges must list 1 to 64 edge names');
  assert.equal(plain.code, 'INPUT'); assert.deepEqual(plain.details, { category: 'INPUT' }); assert.equal(plain.message, 'n2: edges must list 1 to 64 edge names');
  // (A bracketed word that is no refusal code of the kernel's is left in the words.)
  assert.equal(refusalCodeOf('no edge named [NOT_A_CODE_X]'), undefined);
  assert.throws(() => evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'a', kind: 'extrude', sketch: 'nope', height: 1 }] }),
    e => e.code === 'REFERENCE' && e.details.category === 'REFERENCE' && e.message === 'a: sketch: no earlier feature nope');
});
