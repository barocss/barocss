// Static and TypeScript checks only; importing or evaluating native CAD is prohibited here.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const app = resolve(import.meta.dirname, '..'), root = resolve(app, '../..');
const enginePin = '45f6687692b97ab245a15b27e85658c3c0a154d2';
const provider = resolve(process.env.CAD_MODEL_ROOT ?? root), mode = process.argv[2] ?? 'source';
assert.ok(['source', 'emitted'].includes(mode));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const path = resolve(app, 'docs/public/examples/modeling-intersection.ts'), snippet = readFileSync(path, 'utf8');
const page = readFileSync(resolve(app, 'docs/packages/cad/modeling.md'), 'utf8');
const engine = readFileSync(resolve(provider, 'packages/barocss-cad/src/modeling.ts'), 'utf8');
for (const [, region] of page.matchAll(/^<<< .*modeling-intersection\.ts#([^\s]+)$/gm)) {
  assert.ok(snippet.includes(`// #region ${region}\n`) && snippet.includes(`// #endregion ${region}\n`), `Missing region ${region}`);
}
assert.ok(page.includes("withBase('/examples/modeling-intersection.ts')") && page.includes("import { withBase } from 'vitepress'"));
for (const term of ['distinct direct XY extrusions', '2176', '1408', 'positive-volume', 'SELECTION', 'intersect', 'same-handle', 'UNRUN', '2 / 2 / 1 / 1 / 1']) assert.ok(page.includes(term), `Missing current boundary ${term}`);
for (const term of ["parameter('height', 4)", "parameter('leftX', 8)", "parameter('rightX', 40)", 'blank.intersect(tool)', 'overlap:']) assert.ok(snippet.includes(term), `Sample drift: ${term}`);
for (const forbidden of ['schema:', 'sourceVersion', 'solidId:', 'expectedRevision:', 'format:']) assert.ok(!snippet.includes(forbidden), `Download leaks internal authoring ${forbidden}`);
assert.match(engine, /intersections:\s*1/);
const pinned = execFileSync('git', ['show', `${enginePin}:packages/barocss-cad/src/modeling.ts`], {cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(digest(engine),digest(pinned),'Current provider must match the accepted intersection source pin');
const receiptText = execFileSync('git', ['show', `${enginePin}:packages/barocss-cad/test/modeling-intersection-evidence/verification.json`], {cwd:root,encoding:'utf8'});
const receipt = JSON.parse(receiptText);
assert.deepEqual([receipt.actual.initialVolumeMM3,receipt.actual.editedVolumeMM3,receipt.actual.coldReeditedVolumeMM3],[2176,1408,704]);
assert.ok(page.includes(enginePin));

const entry = resolve(provider, `packages/barocss-cad/${mode === 'source' ? 'src/index.ts' : 'dist/index.d.ts'}`);
const directory = mkdtempSync(join(tmpdir(), 'cad-intersection-doc-types-'));
try {
  const config = join(directory, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: { strict:true, noEmit:true, target:'ES2022', module:'NodeNext', moduleResolution:'NodeNext', skipLibCheck:true, types:[], paths:{'@barocss/cad':[entry]} }, files:[path] }));
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], {stdio:'inherit'});
} finally { rmSync(directory, {recursive:true,force:true}); }
console.log(JSON.stringify({ok:true,scope:'download/public snippet types and example boundary; no native CAD or browser execution',mode,enginePin,engineReceiptSHA256:digest(receiptText),entrySHA256:digest(readFileSync(entry)),modelingSourceSHA256:digest(engine),downloadSHA256:digest(snippet),nativeCampaignRun:false},null,2));
