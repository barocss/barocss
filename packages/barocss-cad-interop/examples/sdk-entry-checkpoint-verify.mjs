import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';
import { outputDirectory, publishedResolver, writeEvidence } from '../../../examples/workspace-source/probe.mjs';

assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Use Node22 for this compiled SDK checkpoint');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = outputDirectory();
const packageNames = ['@barocss/cad', '@barocss/cad-interop'];
const packages = new Map(await Promise.all(packageNames.map(async name => {
  const directory = resolve(root, 'packages', name.replace('@barocss/', 'barocss-'));
  const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  return [name, { directory, manifest }];
})));
const own = filename => [...packages.values()].some(item =>
  resolve(filename).startsWith(item.directory + '/src/') ||
  resolve(filename).startsWith(item.directory + '/dist/'));
const cpuConsumer = String.raw`
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Scene, Object3D, Line } from 'three';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { BaroCADLoader } from '@barocss/cad-interop/three';
const bytes = readFileSync(resolve(process.cwd(), 'packages/barocss-cad-interop/examples/native-capacity-data/linear-quarter-five.barocad'));
assert.equal(bytes.length, 819);
const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(sourceSha256, 'f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2');
const source = bytes.toString('utf8');
const ids = ['quarter_seed', 'quarter_copy_1', 'quarter_copy_2', 'quarter_copy_3', 'quarter_copy_4'];
const nativeOptions = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  nativeCapacity: { version: 1, maximumObjects: 16 },
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
const neutral = parseBaroCadSource(source, nativeOptions);
const loader = new BaroCADLoader(nativeOptions);
const result = loader.parse(source);
assert.equal(result.source, source);
assert.deepEqual(result.model, neutral.model);
assert.equal(result.model.name, 'quarter_pattern');
assert.equal(result.model.version, 0);
assert.equal(result.model.lengthUnit, 'mm');
assert.deepEqual(result.model.objects.map(object => object.id), ids);
assert.ok(result.model.objects.every(object => object.kind === 'curve'));
assert.equal(result.curves.length, 5);
assert.equal(result.surfaces.length, 0);
assert.deepEqual(result.unrenderedCurveIds, []);
assert.deepEqual(result.curves, neutral.curves);
let signedZeros = 0;
for (const object of result.model.objects) for (const point of object.controlPoints) for (const value of point) if (Object.is(value, -0)) signedZeros++;
assert.equal(signedZeros, 20);
const resources = result.group.children.map((object, index) => {
  assert.ok(object instanceof Line);
  assert.equal(object.name, ids[index]);
  const sample = neutral.curves[index].sample;
  assert.deepEqual(sample.curve, result.model.objects[index]);
  assert.deepEqual(sample.domain, [-3, 7]);
  assert.deepEqual(object.userData.barocss.nativeParameters, sample.parameters);
  assert.deepEqual(object.userData.barocss.nativeIntervals, sample.segments.map(segment => segment.domain));
  assert.equal(object.userData.barocss.lengthUnit, 'mm');
  assert.equal(object.userData.barocss.coordinateSystem, 'right-handed-y-up');
  assert.equal(object.geometry.getAttribute('normal'), undefined);
  assert.equal(object.geometry.getAttribute('_CAD_UV'), undefined);
  assert.deepEqual(object.geometry.getAttribute('position').array, neutral.curves[index].positions);
  for (const [point, coordinates] of sample.pointsMM.entries()) for (let axis = 0; axis < 3; axis++) {
    assert.ok(Object.is(object.geometry.getAttribute('position').array[point * 3 + axis], Math.fround(coordinates[axis] * 0.001)));
  }
  const entry = { geometryId: object.name, geometryDisposals: 0, materialDisposals: 0 };
  object.geometry.addEventListener('dispose', () => entry.geometryDisposals++);
  object.material.addEventListener('dispose', () => entry.materialDisposals++);
  return entry;
});
assert.equal(resources.length, 5);
const scene = new Scene(), marker = new Object3D();
marker.name = 'caller-marker'; scene.add(marker, result.group);
const retainedChildren = [...scene.children];
const refusalEvidence = [];
const refuse = (name, action) => {
  assert.throws(action, error => { refusalEvidence.push({ name, errorName: error.name, message: error.message,
    ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}) }); return true; });
  assert.deepEqual(scene.children, retainedChildren);
  assert.equal(result.source, source);
  assert.deepEqual(result.model, neutral.model);
  assert.ok(resources.every(entry => entry.geometryDisposals === 0 && entry.materialDisposals === 0));
};
const legacy = { ...nativeOptions }; delete legacy.nativeCapacity;
refuse('legacy-capacity', () => new BaroCADLoader(legacy).parse(source));
refuse('invalid-source', () => loader.parse(source.replace('degree:2', 'degree:99')));
refuse('invalid-capacity', () => new BaroCADLoader({ ...nativeOptions, nativeCapacity: { version: 1, maximumObjects: 4 } }).parse(source));
result.dispose(); result.dispose();
assert.equal(result.group.parent, null);
assert.equal(result.group.children.length, 0);
assert.deepEqual(scene.children, [marker]);
assert.equal(marker.parent, scene);
for (const entry of resources) { assert.equal(entry.geometryDisposals, 1); assert.equal(entry.materialDisposals, 1); }
console.log(JSON.stringify({ ok: true, sourceBytes: bytes.length, sourceSha256, modelName: result.model.name,
  nativeIds: ids, nativeObjects: 5, curveDisplays: 5, signedZeros, nativeDomain: [-3, 7], unitsPerMillimeter: 0.001,
  actualGeometryDisposals: 5, actualMaterialDisposals: 5, resources, callerMarkerPreserved: true, refusalEvidence,
  separateNeutralAndTargetParseCalls: true, scope: 'compiled-public-native-and-Three-CPU; no browser or all-entry runtime claim' }));
`;
const typeConsumer = `
import { parseBaroCadSource, type BaroCadParseOptions, type BaroCadNativeCapacityV1,
  type BaroCadCurveDisplayV1, type BaroCadNativeResult, type BaroCadLoadProgress } from '@barocss/cad-interop/native';
import { BaroCADLoader, type BaroCadThreeResult } from '@barocss/cad-interop/three';
import type { Model } from '@barocss/cad';
import type { Scene } from 'three';
export function options(): BaroCadParseOptions {
  const nativeCapacity: BaroCadNativeCapacityV1 = { version: 1, maximumObjects: 16 };
  const curveDisplay: BaroCadCurveDisplayV1 = { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 };
  return { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001, nativeCapacity, curveDisplay };
}
export function readNative(source: string): BaroCadNativeResult {
  const result: BaroCadNativeResult = parseBaroCadSource(source, options());
  const model: Model = result.model;
  const name: string = model.name;
  return result;
}
export function attach(source: string, scene: Scene): BaroCadThreeResult {
  const result: BaroCadThreeResult = new BaroCADLoader(options()).parse(source);
  scene.add(result.group);
  return result;
}
export async function attachURL(url: string, scene: Scene, signal: AbortSignal): Promise<BaroCadThreeResult> {
  const loader = new BaroCADLoader(options());
  const result: BaroCadThreeResult = await loader.loadAbortable(url, { signal,
    onProgress(event: BaroCadLoadProgress): void | false { const bytes: number = event.loadedBytes; if (bytes < 0) return false; } });
  scene.add(result.group);
  result.dispose();
  return result;
}
`;

async function inspectMaps() {
  const { directory, manifest } = packages.get('@barocss/cad-interop');
  const development = manifest.exports, published = manifest.publishConfig?.exports;
  const requiredEntries = [
    '.', './native', './native-uniform-curve', './document',
    './boolean-extrusion-feature-graph', './boolean-extrusion-feature-mesh',
    './boolean-extrusion-feature-properties', './assembly', './document-glb',
    './boolean-mesh-glb', './boolean-extrusion-glb', './three-document',
    './three-assembly', './three-boolean-contours', './three-boolean-mesh',
    './three-boolean-extrusion-mesh', './three', './babylon',
    './babylon-document', './babylon-assembly', './babylon-boolean-mesh',
    './babylon-boolean-extrusion-mesh', './pixi3d', './pixi3d-document',
    './pixi3d-assembly', './pixi3d-boolean-mesh',
    './pixi3d-boolean-extrusion-mesh', './model-set',
  ];
  for (const key of requiredEntries) {
    assert.ok(Object.hasOwn(development, key), `Missing development entry ${key}`);
    assert.ok(Object.hasOwn(published, key), `Missing published entry ${key}`);
  }
  assert.deepEqual(Object.keys(published).sort(), Object.keys(development).sort());
  assert.equal(manifest.main, './src/index.ts');
  assert.equal(manifest.types, './src/index.ts');
  assert.equal(manifest.publishConfig.main, './dist/index.js');
  assert.equal(manifest.publishConfig.types, './dist/index.d.ts');
  const entries = [];
  for (const key of Object.keys(published)) {
    const dev = development[key], pub = published[key];
    assert.ok(dev.types.startsWith('./src/') && dev.import.startsWith('./src/'));
    assert.equal(dev.types, dev.import);
    assert.ok(pub.types.startsWith('./dist/') && pub.types.endsWith('.d.ts'));
    assert.ok(pub.import.startsWith('./dist/') && pub.import.endsWith('.js'));
    assert.equal(pub.import, dev.import.replace('./src/', './dist/').replace(/\.ts$/, '.js'));
    assert.equal(pub.types, dev.types.replace('./src/', './dist/').replace(/\.ts$/, '.d.ts'));
    await access(resolve(directory, pub.types));
    await access(resolve(directory, pub.import));
    entries.push({ key, development: dev, published: pub, publishedFilesExist: true });
  }
  assert.deepEqual(development['./native-uniform-curve'], {
    types: './src/native-uniform-curve.ts', import: './src/native-uniform-curve.ts',
  });
  assert.deepEqual(published['./native-uniform-curve'], {
    types: './dist/native-uniform-curve.d.ts', import: './dist/native-uniform-curve.js',
  });
  return { interopEntries: entries, entryCount: entries.length,
    exercisedRuntimeEntries: ['./native', './three'], transitiveRuntimeEntry: '@barocss/cad',
    existenceCheckIsNotAllEntryRuntimeAcceptance: true };
}
function checkPublishedTypes() {
  const virtualFile = resolve(root, 'packages/barocss-cad-interop/examples/__sdk1017_virtual_consumer.ts');
  const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [], skipLibCheck: true };
  const host = ts.createCompilerHost(compilerOptions);
  const originalSource = host.getSourceFile.bind(host), originalRead = host.readFile.bind(host), originalExists = host.fileExists.bind(host);
  host.getSourceFile = (filename, languageVersion, onError, shouldCreateNewSourceFile) =>
    resolve(filename) === virtualFile ? ts.createSourceFile(filename, typeConsumer, languageVersion, true) :
      originalSource(filename, languageVersion, onError, shouldCreateNewSourceFile);
  host.readFile = filename => resolve(filename) === virtualFile ? typeConsumer : originalRead(filename);
  host.fileExists = filename => resolve(filename) === virtualFile || originalExists(filename);
  const resolutions = [];
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    if (/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)) {
      const packageName = name.split('/').slice(0, 2).join('/');
      const item = packages.get(packageName);
      const subpath = name.slice(packageName.length);
      const key = subpath ? '.' + subpath : '.';
      const target = item.manifest.publishConfig?.exports?.[key]?.types;
      assert.ok(typeof target === 'string' && target.startsWith('./dist/') && target.endsWith('.d.ts'), `${name} has no published declaration target`);
      const filename = resolve(item.directory, target);
      assert.ok(originalExists(filename), `Published declaration is absent: ${filename}`);
      resolutions.push({ specifier: name, importer: relative(root, containingFile), exportKey: key, target: relative(root, filename) });
      return { resolvedFileName: filename, extension: ts.Extension.Dts, isExternalLibraryImport: true };
    }
    return ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule;
  });
  const program = ts.createProgram([virtualFile], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => ({
    code: diagnostic.code, category: ts.DiagnosticCategory[diagnostic.category],
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    ...(diagnostic.file ? { file: relative(root, diagnostic.file.fileName),
      ...(diagnostic.start === undefined ? {} : { position: diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start) }) } : {}),
  }));
  const ownFiles = program.getSourceFiles().filter(file => own(file.fileName) && resolve(file.fileName) !== virtualFile).map(file => relative(root, file.fileName));
  const sourceFallbacks = ownFiles.filter(path => path.includes('/src/'));
  const declarationFiles = ownFiles.filter(path => path.includes('/dist/') && path.endsWith('.d.ts'));
  const peerDeclarationCount = program.getSourceFiles().filter(file =>
    file.fileName.includes('/node_modules/') && file.fileName.endsWith('.d.ts')).length;
  const evidence = { compiler: ts.version, noEmit: true, virtualConsumer: relative(root, virtualFile),
    consumer: typeConsumer, strict: true, skipLibCheck: true, lib: ['ES2022', 'DOM'], ambientTypes: [],
    peerResolution: 'normal TypeScript resolution for all non-own package imports',
    ownResolution: 'actual publishConfig.exports.types; standard resolution for relative declaration imports',
    diagnostics, ownSourceFallbacks: sourceFallbacks, ownDeclarationCount: declarationFiles.length,
    peerDeclarationCount, ownPackageFiles: 'CAD/interop src and dist only; peer declarations remain separate',
    ownDeclarationFiles: declarationFiles, resolutions,
    scope: 'published native/Three signatures with transitive CAD types; no emitted runtime or all-entry type parity claim' };
  assert.ok(declarationFiles.length > 0, 'Published own declarations were not checked');
  assert.ok(declarationFiles.some(path => path.startsWith('packages/barocss-cad/dist/')));
  assert.ok(declarationFiles.includes('packages/barocss-cad-interop/dist/native.d.ts'));
  assert.ok(declarationFiles.includes('packages/barocss-cad-interop/dist/three.d.ts'));
  return evidence;
}

let stage = 'maps';
try {
  const maps = await inspectMaps();
  await writeEvidence(output, 'sdk-published-maps.json', maps);
  stage = 'published-JS';
  const published = await publishedResolver();
  const bundle = await build({ absWorkingDir: root, stdin: { contents: cpuConsumer, sourcefile: 'sdk1017-compiled-consumer.mjs',
    resolveDir: resolve(root, 'packages/barocss-cad-interop') }, bundle: true, write: false,
    platform: 'node', format: 'esm', target: 'es2022', metafile: true, plugins: [published.plugin] });
  const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
  const ownInputs = inputs.filter(own);
  const sourceInputs = ownInputs.filter(path => path.includes('/src/'));
  const compiledInputs = ownInputs.filter(path => path.includes('/dist/'));
  const familyCounts = Object.fromEntries([...packages].map(([name, item]) => [name, compiledInputs.filter(path => path.startsWith(item.directory + '/')).length]));
  const resolutionEvidence = { mode: 'explicit-published-checkpoint', sourceFiles: sourceInputs.length, compiledFiles: compiledInputs.length,
    familyCounts, ownSourceInputs: sourceInputs.map(path => relative(root, path)), ownCompiledInputs: compiledInputs.map(path => relative(root, path)),
    publishedResolutions: published.resolutions, resolver: 'unchanged examples/workspace-source/probe.mjs publishedResolver()' };
  await writeEvidence(output, 'sdk-compiled-inputs.json', resolutionEvidence);
  assert.equal(sourceInputs.length, 0, 'Compiled checkpoint fell back to own source');
  for (const count of Object.values(familyCounts)) assert.ok(count > 0);
  const stdout = execFileSync(process.execPath, ['--input-type=module'], { cwd: root, input: bundle.outputFiles[0].text,
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const flow = JSON.parse(stdout);
  await writeEvidence(output, 'sdk-compiled-flow.json', flow);
  assert.equal(flow.ok, true);
  stage = 'published-types';
  const types = checkPublishedTypes();
  await writeEvidence(output, 'sdk-published-types.json', types);
  assert.equal(types.ownSourceFallbacks.length, 0, 'Published type checkpoint fell back to own source');
  assert.equal(types.diagnostics.length, 0, 'Published type consumer has compiler diagnostics');
  const summary = { issue: 1017, ok: true, node: process.version,
    runtime: { sourceFiles: 0, compiledFiles: compiledInputs.length, familyCounts,
      actualGeometryDisposals: flow.actualGeometryDisposals, actualMaterialDisposals: flow.actualMaterialDisposals },
    types: { diagnostics: types.diagnostics.length, ownDeclarationCount: types.ownDeclarationCount, ownSourceFallbacks: 0,
      strict: true, skipLibCheck: true, noEmit: true }, maps: { checkedEntries: maps.entryCount, exercisedRuntimeEntries: maps.exercisedRuntimeEntries },
    independentTarballOrRegistryConsumption: false, otherRendererRuntimeAcceptance: false };
  await writeEvidence(output, 'sdk-checkpoint-summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  await writeEvidence(output, 'sdk-checkpoint-failure.json', { issue: 1017, ok: false, stage,
    error: error.stack || String(error), ...(error.stderr ? { subprocessStderr: error.stderr.toString() } : {}) });
  console.error(error.stack || String(error));
  process.exitCode = 1;
}
