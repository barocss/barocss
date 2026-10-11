import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, access, statfs, realpath} from 'node:fs/promises';
import {resolve, dirname, relative, isAbsolute, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {ORIGINAL_PINS} from './exact-surface-band-three-fixture.mjs';

const PARENT = 'a20ee1e378cffb4acfccb78cd7c1c0b59380680e';
const SELF = fileURLToPath(import.meta.url), EXAMPLES = dirname(SELF), ROOT = resolve(EXAMPLES, '../../..');
const PREFIX = 'exact-surface-band-three';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = value => JSON.stringify(value, null, 2) + '\n';
const within = (file, directory) => file === directory || file.startsWith(directory + sep);
async function exists(file) { try { await access(file); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; return false; } }
async function filePin(file) { const bytes = await readFile(file); return {file, bytes: bytes.length, sha256: sha(bytes)}; }
function git(...args) {
  const result = spawnSync('git', args, {cwd: ROOT, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
  assert.equal(result.status, 0, result.stderr || 'Immutable Git read failed'); return result.stdout;
}

// Compile-only consumer. No function below is invoked by this metadata tool.
const TYPE_SOURCE = String.raw`
import {validateExactSurfaceBandTrim, ExactSurfaceBandTrimError,
  type ExactSurfaceBandTrimResult, type ExactSurfaceBandTrimReport, type ExactSurfaceBandTrimOptions,
  type ExactSurfaceBandTrimEdge, type ExactSurfaceBandTrimDiagnosticCode,
  type Model, type Curve, type Point, type CurveD1Result, type SurfaceD1Result} from '@barocss/cad';
import {BaroCADLoader, type BaroCadThreeResult} from '@barocss/cad-interop/three';
import {BaroCADSelectedUniformCurveLoader, type BaroCadSelectedUniformCurveThreeResult,
  type BaroCadSelectedUniformCurveSourceOptions} from '@barocss/cad-interop/three-selected-uniform-curve';
import {BaroCadUniformCurveSourceError, type BaroCadUniformCurveSourceDiagnosticCode}
  from '@barocss/cad-interop/native-selected-uniform-curve';
import type {BaroCadParseOptions, BaroCadLoadTransportOptions} from '@barocss/cad-interop/native';
import type {Group, Line, BufferGeometry, LineBasicMaterial} from 'three';

export const wholeValidator: (input: ExactSurfaceBandTrimResult) => ExactSurfaceBandTrimReport = validateExactSurfaceBandTrim;
export function retainedWhole(input: ExactSurfaceBandTrimResult, report: ExactSurfaceBandTrimReport) {
  const lower: ExactSurfaceBandTrimResult['lower'] = input.lower;
  const upper: ExactSurfaceBandTrimResult['upper'] = input.upper;
  const options: ExactSurfaceBandTrimOptions = input.options;
  const model: Model = input.world.model, source: string = input.world.source, sourceVersion: 0 = input.world.sourceVersion;
  const vertices: ExactSurfaceBandTrimResult['vertices'] = input.vertices;
  const edges: ExactSurfaceBandTrimEdge[] = input.edges;
  const world: Curve = edges[0].curve, uv: Curve = edges[0].pcurve.curve;
  const uvUnit: 'dimensionless' = edges[0].pcurve.lengthUnit;
  const uses: ExactSurfaceBandTrimResult['loop']['uses'] = input.loop.uses;
  const face: ExactSurfaceBandTrimResult['face'] = input.face;
  const cutSpans: ExactSurfaceBandTrimResult['proof']['cutBindings'][number]['spans'] = input.proof.cutBindings[0].spans;
  const projection: ExactSurfaceBandTrimResult['proof']['projection'] = input.proof.projection;
  const embedding: ExactSurfaceBandTrimResult['proof']['faceEmbedding'] = input.proof.faceEmbedding;
  const observations: ExactSurfaceBandTrimResult['observations'] = input.observations;
  const observation = observations[0], chain: Point | null = observation.chain;
  if (observation.world.d1.status === 'evaluated') {
    const value: CurveD1Result = observation.world.d1.value;
    const point: Point = value.point, derivative: Point = value.derivative; void [point, derivative];
  } else {
    const reason: string = observation.world.d1.reason; void reason;
  }
  if (observation.surface.d1.status === 'evaluated') {
    const value: SurfaceD1Result = observation.surface.d1.value;
    const point: Point = value.point, du: Point = value.du, dv: Point = value.dv; void [point, du, dv];
  } else { const nativeErrorName: string = observation.surface.d1.nativeErrorName; void nativeErrorName; }
  const schema: 'barocss-exact-surface-band-trim' = report.schema, version: 0 = report.version;
  const wholeBody: false = report.quality.wholeBodyTopologyCertified, solid: false = report.quality.solid;
  const counts: ExactSurfaceBandTrimReport['directCounts'] = report.directCounts;
  const quality: ExactSurfaceBandTrimReport['quality'] = report.quality;
  const limits: ExactSurfaceBandTrimReport['limits'] = report.limits;
  void [lower, upper, options, model, source, sourceVersion, vertices, world, uv, uvUnit, uses, face,
    cutSpans, projection, embedding, chain, schema, version, wholeBody, solid, counts, quality, limits];
  // Native/report data are mutable copied values, not a fabricated readonly DTO.
  input.face.orientation = input.face.orientation; report.maximumObservedPointGapMM = report.maximumObservedPointGapMM;
  // @ts-expect-error Native false qualification is not a filled Body/Solid certificate.
  report.quality.solid = true;
  // @ts-expect-error Exact native whole result has no synthetic classifier packet.
  void input.classification;
}
export function targetContracts(source: string, surfaceOptions: BaroCadParseOptions,
  selectedOptions: BaroCadSelectedUniformCurveSourceOptions, url: string, transport: BaroCadLoadTransportOptions) {
  const surfaceLoader = new BaroCADLoader(surfaceOptions), selectedLoader = new BaroCADSelectedUniformCurveLoader(selectedOptions);
  const surface: BaroCadThreeResult = surfaceLoader.parse(source);
  const curve: BaroCadSelectedUniformCurveThreeResult = selectedLoader.parse(source);
  const surfaceGroup: Group = surface.group, selectedGroup: Group = curve.group;
  const line: Line<BufferGeometry, LineBasicMaterial> = curve.line;
  const model: Model = curve.model, curveDTO: Curve = curve.curve;
  const ordinal: number = curve.selectedObjectIndex, domain: [number, number] = curve.domain;
  const parameters: number[] = curve.parameters, pointsMM: Point[] = curve.pointsMM;
  const intervals: [number, number][] = curve.intervals, positions: Float32Array = curve.positions;
  const unrendered: string[] = curve.unrenderedObjectIds;
  const sourceRetained: string = surface.source;
  const surfaces: BaroCadThreeResult['surfaces'] = surface.surfaces;
  const omitted: string[] = surface.unrenderedCurveIds;
  const surfaceURL: Promise<BaroCadThreeResult> = surfaceLoader.loadAbortable(url, transport);
  const selectedURL: Promise<BaroCadSelectedUniformCurveThreeResult> = selectedLoader.loadAsync(url, transport);
  void [surfaceGroup, selectedGroup, line, model, curveDTO, ordinal, domain, parameters, pointsMM, intervals,
    positions, unrendered, sourceRetained, surfaces, omitted, surfaceURL, selectedURL];
  // @ts-expect-error Selected ID is the original string ID.
  selectedOptions.curveId = 1;
  // @ts-expect-error Only explicit source version0 is supported by this profile.
  selectedOptions.sourceVersion = 1;
  // @ts-expect-error Surface native fields are flat; no synthetic nested native result.
  void surface.native;
  // @ts-expect-error Selected positions are renderer Float32, not Uint32 indices.
  const notPositions: Uint32Array = curve.positions;
  void notPositions;
}
export function actualErrorContracts(nativeError: ExactSurfaceBandTrimError, sdkError: BaroCadUniformCurveSourceError) {
  const nativeCode: ExactSurfaceBandTrimDiagnosticCode = nativeError.code;
  const sdkCode: BaroCadUniformCurveSourceDiagnosticCode = sdkError.code;
  const nativeCause: unknown = nativeError.cause, sdkCause: unknown = sdkError.cause;
  const diagnostics: BaroCadUniformCurveSourceError['diagnostics'] = sdkError.diagnostics;
  void [nativeCode, sdkCode, nativeCause, sdkCause, diagnostics];
  // @ts-expect-error Native errorcode is readonly (same value assignment).
  nativeError.code = nativeError.code;
  // @ts-expect-error SDK errorcode is readonly (same value assignment).
  sdkError.code = sdkError.code;
  // @ts-expect-error SDK cause is readonly; undefined remains a legitimate owned cause value.
  sdkError.cause = sdkError.cause;
}
`;


export function assertRetainedManifest(manifest, baseline) {
  for (const [current, prior] of [[manifest.exports, baseline.exports],
    [manifest.publishConfig.exports, baseline.publishConfig.exports]]) {
    const oldKeys = Object.keys(prior);
    assert.deepEqual(Object.keys(current).filter(key => Object.hasOwn(prior, key)), oldKeys,
      'Every original export remains in its original relative order');
    for (const key of oldKeys) assert.deepEqual(current[key], prior[key], 'Original export unchanged: ' + key);
  }
  assert.deepEqual(Object.keys(manifest.exports), Object.keys(manifest.publishConfig.exports));
  assert.deepEqual({...manifest, exports: baseline.exports,
    publishConfig: {...manifest.publishConfig, exports: baseline.publishConfig.exports}}, baseline,
    'Only independently added exports may differ from the frozen package metadata');
}

export async function main(argv = process.argv.slice(2)) {
  assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Use selected Node22');
  assert.equal(argv.length, 4); assert.equal(argv[0], '--mode'); assert.equal(argv[2], '--output');
  const mode = argv[1]; assert.ok(mode === 'source' || mode === 'emitted');
  assert.ok(isAbsolute(argv[3]), 'Output must be absolute'); const output = resolve(argv[3]);
  assert.ok(!within(output, ROOT), 'Output must be outside the product tree');
  assert.equal(await exists(output), false, 'Preserve first output directory');
  await mkdir(output, {recursive: true});
  const save = (name, value) => writeFile(resolve(output, name), jsonBytes(value), {flag: 'wx'});
  const stages = [], resolutions = [], packages = new Map();
  await save('command.json', {node: process.version, argv: process.argv, mode, output, root: ROOT, parent: PARENT,
    pid: process.pid, cpuNativeSDKBrowserCalls: 0, scope: 'Metadata/browser-composition and selected published declarations only; no browser or CPU admission'});
  try {
    const disk = await statfs(output); assert.ok(disk.bavail * disk.bsize >= 256 * 1024 * 1024, '256MiB output reserve');
    git('merge-base', '--is-ancestor', PARENT, 'HEAD'); // The frozen provider parent remains an ancestor after this example is committed.
    for (const suffix of ['cad', 'cad-interop']) {
      const directory = resolve(ROOT, 'packages/barocss-' + suffix), manifestFile = resolve(directory, 'package.json');
      const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
      const baseline = JSON.parse(git('show', PARENT + ':packages/barocss-' + suffix + '/package.json'));
      assertRetainedManifest(manifest, baseline);
      if (mode === 'source') assert.equal(await exists(resolve(directory, 'dist')), false, 'Source first before own library build');
      packages.set('@barocss/' + suffix, {directory, manifest, baseline});
    }
    const publicEntry = (specifier, field) => {
      const packageName = specifier.split('/').slice(0, 2).join('/'), item = packages.get(packageName);
      assert.ok(item, 'Only actual selected own packages resolve through this plugin');
      const tail = specifier.slice(packageName.length), key = tail ? '.' + tail : '.';
      const entry = item.manifest.publishConfig.exports[key], target = entry?.[field];
      assert.ok(typeof target === 'string' && target.startsWith('./dist/'), 'Actual published target required: ' + specifier);
      const file = resolve(item.directory, target); assert.ok(within(file, resolve(item.directory, 'dist')));
      return file;
    };
    const importer = createRequire(resolve(packages.get('@barocss/cad-interop').directory, 'package.json'));
    const {build} = importer('esbuild');
    const publishedPlugin = {name: 'actual-publishConfig-import-only', setup(builder) {
      builder.onResolve({filter: /^@barocss\/(cad|cad-interop)(\/|$)/}, args => {
        const file = publicEntry(args.path, 'import');
        resolutions.push({specifier: args.path, importer: args.importer, target: file, field: 'import'}); return {path: file};
      });
    }};
    const entry = resolve(EXAMPLES, PREFIX + '.mjs');
    const ownExamples = new Set(['.mjs', '-fixture.mjs', '-checkpoint.mjs', '-observer.mjs'].map(s => resolve(EXAMPLES, PREFIX + s)));
    const built = await build({absWorkingDir: ROOT, bundle: true, write: false, format: 'esm', platform: 'browser',
      target: 'es2022', metafile: true, entryPoints: [entry], outfile: resolve(output, 'browser.bundle.mjs'),
      ...(mode === 'emitted' ? {plugins: [publishedPlugin]} : {})});
    stages.push({stage: 'browser-composition', complete: true, nativeSDKBrowserCalls: 0});
    await save('browser-metafile.json', built.metafile);
    const inputs = [];
    for (const name of Object.keys(built.metafile.inputs)) {
      // Esbuild intentionally disabled browser builtins are virtual metadata, never filesystem fallbacks.
      if (name.startsWith('(disabled):')) { inputs.push({name, namespace: 'disabled', virtual: true,
        imports: built.metafile.inputs[name].imports}); continue; }
      const file = resolve(ROOT, name), real = await realpath(file);
      const own = [...packages.values()].find(item => within(file, item.directory));
      if (own) {
        if (within(file, EXAMPLES)) assert.ok(ownExamples.has(file), 'No older/private example import: ' + file);
        else assert.ok(within(file, resolve(own.directory, mode === 'source' ? 'src' : 'dist')),
          'Own source/emitted closure must not fall back: ' + file);
      } else assert.ok(within(file, resolve(ROOT, 'node_modules')) || real.includes('/node_modules/'), 'Unexpected outside input: ' + file);
      assert.ok(!/\/(@babylonjs|babylonjs|pixi\.js|pixi3d)(\/|@)/.test(real), 'No other renderer peer');
      inputs.push({name, namespace: 'file', ...(await filePin(file)), realpath: real,
        imports: built.metafile.inputs[name].imports});
    }
    const physical = inputs.filter(row => row.namespace === 'file');
    const ownSource = physical.filter(row => [...packages.values()].some(item => within(row.file, resolve(item.directory, 'src'))));
    const ownEmitted = physical.filter(row => [...packages.values()].some(item => within(row.file, resolve(item.directory, 'dist'))));
    assert.ok((mode === 'source' ? ownSource : ownEmitted).length > 0);
    assert.equal((mode === 'source' ? ownEmitted : ownSource).length, 0);
    for (const leaf of ['exact-surface-band-trim', 'three', 'three-selected-uniform-curve', 'native-selected-uniform-curve']) {
      const suffix = '/' + leaf + (mode === 'source' ? '.ts' : '.js');
      assert.ok(physical.some(row => row.file.endsWith(suffix)), 'Actual selected public closure required: ' + leaf);
    }
    const peerThree = physical.filter(row => row.realpath.includes('/node_modules/three/'));
    assert.ok(peerThree.length > 0, 'Actual physical Three runtime required');
    const graph = {mode, parent: PARENT, aliases: false, cpuNativeSDKBrowserCalls: 0,
      rawInputNames: Object.keys(built.metafile.inputs), inputs, resolutions,
      ownSource: ownSource.map(row => row.file), ownEmitted: ownEmitted.map(row => row.file),
      ownSourceCount: ownSource.length, ownEmittedCount: ownEmitted.length,
      peerThree: peerThree.map(row => row.file), peerThreeCount: peerThree.length,
      selectedExamples: physical.filter(row => ownExamples.has(row.file)).map(row => row.file),
      scope: 'Actual composed browser graph; no CPU/renderer execution or all-entry runtime acceptance'};
    await save('browser-graph.json', graph); await save('source-graph.json', graph);
    assert.equal(built.outputFiles.length, 1, 'One external browser JavaScript bundle');
    await writeFile(resolve(output, 'browser.bundle.mjs'), built.outputFiles[0].contents, {flag: 'wx'});
    const literalNames = ['edited.actual-model5.source0.css', 'edited.band-result.json', 'edited.independent-coefficient-oracle.json',
      'main.actual-model5.source0.css', 'main.band-result.json', 'main.independent-coefficient-oracle.json',
      'rev.actual-model5.source0.css', 'rev.band-result.json'];
    const originals = [], originalFilePins = [];
    for (const file of literalNames) {
      const pin = await filePin(resolve(EXAMPLES, PREFIX + '-data', file));
      const original = ORIGINAL_PINS.find(row => row.file === file);
      assert.ok(original, 'Frozen original file pin required');
      assert.equal(pin.bytes, original.bytes); assert.equal(pin.sha256, original.sha256);
      originals.push({file, bytes: pin.bytes, sha256: pin.sha256}); originalFilePins.push({...pin, name: file});
    }
    assert.equal(originals.length, 8); assert.equal(originals.reduce((sum, row) => sum + row.bytes, 0), 1101560);
    await save('original-pins.json', {originalPins: originals, filePins: originalFilePins});
    let types = null;
    if (mode === 'emitted') {
      const publishedPairs = [];
      for (const [name, item] of packages) {
        for (const [key, published] of Object.entries(item.manifest.publishConfig.exports)) {
          if (Object.hasOwn(item.baseline.exports, key)) {
            assert.deepEqual(item.manifest.exports[key], item.baseline.exports[key]);
            assert.deepEqual(published, item.baseline.publishConfig.exports[key]);
          }
          const entrySpecifier = name + (key === '.' ? '' : key.slice(1));
          const importPin = await filePin(publicEntry(entrySpecifier, 'import'));
          const typesPin = await filePin(publicEntry(entrySpecifier, 'types'));
          publishedPairs.push({package: name, key, import: importPin, types: typesPin});
        }
      }
      await save('published-entry-pins.json', {interopMaps: Object.keys(packages.get('@barocss/cad-interop').manifest.exports).length,
        cadMaps: Object.keys(packages.get('@barocss/cad').manifest.exports).length, originalRetainedInteropMaps: 50, pairs: publishedPairs,
        scope: 'Existence and byte pins of all retained public maps; not all-entry semantic acceptance'});
      const ts = importer('typescript'), virtual = resolve(EXAMPLES, PREFIX + '-published-type-consumer.mts');
      await writeFile(resolve(output, 'published-type-consumer.mts'), TYPE_SOURCE, {flag: 'wx'});
      const compilerOptions = {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true, skipLibCheck: true,
        types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts']};
      const host = ts.createCompilerHost(compilerOptions), baseGet = host.getSourceFile.bind(host),
        baseExists = host.fileExists.bind(host), baseRead = host.readFile.bind(host), typeResolutions = [];
      host.getSourceFile = (file, languageVersion, onError, createNew) => resolve(file) === virtual ?
        ts.createSourceFile(virtual, TYPE_SOURCE, languageVersion, true, ts.ScriptKind.TS) : baseGet(file, languageVersion, onError, createNew);
      host.fileExists = file => resolve(file) === virtual || baseExists(file);
      host.readFile = file => resolve(file) === virtual ? TYPE_SOURCE : baseRead(file);
      host.resolveModuleNames = (names, containingFile) => names.map(name => {
        if (/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)) {
          const file = publicEntry(name, 'types');
          typeResolutions.push({specifier: name, importer: containingFile, target: file, field: 'types'});
          return {resolvedFileName: file, extension: ts.Extension.Dts, isExternalLibraryImport: true};
        }
        return ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule;
      });
      const program = ts.createProgram([virtual], compilerOptions, host), diagnostics = ts.getPreEmitDiagnostics(program).map(item => ({
        code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
        file: item.file?.fileName ?? null, start: item.start ?? null}));
      const declarationFiles = program.getSourceFiles().map(row => resolve(row.fileName));
      const ownDeclarations = declarationFiles.filter(file => [...packages.values()].some(item =>
        within(file, resolve(item.directory, 'dist')) || within(file, resolve(item.directory, 'src'))));
      const sourceFallbacks = ownDeclarations.filter(file => [...packages.values()].some(item => within(file, resolve(item.directory, 'src'))));
      const declarationPins = [];
      for (const file of declarationFiles) {
        if (file !== virtual) declarationPins.push(await filePin(file));
      }
      types = {compiler: ts.version, strict: true, noEmit: true, skipLibCheck: true, virtual,
        consumer: await filePin(resolve(output, 'published-type-consumer.mts')), diagnostics, sourceFallbacks,
        ownDeclarations, ownDeclarationCount: ownDeclarations.length, resolutions: typeResolutions,
        declarationPins, physicalPeerThreeDeclarations: declarationFiles.filter(file => file.includes('/node_modules/') && /three/.test(file)),
        allRetainedInteropMaps: Object.keys(packages.get('@barocss/cad-interop').manifest.exports).length, originalRetainedInteropMaps: 50, scope: 'Selected actual band whole/report/D1 + existing Three Surface/selectedCurve/runtime Error public declarations; no all-entry type certificate'};
      await save('published-types.json', types);
      assert.deepEqual(diagnostics, []); assert.deepEqual(sourceFallbacks, []);
      for (const leaf of ['exact-surface-band-trim', 'three', 'three-selected-uniform-curve', 'native-selected-uniform-curve'])
        assert.ok(ownDeclarations.some(file => file.endsWith('/' + leaf + '.d.ts')), 'Actual selected declaration required: ' + leaf);
      assert.ok(types.physicalPeerThreeDeclarations.length > 0);
      stages.push({stage: 'selected-published-declarations', complete: true, ownDeclarations: ownDeclarations.length});
    }
    const threePackageFile = resolve(ROOT, 'node_modules/three/package.json');
    const threePackage = JSON.parse(await readFile(threePackageFile, 'utf8'));
    assert.equal(threePackage.version, '0.186.1', 'Actual selected Three peer version');
    const manifest = {schema: 'barocss-exact-surface-band-three-public-tooling', version: 1, mode, parent: PARENT,
      bundle: await filePin(resolve(output, 'browser.bundle.mjs')), html: await filePin(resolve(EXAMPLES, PREFIX + '.html')),
      sourceGraph: await filePin(resolve(output, 'source-graph.json')), originalPins: originals, originalFilePins,
      threeVersion: threePackage.version, threePackage: await filePin(threePackageFile),
      packageMaps: [...packages].map(([name, item]) => ({name, development: item.manifest.exports, published: item.manifest.publishConfig.exports})),
      nativeSDKBrowserCalls: 0, types: types ? {file: resolve(output, 'published-types.json'), diagnostics: types.diagnostics.length} : null};
    await save('tooling-manifest.json', manifest);
    const summary = {result: 'exact-surface-band-three-public-tooling-ok', mode, parent: PARENT,
      nativeSDKBrowserCalls: 0, bundle: manifest.bundle, source: graph.ownSourceCount, emitted: graph.ownEmittedCount,
      selectedTypeDiagnostics: types?.diagnostics.length ?? null, stages,
      scope: 'Bundle/type metadata only. Root separately runs the genuine browser; native qualification is not executed here.'};
    await save('verify-summary.json', summary); process.stdout.write(JSON.stringify(summary) + '\n'); return summary;
  } catch (value) {
    await save('runner-first-failure.json', {hasFailure: true, thrownType: typeof value, thrownNull: value === null,
      name: value instanceof Error ? value.name : null, message: value instanceof Error ? value.message : String(value),
      stack: value instanceof Error ? value.stack : null, mode, parent: PARENT, stages, resolutions,
      nativeSDKBrowserCalls: 0});
    throw value;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
