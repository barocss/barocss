import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';
import { publishedResolver } from '../../../examples/workspace-source/probe.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const dataDirectory = resolve(here, 'native-uniform-curve-source-data');
const packageNames = ['@barocss/cad', '@barocss/cad-interop'];
const entry = './native-uniform-curve';
const specifier = '@barocss/cad-interop/native-uniform-curve';
const packages = new Map(await Promise.all(packageNames.map(async name => {
  const directory = resolve(root, 'packages', name.replace('@barocss/', 'barocss-'));
  return [name, { directory, manifest: JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8')) }];
})));
const own = filename => [...packages.values()].some(item =>
  resolve(filename).startsWith(item.directory + '/'));
async function save(output, filename, value) {
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, filename), JSON.stringify(value, null, 2) + '\n');
}

const typeConsumer = [
  "import { parseBaroCadUniformCurveSource, BaroCadUniformCurveSourceError,",
  "  type BaroCadUniformCurveDisplayV1, type BaroCadUniformCurveSourceOptions,",
  "  type BaroCadUniformCurveSourceResult, type BaroCadUniformCurveSourceDiagnosticCode",
  "  } from '@barocss/cad-interop/native-uniform-curve';",
  "import type { Model, Point, CadDiagnostic } from '@barocss/cad';",
  'const display: BaroCadUniformCurveDisplayV1 = { version: 1, count: 129 };',
  'const options: BaroCadUniformCurveSourceOptions = { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: display };',
  'export function read(source: string): BaroCadUniformCurveSourceResult {',
  '  const result: BaroCadUniformCurveSourceResult = parseBaroCadUniformCurveSource(source, options);',
  "  const format: 'barocad-uniform-curve-preview' = result.format;",
  "  const mode: 'uniform-original-parameter' = result.mode;",
  '  const version: 1 = result.version;',
  '  const model: Model = result.model;',
  '  const parameters: number[] = result.parameters;',
  '  const points: Point[] = result.pointsMM;',
  '  const intervals: [number, number][] = result.intervals;',
  '  const domain: [number, number] = result.domain;',
  '  const positions: Float32Array = result.positions;',
  '  const displayOnly: true = result.quality.approximateDisplay;',
  '  const adaptiveError: false = result.quality.adaptiveErrorBound;',
  '  return result;',
  '}',
  'export function errorContract(cause: unknown): BaroCadUniformCurveSourceError {',
  "  const codes: BaroCadUniformCurveSourceDiagnosticCode[] = ['OPTIONS', 'SOURCE', 'PROFILE', 'SAMPLING', 'PARAMETERS', 'POSITIONS', 'SEGMENTS'];",
  '  const diagnostics: CadDiagnostic[] = [];',
  "  const error = new BaroCadUniformCurveSourceError(codes[3], 'actual typed constructor', diagnostics, cause);",
  '  const code: BaroCadUniformCurveSourceDiagnosticCode = error.code;',
  '  const preservedDiagnostics: CadDiagnostic[] = error.diagnostics;',
  '  const preservedCause: unknown = error.cause;',
  '  return error;',
  '}',
  '',
].join('\n');

function checkPublishedTypes() {
  const virtualFile = resolve(here, '__uniform1078_virtual_consumer.ts');
  const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [], skipLibCheck: true };
  const host = ts.createCompilerHost(compilerOptions);
  const originalSource = host.getSourceFile.bind(host);
  const originalRead = host.readFile.bind(host);
  const originalExists = host.fileExists.bind(host);
  host.getSourceFile = (filename, languageVersion, onError, recreate) =>
    resolve(filename) === virtualFile ? ts.createSourceFile(filename, typeConsumer, languageVersion, true) :
      originalSource(filename, languageVersion, onError, recreate);
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
      assert.ok(typeof target === 'string' && target.startsWith('./dist/') && target.endsWith('.d.ts'));
      const filename = resolve(item.directory, target);
      assert.ok(originalExists(filename), 'Missing emitted declaration: ' + filename);
      resolutions.push({ specifier: name, importer: relative(root, containingFile),
        exportKey: key, target: relative(root, filename) });
      return { resolvedFileName: filename, extension: ts.Extension.Dts, isExternalLibraryImport: true };
    }
    return ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule;
  });
  const program = ts.createProgram([virtualFile], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => ({
    code: diagnostic.code, category: ts.DiagnosticCategory[diagnostic.category],
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    ...(diagnostic.file ? { file: relative(root, diagnostic.file.fileName) } : {}),
  }));
  const ownFiles = program.getSourceFiles().filter(file => own(file.fileName) &&
    resolve(file.fileName) !== virtualFile).map(file => relative(root, file.fileName));
  return { compiler: ts.version, diagnostics, resolutions, consumer: typeConsumer,
    ownFiles, ownSourceFallbacks: ownFiles.filter(file => file.includes('/src/')),
    ownDeclarationFiles: ownFiles.filter(file => file.includes('/dist/') && file.endsWith('.d.ts')),
    strict: true, noEmit: true, skipLibCheck: true, ambientTypes: [],
    scope: 'Actual published optional-entry declarations and CAD types; no tarball installation' };
}

export async function runUniformCurveSourceCheckpoint(mode, output) {
  await mkdir(output, { recursive: true });
  let stage = 'entry-maps';
  try {
    assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Use Node22');
    assert.ok(mode === 'source' || mode === 'compiled');
    const { directory, manifest } = packages.get('@barocss/cad-interop');
    assert.deepEqual(manifest.exports[entry], {
      types: './src/native-uniform-curve.ts', import: './src/native-uniform-curve.ts',
    });
    assert.deepEqual(manifest.publishConfig.exports[entry], {
      types: './dist/native-uniform-curve.d.ts', import: './dist/native-uniform-curve.js',
    });
    const maps = { specifier, development: manifest.exports[entry],
      published: manifest.publishConfig.exports[entry], mode };
    if (mode === 'compiled') {
      await access(resolve(directory, maps.published.import));
      await access(resolve(directory, maps.published.types));
    }
    await save(output, mode + '-entry-maps.json', maps);
    stage = 'public-module-transform';
    const published = mode === 'compiled' ? await publishedResolver() : null;
    const contents = 'import { runUniformCurveSourceChecks } from "./native-uniform-curve-source-fixture.mjs";\n' +
      'console.log(JSON.stringify(runUniformCurveSourceChecks(' + JSON.stringify(dataDirectory) + ')));\n';
    const bundle = await build({ absWorkingDir: root,
      stdin: { contents, sourcefile: 'uniform1078-' + mode + '-consumer.mjs', resolveDir: here },
      bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', metafile: true,
      ...(published ? { plugins: [published.plugin] } : {}) });
    const inputs = Object.keys(bundle.metafile.inputs).map(file => resolve(root, file));
    const ownInputs = inputs.filter(own);
    const sourceInputs = ownInputs.filter(file => file.includes('/src/'));
    const compiledInputs = ownInputs.filter(file => file.includes('/dist/'));
    const engines = inputs.filter(file => /(?:[/\\](?:three|pixi3d|pixi\.js|@babylonjs)[/\\]|(?:three@|pixi3d@|pixi\.js@|@babylonjs\+core@))/.test(file));
    const graph = { mode, sourceFiles: sourceInputs.length, compiledFiles: compiledInputs.length,
      ownInputs: ownInputs.map(file => relative(root, file)), targetEngineInputs: engines,
      publishedResolutions: published?.resolutions ?? [],
      resolution: mode === 'source' ? 'Standard current package development exports; no resolver plugin' :
        'Existing workspace checkpoint resolver of actual publishConfig.exports.import only' };
    await save(output, mode + '-source-graph.json', graph);
    await save(output, mode + '-metafile.json', bundle.metafile);
    assert.equal(engines.length, 0, 'Uniform CPU entry imported a target engine');
    assert.equal(mode === 'source' ? compiledInputs.length : sourceInputs.length, 0);
    assert.ok(ownInputs.some(file => file.endsWith(mode === 'source' ?
      '/src/native-uniform-curve.ts' : '/dist/native-uniform-curve.js')));
    stage = 'actual-CPU-flow';
    const stdout = execFileSync(process.execPath, ['--input-type=module'], {
      input: bundle.outputFiles[0].text, encoding: 'utf8', cwd: root, maxBuffer: 16 * 1024 * 1024,
    });
    await writeFile(resolve(output, mode + '-flow.stdout'), stdout);
    const flow = JSON.parse(stdout);
    await save(output, mode + '-flow.json', flow);
    assert.equal(flow.ok, true);
    let types;
    if (mode === 'compiled') {
      stage = 'actual-published-types';
      types = checkPublishedTypes();
      await save(output, 'compiled-published-types.json', types);
      assert.equal(types.diagnostics.length, 0, 'Public emitted type checkpoint has diagnostics');
      assert.equal(types.ownSourceFallbacks.length, 0, 'Emitted type checkpoint used own source');
      assert.ok(types.ownDeclarationFiles.includes('packages/barocss-cad-interop/dist/native-uniform-curve.d.ts'));
      assert.ok(types.ownDeclarationFiles.some(file => file.startsWith('packages/barocss-cad/dist/')));
    }
    const summary = { issue: 1078, mode, ok: true, node: process.version,
      sourceFiles: sourceInputs.length, compiledFiles: compiledInputs.length,
      targetEngineImports: 0, pinCount: flow.pins.length, acceptedCases: flow.accepted.length,
      refusals: flow.refusals.length, getterCalls: flow.getterCalls,
      nativeDataRetained: flow.originalSourceAndNativeRetainedAcrossRefusal,
      ...(types ? { typeDiagnostics: types.diagnostics.length,
        emittedOwnDeclarations: types.ownDeclarationFiles.length, emittedTypeSourceFallbacks: 0 } : {}),
      context: 'Four opaque unchanged JSON files; section builder/validator not invoked',
      independentPackedOrRegistryProof: false, browserOrRendererProof: false };
    await save(output, mode + '-summary.json', summary);
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  } catch (error) {
    await save(output, mode + '-failure.json', { issue: 1078, mode, ok: false, stage,
      error: error.stack || String(error),
      ...(error.stderr ? { subprocessStderr: error.stderr.toString() } : {}),
      ...(error.stdout ? { subprocessStdout: error.stdout.toString() } : {}) });
    console.error(error.stack || String(error));
    process.exitCode = 1;
    return { issue: 1078, mode, ok: false, stage };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 4 && args[0] === '--mode' && args[2] === '--output',
    'Usage: node native-uniform-curve-source-verify.mjs --mode source|compiled --output EVIDENCE_DIR');
  await runUniformCurveSourceCheckpoint(args[1], resolve(args[3]));
}
