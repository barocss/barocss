// Static and TypeScript checks only; importing or evaluating native CAD is prohibited here.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const app = resolve(import.meta.dirname, '..'), root = resolve(app, '../..');
const enginePin = '63f74623ddef0f44f9c6056c3e0b162e3f429f69';
const provider = resolve(process.env.CAD_MODEL_ROOT ?? root), mode = process.argv[2] ?? 'source';
assert.ok(['source', 'emitted'].includes(mode));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const ts = require('typescript'), digest = bytes => createHash('sha256').update(bytes).digest('hex');
const path = resolve(app, 'docs/public/examples/modeling-chamfer-chain.ts'), snippet = readFileSync(path, 'utf8');
const page = readFileSync(resolve(app, 'docs/packages/cad/modeling.md'), 'utf8');
const engine = readFileSync(resolve(provider, 'packages/barocss-cad/src/modeling.ts'), 'utf8');
for (const [, region] of page.matchAll(/^<<< .*modeling-chamfer-chain\.ts#([^\s]+)$/gm)) {
  assert.ok(snippet.includes(`// #region ${region}\n`) && snippet.includes(`// #endregion ${region}\n`), `Missing region ${region}`);
}
assert.ok(page.includes("withBase('/examples/modeling-chamfer-chain.ts')") && page.includes("import { withBase } from 'vitepress'"));
for (const term of ['6064', '5984', '5936', '6144', 'SELECTION', 'NATIVE', 'METRIC', 'PARAMETER', 'edge-selection Y coordinate', 'actual first chamfer result', 'UNRUN']) assert.ok(page.includes(term), `Missing current boundary ${term}`);
for (const text of [snippet, readFileSync(resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts'), 'utf8')]) {
  for (const term of ["parameter('frontDistance', 1)", "parameter('backDistance', 2)", "parameter('backY', 24)", 'front.chamfer(front.edges(', 'return model.build({ part })']) assert.ok(text.includes(term), `Sample drift: ${term}`);
}
for (const forbidden of ['schema:', 'sourceVersion', 'solidId:', 'expectedRevision:', 'format:']) assert.ok(!snippet.includes(forbidden), `Download leaks internal authoring ${forbidden}`);
assert.match(engine, /chamfers:\s*2/);
const pinned = execFileSync('git', ['show', `${enginePin}:packages/barocss-cad/src/modeling.ts`], {cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(digest(engine),digest(pinned),'Current provider must match the accepted two-chamfer source pin');
const receiptText = execFileSync('git', ['show', `${enginePin}:packages/barocss-cad/test/modeling-chamfer-chain-evidence/verification.json`], {cwd:root,encoding:'utf8'});
const receipt = JSON.parse(receiptText);
assert.deepEqual([receipt.actual.baseline.finalMM3,receipt.actual.backDistanceEdit.finalMM3,receipt.actual.jointDistanceEdit.finalMM3,receipt.actual.coldReopenedVolumeMM3,receipt.actual.coldReeditedVolumeMM3],[6064,5984,5936,5984,6064]);
assert.equal(receipt.actual.exactFirstResultParent,true);
assert.ok(page.includes(enginePin));

const entry = resolve(provider, `packages/barocss-cad/${mode === 'source' ? 'src/index.ts' : 'dist/index.d.ts'}`);
const directory = mkdtempSync(join(tmpdir(), 'cad-chamfer-chain-doc-types-'));
try {
  const config = join(directory, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: { strict:true, noEmit:true, target:'ES2022', module:'NodeNext', moduleResolution:'NodeNext', skipLibCheck:true, types:[], paths:{'@barocss/cad':[entry]} }, files:[path, resolve(app,'scripts/snippets/modeling-api.ts'), resolve(app,'docs/public/examples/modeling-intersection.ts'),resolve(app,'docs/public/examples/modeling-split.ts'),resolve(app,'docs/public/examples/modeling-cardinal-split.ts')] }));
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], {stdio:'inherit'});
  const ui = readFileSync(resolve(root, 'packages/barocss-cad-editor/src/react/modeling-editor.tsx'), 'utf8');
  assert.ok(ui.includes('<option value="two-chamfer">Two chamfers on a part</option>'));
  assert.ok(ui.includes('backY · edge-selection Y coordinate'));
  assert.ok(ui.includes("useState<CadEditorModelingExample>('cut-chamfer')"));
  assert.ok(ui.includes("setExample(event.target.value as CadEditorModelingExample); setReplaceExample(false);"));
  assert.ok(ui.includes("useState<CadEditorModelingSplitAxis>('z')"));
  assert.ok(ui.includes("setSplitAxis(event.target.value as CadEditorModelingSplitAxis); setReplaceExample(false);"));
  assert.ok(ui.includes("s.example(example, example === 'horizontal-split' ? splitAxis : undefined)"));
  assert.ok(ui.includes('disabled={busy || (!!accepted && !replaceExample)}'));
  const syntax = ts.transpileModule(ui, { compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:'modeling-editor.tsx',reportDiagnostics:true });
  assert.equal(syntax.diagnostics?.length ?? 0, 0);
} finally { rmSync(directory, {recursive:true,force:true}); }
console.log(JSON.stringify({ok:true,scope:'download/public snippet types, example boundary and TSX syntax; no native CAD or browser execution',mode,typedExampleFiles:5,enginePin,engineReceiptSHA256:digest(receiptText),entrySHA256:digest(readFileSync(entry)),modelingSourceSHA256:digest(engine),downloadSHA256:digest(snippet),nativeCampaignRun:false},null,2));
