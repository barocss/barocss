/** Controlled Native authoring/codec regression; no browser, OS picker or GPU pixels. */
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const app = dirname(fileURLToPath(import.meta.url)), workspace = resolve(app, '../..');
const output = await mkdtemp(join(app, 'node_modules', '.barocss-native-gizmo-authoring-'));
let result;
try {
  const source = await readFile(join(app, 'public/reference-panel.barocad'), 'utf8');
  const bundle = join(output, 'flow.mjs');
  await build({entryPoints: [join(app, 'src/native-scene-gizmo-flow.ts')], outfile: bundle,
    absWorkingDir: workspace, bundle: true, platform: 'node', format: 'esm'});
  const flow = await import(pathToFileURL(bundle).href);
  const first = flow.runNativeSceneGizmoFlow(source);
  assert.ok(first.firstFileText && first.firstRevision !== undefined, 'Missing accepted FIRST');
  assert.deepEqual(first.browserGlobalReads, [], 'FIRST accessed browser globals');
  const reopened = flow.runNativeSceneGizmoColdFlow(source, first.firstFileText);
  assert.ok(reopened.secondFileText && reopened.secondRevision !== undefined, 'Missing accepted SECOND');
  assert.deepEqual(reopened.browserGlobalReads, [], 'SECOND accessed browser globals');
  assert.ok(reopened.secondRevision > first.firstRevision, 'Fresh re-edit did not advance revision');
  result = {status: 'PASS', scope: 'Native CPU session/codec; fresh host Open and re-edit, not physical files or GPU',
    firstChecks: first.checks.length, secondChecks: reopened.checks.length,
    firstRevision: first.firstRevision, secondRevision: reopened.secondRevision};
} finally {
  await rm(output, {recursive: true, force: true});
}
process.stdout.write(JSON.stringify(result) + '\n');
