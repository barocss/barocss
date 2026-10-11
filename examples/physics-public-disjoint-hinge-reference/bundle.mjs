import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, '../..');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function verifyLedger(name, field) {
  const bytes = await readFile(resolve(here, name));
  const ledger = JSON.parse(bytes);
  assert.equal(ledger.node, process.version, 'toolchain drift');
  assert.ok(Array.isArray(ledger[field]) && ledger[field].length > 0);
  for (const pin of ledger[field]) {
    const actual = await readFile(resolve(root, pin.path));
    assert.equal(actual.length, pin.bytes, `size drift: ${pin.path}`);
    assert.equal(sha(actual), pin.sha256, `hash drift: ${pin.path}`);
  }
  return { ledger, sha256: sha(bytes) };
}
export async function verifyFreeze({ execution = false } = {}) {
  const source = await verifyLedger('source-freeze.json', 'sources');
  const emitted = await verifyLedger('emitted-ledger.json', 'emits');
  assert.equal(emitted.ledger.cadBuildExitCode, 0);
  assert.equal(emitted.ledger.physicsBuildExitCode, 0);
  assert.equal(emitted.ledger.typesExitCode, 0);
  if (execution) assert.equal(source.ledger.numericalExecutionApproved, true);
  return { sourceFreezeSha256: source.sha256, emittedLedgerSha256: emitted.sha256, bankReuse: source.ledger.bankReuse }; 
}

/** Build only. Importing/calling the generated phase is owned by the one orchestrator. */
export async function bundle(graph, outputDirectory) {
  assert.ok(graph === 'source' || graph === 'compiled');
  const pins = await verifyFreeze();
  await mkdir(outputDirectory, { recursive: true });
  const productResolver = {
    name: 'actual-emitted-physics-provider',
    setup(builder) {
      builder.onResolve({ filter: /packages\/barocss-physics\/src\// }, args => {
        if (graph !== 'compiled') return;
        const sourcePath = resolve(args.resolveDir, args.path);
        const path = sourcePath.replace('/packages/barocss-physics/src/', '/packages/barocss-physics/dist/');
        assert.notEqual(path, sourcePath);
        return { path };
      });
    },
  };
  const outfile = resolve(outputDirectory, `${graph}-phase.mjs`);
  const result = await build({ absWorkingDir: root, entryPoints: [resolve(here, 'phase-entry.ts')],
    outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22',
    metafile: true, plugins: [productResolver], logLevel: 'silent' });
  const paths = Object.keys(result.metafile.inputs).map(path => relative(root, isAbsolute(path) ? path : resolve(root, path)));
  assert.ok(paths.includes(`packages/barocss-physics/${graph === 'compiled' ? 'dist' : 'src'}/disjoint-hinge/postcontact.${graph === 'compiled' ? 'js' : 'ts'}`));
  assert.ok(!paths.some(path => /examples\/physics-rigid-/.test(path)), 'private factory in producer graph');
  if (graph === 'compiled') assert.ok(!paths.some(path => path.startsWith('packages/barocss-physics/src/')), 'source substitute in compiled graph');
  const bytes = await readFile(outfile);
  const audit = { graph, executionKind: 'INTERNAL_PHASE', newPublicExecution: false,
    publicTrajectoryGO: false, outfile, bytes: bytes.length, sha256: sha(bytes), inputs: paths, ...pins };
  await writeFile(resolve(outputDirectory, `${graph}-metafile.json`), JSON.stringify(result.metafile, null, 2) + '\n');
  await writeFile(resolve(outputDirectory, `${graph}-provenance.json`), JSON.stringify(audit, null, 2) + '\n');
  return audit;
}
