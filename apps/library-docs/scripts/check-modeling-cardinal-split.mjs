// Static and TypeScript checks only; importing or evaluating native CAD is prohibited here.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const app = resolve(import.meta.dirname, '..'), root = resolve(app, '../..');
const enginePin = '72ba5eb5ba54a94666812ce99ebf5c10fd3f7290';
const provider = resolve(process.env.CAD_MODEL_ROOT ?? root), mode = process.argv[2] ?? 'source';
assert.ok(['source', 'emitted'].includes(mode));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const path = resolve(app, 'docs/public/examples/modeling-cardinal-split.ts'), snippet = readFileSync(path, 'utf8');
const page = readFileSync(resolve(app, 'docs/packages/cad/modeling.md'), 'utf8');
const engine = readFileSync(resolve(provider, 'packages/barocss-cad/src/modeling.ts'), 'utf8');
for (const [, region] of page.matchAll(/^<<< .*modeling-cardinal-split\.ts#([^\s]+)$/gm)) {
  assert.ok(snippet.includes(`// #region ${region}\n`) && snippet.includes(`// #endregion ${region}\n`), `Missing region ${region}`);
}
assert.ok(page.includes("withBase('/examples/modeling-cardinal-split.ts')") && page.includes("import { withBase } from 'vitepress'"));
for (const term of ['direct XY extrusion', '4096', '3072', '5888', '1280', '7168', 'SELECTION', 'REPRESENTABILITY', 'crossing-representability', 'negative', 'positive', 'new example', 'UNRUN']) assert.ok(page.includes(term), `Missing current boundary ${term}`);
for (const term of ["parameter('splitAt', 16)", "parameter('rearX', 16)", "parameter('height', 8)", 'blank.split({ axis, at: splitAt })', 'negative: parts.negative', 'positive: parts.positive']) assert.ok(snippet.includes(term), `Sample drift: ${term}`);
for (const forbidden of ['schema:', 'sourceVersion', 'solidId:', 'expectedRevision:', 'format:']) assert.ok(!snippet.includes(forbidden), `Download leaks internal authoring ${forbidden}`);
assert.match(engine, /splits:\s*1/);
const pinned = execFileSync('git', ['show', `${enginePin}:packages/barocss-cad/src/modeling.ts`], {cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(digest(engine),digest(pinned),'Current provider must match the accepted split source pin');
const receiptText = execFileSync('git', ['show', `${enginePin}:packages/barocss-cad/test/modeling-cardinal-split-evidence/verification.json`], {cwd:root,encoding:'utf8'});
const receipt = JSON.parse(receiptText);
assert.deepEqual([receipt.actual.baselineXVolumesMM3,receipt.actual.editedXVolumesMM3,receipt.actual.coldReeditedXVolumesMM3],[[4096,3072],[5888,1280],[4096,3072]]);
assert.ok(page.includes(enginePin));

const entry = resolve(provider, `packages/barocss-cad/${mode === 'source' ? 'src/index.ts' : 'dist/index.d.ts'}`);
const directory = mkdtempSync(join(tmpdir(), 'cad-cardinal-split-doc-types-'));
try {
  const config = join(directory, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: { strict:true, noEmit:true, target:'ES2022', module:'NodeNext', moduleResolution:'NodeNext', skipLibCheck:true, types:[], paths:{'@barocss/cad':[entry]} }, files:[path, resolve(app,'scripts/snippets/modeling-api.ts'), resolve(app,'docs/public/examples/modeling-intersection.ts'),resolve(app,'docs/public/examples/modeling-split.ts')] }));
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], {stdio:'inherit'});
} finally { rmSync(directory, {recursive:true,force:true}); }
console.log(JSON.stringify({ok:true,scope:'download/public snippet types and example boundary; no native CAD or browser execution',mode,typedExampleFiles:4,enginePin,engineReceiptSHA256:digest(receiptText),entrySHA256:digest(readFileSync(entry)),modelingSourceSHA256:digest(engine),downloadSHA256:digest(snippet),nativeCampaignRun:false},null,2));
