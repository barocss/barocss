// Static/type checks only. This checker never constructs or samples geometry.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const app = resolve(import.meta.dirname, '..'), root = resolve(app, '../..');
const pin = '65508ad878e156ddbc7426f106dd0ea7175c0655', base = pin;
const mode = process.argv[2] ?? 'static'; assert.ok(['static', 'source', 'emitted'].includes(mode));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (ref, path) => execFileSync('git', ['show', `${ref}:${path}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
const read = path => readFileSync(resolve(root, path));
const downloadPath = 'apps/library-docs/docs/public/examples/modeling-circle.ts';
const guidePath = 'apps/library-docs/docs/packages/cad/modeling.md';
const guide = read(guidePath).toString(), download = read(downloadPath).toString();
for (const term of ["withBase('/examples/modeling-circle.ts')", 'Create a round post', 'Optional center coordinates',
  '98 vertices, 64 triangles, three face ranges', 'Certified volume is unavailable', 'authored XYZ', '[x,z,-y]',
  'External visual gate OPEN', 'baseline mock', 'same wall', '81,412-byte', pin]) assert.ok(guide.includes(term), term);
assert.ok(!guide.includes('The editor currently refuses difference outputs'));
assert.ok(!guide.includes('top-entry or arbitrary cutters; editor preview unavailable'));
for (const path of ['packages/barocss-cad/src/modeling.ts', 'packages/barocss-cad/test/modeling-circle-fixture.mjs'])
  assert.equal(hash(read(path)), hash(git(pin, path)), path);
const transferPath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-circle/baseline-native.json';
const bytes = read(transferPath), transfer = JSON.parse(bytes), native = transfer.bodies.post.native;
assert.equal(bytes.length, 81412); assert.equal(hash(bytes), '7338e8c36033d6a324760c9fc101d9509b73e89f223246395250c83cee6cc4e8');
assert.equal(hash(bytes), hash(git(pin, 'packages/barocss-cad/test/modeling-circle-evidence/baseline-transfer.json')));
assert.equal(native.certificate.genus, 0); assert.equal(native.certificate.solid, true); assert.equal(native.parent.report.solid, false);
assert.equal(transfer.preview.report.solid, false); assert.equal(transfer.preview.packet.positions.length / 3, 98);
assert.equal(transfer.preview.packet.indices.length / 3, 64); assert.equal(transfer.preview.faceRanges.length, 3);
assert.equal(transfer.preview.packet.parameters.length, 196); assert.equal(transfer.preview.edgeProvenance.length, 3);
assert.deepEqual(JSON.parse(transfer.text).outputs, { post: { node: 1, side: 'solid' } });
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? files(join(directory, entry.name)) : /\.(ts|json|cad\.css)$/.test(entry.name) ? [join(directory, entry.name)] : []);
const downloads = files(resolve(app, 'docs/public/examples')).map(path => path.slice(root.length + 1)); assert.equal(downloads.length, 25);
const preservedDownloads = downloads.filter(path => path !== downloadPath).map(path => {
  const sha256 = hash(read(path)); assert.equal(sha256, hash(git(base, path)), path); return { path, sha256 };
}); assert.equal(preservedDownloads.length, 24);
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json')), ts = require('typescript');
for (const statement of ts.createSourceFile(downloadPath, download, ts.ScriptTarget.ESNext, true).statements)
  assert.ok(ts.isImportDeclaration(statement) || ts.isFunctionDeclaration(statement), 'inert import');
let entry, typedExampleFiles = 0, declarationCount = 0;
if (mode !== 'static') {
  entry = mode === 'source' ? resolve(root, 'packages/barocss-cad/src/index.ts')
    : resolve(process.env.CAD_DECL_ROOT ?? resolve(root, 'packages/barocss-cad/dist'), 'index.d.ts');
  const provider = JSON.parse(git(pin, 'packages/barocss-cad/test/modeling-circle-evidence/verification.json'));
  if (mode === 'emitted') for (const [path, sha] of Object.entries(provider.emittedDeclarationHashes)) {
    assert.equal(hash(readFileSync(resolve(entry, '..', path.replace(/^dist\//, '')))), sha, path); declarationCount++;
  }
  const examples = [resolve(app, 'scripts/snippets/modeling-api.ts'), ...downloads.filter(path => /\/modeling-.*\.ts$/.test(path)).map(path => resolve(root, path))];
  typedExampleFiles = examples.length; assert.equal(typedExampleFiles, 13);
  const directory = mkdtempSync(join(tmpdir(), 'cad-circle-types-'));
  try {
    const config = join(directory, 'tsconfig.json');
    writeFileSync(config, JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext',
      moduleResolution: 'NodeNext', skipLibCheck: true, types: [], paths: { '@barocss/cad': [entry] } }, files: examples }));
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], { stdio: 'inherit' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
console.log(JSON.stringify({ ok: true, mode, providerPin: pin, base, typedExampleFiles, declarationCount,
  guideSHA256: hash(guide), downloadSHA256: hash(download), transferSHA256: hash(bytes), transferBytes: bytes.length,
  preservedDownloads, totalDownloads: 25, nativeCalls: 0, externalVisualGate: 'OPEN',
  scope: 'exact source/transfer/download static checks and separately requested public example types; no native or browser run' }, null, 2));
