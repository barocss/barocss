import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
assert(args.length === 8 && args[0] === '--original' && args[2] === '--edited'
  && args[4] === '--reopened' && args[6] === '--output',
'Use --original <actual original download> --edited <actual authored download> --reopened <actual re-edited download> --output <new directory>.');
const output = resolve(args[7]);
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const receipt = { issue: 1210, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  clean: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() === '',
  node: process.version, actualGL: false, scope: 'Cold actual browser files; CUA is separate', ok: false };
let stage = 'current source imports';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const bundle = await build({ absWorkingDir: root,
    stdin: { contents: "export * from '@barocss/render-editor'; export {compileGpu} from '@barocss/gpu';", resolveDir: resolve(root, 'apps/render-editor'), sourcefile: 'actual-scene-files.mjs' },
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true });
  const inputs = Object.keys(bundle.metafile.inputs);
  const sources = inputs.filter(path => /packages\/barocss-[^/]+\/src\//.test(path));
  assert(sources.length > 0);
  assert.equal(inputs.filter(path => /packages\/barocss-[^/]+\/dist\//.test(path)).length, 0);
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const documents = [];
  for (const index of [1, 3, 5]) {
    const path = resolve(args[index]), text = await readFile(path, 'utf8');
    const document = api.parseRenderEditorDocument(text);
    assert.equal(api.serializeRenderEditorDocument(document), text);
    const compilation = api.compileGpu({ kind: 'scene', source: document.sceneSource, sourceVersion: 1 });
    assert(compilation.ok && compilation.execution.kind === 'sdf');
    documents.push({ path, bytes: Buffer.byteLength(text), document, scene: compilation.execution.scene });
  }
  const [original, edited, reopened] = documents;
  receipt.source = { ownSourceInputs: sources.length, ownDistInputs: 0 };
  stage = 'actual original sample';
  assert.deepEqual(original.scene.objects.map(object => [object.id, object.type]),
    [['orb', 'sphere'], ['block', 'box'], ['post', 'cylinder']]);
  stage = 'authored object tools';
  const fields = document => { const { sceneSource, revision, ...rest } = document; void sceneSource; void revision; return rest; };
  assert.deepEqual(fields(edited.document), fields(original.document));
  assert.deepEqual(fields(reopened.document), fields(original.document));
  assert(edited.document.revision > original.document.revision);
  assert(reopened.document.revision > edited.document.revision);
  for (const value of [edited, reopened]) {
    assert.equal(value.scene.name, original.scene.name);
    assert.deepEqual(value.scene.background, original.scene.background);
    assert(!value.scene.objects.some(object => object.id === 'post'));
    assert.equal(value.scene.objects.length, 3);
    const originalOrb = original.scene.objects.find(object => object.id === 'orb');
    const orb = value.scene.objects.find(object => object.id === 'orb');
    const originalBox = original.scene.objects.find(object => object.id === 'block');
    const box = value.scene.objects.find(object => object.id === 'block');
    assert.equal(orb.type, 'sphere'); assert.equal(box.type, 'box');
    assert.deepEqual(orb.translate, originalOrb.translate);
    assert.deepEqual(orb.rotateDegrees, originalOrb.rotateDegrees);
    assert.deepEqual(orb.color, originalOrb.color);
    assert.notEqual(orb.radius, originalOrb.radius);
    assert.notDeepEqual(box.translate, originalBox.translate);
    assert.notDeepEqual(box.rotateDegrees, originalBox.rotateDegrees);
    assert.notDeepEqual(box.size, originalBox.size);
    assert.deepEqual(box.color, originalBox.color);
    const added = value.scene.objects.filter(object => !original.scene.objects.some(previous => previous.id === object.id));
    assert.equal(added.length, 1); assert.equal(added[0].type, 'torus');
    assert(value.document.sceneSource.startsWith('/* Primitive study: edit the original source, then Apply. */'));
    assert(!Object.keys(value.document).some(key => /panel|drawer|layout|selection|gizmo|compiled|shader/i.test(key)));
  }
  stage = 'fresh file re-edit';
  const editedBox = edited.scene.objects.find(object => object.id === 'block');
  const reopenedBox = reopened.scene.objects.find(object => object.id === 'block');
  assert.deepEqual(reopenedBox, editedBox);
  const editedTorus = edited.scene.objects.find(object => object.type === 'torus');
  const reopenedTorus = reopened.scene.objects.find(object => object.type === 'torus');
  assert.deepEqual(reopenedTorus, editedTorus);
  assert.notEqual(reopened.scene.objects.find(object => object.id === 'orb').radius,
    edited.scene.objects.find(object => object.id === 'orb').radius);
  receipt.files = documents.map(({ path, bytes, document, scene }) => ({ path, bytes, revision: document.revision,
    originalIds: scene.objects.map(object => [object.id, object.type]) }));
  receipt.authored = { identityCameraExact: true, actualAddTorusRemoveCylinder: true, selectedBoxPositionRotationDimensions: true,
    sphereRadius: true, unrelatedFieldsExact: true, freshReedit: true, layoutAbsent: true };
  receipt.ok = true;
} catch (error) {
  receipt.firstFailure = { stage, message: error.message ?? String(error), stack: error.stack ?? String(error) };
  process.exitCode = 1;
}
await writeFile(resolve(output, 'cold-files.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
