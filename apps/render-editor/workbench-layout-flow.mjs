import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
assert(args.length === 6 && args[0] === '--layout-file' && args[2] === '--edited-file' && args[4] === '--output',
  'Use --layout-file <actual unchanged download> --edited-file <actual re-edited download> --output <new directory>.');
const output = resolve(args[5]);
await mkdir(dirname(output), { recursive: true }); await mkdir(output);
const receipt = { issue: 1196, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  clean: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() === '',
  node: process.version, startedAt: new Date().toISOString(), actualGL: false,
  scope: 'Cold real browser downloads; CUA layout/browser proof is separate', ok: false };
let stage = 'source import';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const bundle = await build({ absWorkingDir: root,
    stdin: { contents: "export * from '@barocss/render-editor';", resolveDir: resolve(root, 'apps/render-editor'), sourcefile: 'workbench-file-source.mjs' },
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true });
  const inputs = Object.keys(bundle.metafile.inputs);
  const ownSources = inputs.filter(path => /packages\/barocss-[^/]+\/src\//.test(path));
  assert(ownSources.length > 0); assert.equal(inputs.filter(path => /packages\/barocss-[^/]+\/dist\//.test(path)).length, 0);
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const originalPath = '/Users/user/.barocss-ai/v3/render-editor-1180/evidence/final-browser/reedited.render-mixed.json';
  const originalText = await readFile(originalPath, 'utf8');
  const original = api.parseRenderMixedDocument(originalText), originalPrepared = api.prepareRenderMixedDocument(original);
  receipt.source = { sourceInputs: ownSources.length, ownDistInputs: 0, originalPath, originalBytes: Buffer.byteLength(originalText) };
  stage = 'layout-only download';
  const layoutPath = resolve(args[1]), layoutText = await readFile(layoutPath, 'utf8');
  const layout = api.parseRenderMixedDocument(layoutText), layoutPrepared = api.prepareRenderMixedDocument(layout);
  assert.equal(layoutText, originalText, 'Local panels/tabs/resize/view Cancel changed authored file bytes.');
  assert.deepEqual(layout, original); assert.deepEqual(layoutPrepared.model, originalPrepared.model);
  receipt.layout = { actualDownloadedPath: layoutPath, bytes: Buffer.byteLength(layoutText), revision: layout.revision,
    originalBytesExact: true, wholeDocumentExact: true, fullNativeModelExact: true };
  stage = 'fresh re-edited download';
  const editedPath = resolve(args[3]), editedText = await readFile(editedPath, 'utf8');
  const edited = api.parseRenderMixedDocument(editedText), editedPrepared = api.prepareRenderMixedDocument(edited);
  const { sceneSource: originalScene, revision: originalRevision, ...originalFields } = original;
  const { sceneSource: editedScene, revision: editedRevision, ...editedFields } = edited;
  assert.deepEqual(editedFields, originalFields, 'UI layout or Sphere re-edit changed unrelated document authority.');
  assert(editedRevision > originalRevision);
  const initialProperties = api.inspectRenderMixedSphereSource(originalScene), editedProperties = api.inspectRenderMixedSphereSource(editedScene);
  assert.equal(editedProperties.objectId, initialProperties.objectId);
  assert.equal(editedProperties.color, initialProperties.color);
  assert.deepEqual(editedProperties.translate, initialProperties.translate);
  assert.notEqual(editedProperties.radius, initialProperties.radius);
  assert.equal(editedScene, api.editRenderMixedSphereSource(originalScene, initialProperties.objectId, { radius: editedProperties.radius }));
  assert.deepEqual(editedPrepared.model, originalPrepared.model);
  assert(editedPrepared.model.objects.find(object => object.id === 'stored_guide').controlPoints[0].every(value => Object.is(value, -0)));
  assert(!Object.keys(edited).some(key => /layout|panel|drawer|tab|width|height|preview/i.test(key)));
  receipt.edited = { actualDownloadedPath: editedPath, bytes: Buffer.byteLength(editedText), revision: editedRevision,
    properties: editedProperties, explicitRadiusOnlySourceEdit: true, nonSphereFieldsExact: true, fullNativeModelExact: true,
    assetRevision: edited.asset.revision, originalIds: editedPrepared.metadata.nativeObjects.map(object => object.id), signedZero: true,
    layoutStateAbsent: true };
  receipt.ok = true;
} catch (error) { receipt.firstFailure = { stage, message: error.message ?? String(error), stack: error.stack ?? String(error) }; process.exitCode = 1; }
receipt.finishedAt = new Date().toISOString();
await writeFile(resolve(output, 'cold-files.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
