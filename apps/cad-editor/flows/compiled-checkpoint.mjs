import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const NATIVE_ENTRIES = [
  ['barocss-cad', '.'],
  ['barocss-gpu', '.'],
  ['barocss-gpu', './source'],
  ['barocss-viewer', '.'],
  ['barocss-cad-interop', './native'],
  ['barocss-cad-interop', './document'],
  ['barocss-cad-interop', './model-set'],
];
const EDITOR_ENTRIES = ['.', './react', './styles.css'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const publicName = (name, subpath) => subpath === '.' ? name : name + subpath.slice(1);

function within(root, path) {
  const result = relative(root, path);
  return result === '' || !isAbsolute(result) && result !== '..' && !result.startsWith('..' + sep);
}

function targetPath(root, target) {
  if (typeof target !== 'string' || !target.startsWith('./')) throw new Error('An explicit relative export target is required.');
  const result = resolve(root, target);
  if (!within(root, result)) throw new Error('Export target escapes its package: ' + target);
  return result;
}

async function filesIn(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await filesIn(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}

/** Build the selected fixed native closure for one focused compiled editor checkpoint.
 * No provider scripts, install, pack, archive or source-runtime fallback are used.
 */
export async function prepareCompiledCheckpoint({ repo, evidence }) {
  repo = resolve(repo);
  evidence = resolve(evidence);
  const installed = createRequire(resolve(repo, 'package.json'));
  const esbuild = installed('esbuild');
  const ts = installed('typescript');
  const evidenceRoot = resolve(evidence, 'compiled-sdk');
  await mkdir(evidenceRoot, { recursive: true });
  // A retry keeps the first compiler diagnostics and artifacts intact.
  const checkpoint = await mkdtemp(resolve(evidenceRoot, 'checkpoint-'));
  const runtimeMap = {}, typesMap = {}, sourceMap = {};
  const manifests = new Map();
  const selected = [];
  const sourceFiles = new Set();
  const outputFiles = new Set();
  const externals = new Set();
  const receipt = {
    schema: 'cad-editor-focused-compiled-checkpoint', version: 0,
    repo, checkpoint,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    sourceRuntimeFallback: false,
    tooling: { esbuild: esbuild.version, typescript: ts.version },
    selectedExports: [], sources: [], outputs: [],
    limits: 'Selected CAD/GPU/Viewer/interop entries and already built editor public targets only. No publication or packed-consumer claim.',
  };
  const manifestFor = async directory => {
    if (manifests.has(directory)) return manifests.get(directory);
    const path = resolve(repo, 'packages', directory, 'package.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    if (!manifest.publishConfig?.exports) throw new Error('Missing compiled public exports: ' + directory);
    sourceFiles.add(path);
    manifests.set(directory, manifest);
    return manifest;
  };

  try {
  for (const [directory, subpath] of NATIVE_ENTRIES) {
    const manifest = await manifestFor(directory);
    const sourceExport = manifest.exports?.[subpath];
    const compiledExport = manifest.publishConfig.exports[subpath];
    if (typeof sourceExport?.import !== 'string' || typeof compiledExport?.import !== 'string'
      || typeof compiledExport?.types !== 'string') throw new Error('Incomplete native public map: ' + directory + subpath);
    const specifier = publicName(manifest.name, subpath);
    const source = targetPath(resolve(repo, 'packages', directory), sourceExport.import);
    const runtime = targetPath(resolve(checkpoint, directory), compiledExport.import);
    const declaration = targetPath(resolve(checkpoint, directory), compiledExport.types);
    runtimeMap[specifier] = runtime;
    typesMap[specifier] = declaration;
    sourceMap[specifier] = source;
    selected.push({ directory, source, runtime, declaration });
    receipt.selectedExports.push({ package: manifest.name, subpath, specifier,
      sourceExport, compiledExport, publishConfig: manifest.publishConfig });
  }

  const editor = await manifestFor('barocss-cad-editor');
  for (const subpath of EDITOR_ENTRIES) {
    const published = editor.publishConfig.exports[subpath];
    const specifier = publicName(editor.name, subpath);
    const runtimeTarget = typeof published === 'string' ? published : published?.import;
    const runtime = targetPath(resolve(repo, 'packages/barocss-cad-editor'), runtimeTarget);
    if (!within(resolve(repo, 'packages/barocss-cad-editor/dist'), runtime))
      throw new Error('Editor compiled target must be inside its existing dist: ' + specifier);
    await access(runtime);
    runtimeMap[specifier] = runtime;
    outputFiles.add(runtime);
    if (typeof published !== 'string') {
      const declaration = targetPath(resolve(repo, 'packages/barocss-cad-editor'), published.types);
      if (!within(resolve(repo, 'packages/barocss-cad-editor/dist'), declaration))
        throw new Error('Editor declaration target must be inside its existing dist: ' + specifier);
      await access(declaration);
      typesMap[specifier] = declaration;
      outputFiles.add(declaration);
    }
    receipt.selectedExports.push({ package: editor.name, subpath, specifier,
      sourceExport: editor.exports[subpath], compiledExport: published, publishConfig: editor.publishConfig });
  }

    // Public entry files also depend on owned shared JS chunks and relative declarations.
    for (const path of await filesIn(resolve(repo, 'packages/barocss-cad-editor/dist')))
      if (/\.(?:js|d\.ts|css)$/.test(path)) outputFiles.add(path);
    const bundled = new Set();
    for (const entry of selected) {
      if (bundled.has(entry.runtime)) continue;
      bundled.add(entry.runtime);
      await mkdir(dirname(entry.runtime), { recursive: true });
      const result = await esbuild.build({
        absWorkingDir: repo, entryPoints: [entry.source], outfile: entry.runtime,
        bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
        external: ['@barocss/*'], metafile: true, logLevel: 'silent',
      });
      outputFiles.add(entry.runtime);
      for (const input of Object.keys(result.metafile.inputs)) sourceFiles.add(resolve(repo, input));
      for (const output of Object.values(result.metafile.outputs))
        for (const imported of output.imports) if (imported.external) externals.add(imported.path);
      await writeFile(entry.runtime + '.metafile.json', JSON.stringify(result.metafile, null, 2) + '\n');
    }
    for (const specifier of externals) {
      if (!Object.hasOwn(runtimeMap, specifier)) throw new Error('Compiled native external has no explicit runtime map: ' + specifier);
    }

    const packageRoot = resolve(repo, 'packages');
    const temporaryDeclarations = resolve(checkpoint, 'declaration-layout');
    const options = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      rootDir: packageRoot, outDir: temporaryDeclarations,
      noEmit: false, declaration: true, emitDeclarationOnly: true,
      noEmitOnError: true, skipLibCheck: true, strict: true,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], types: [],
      baseUrl: repo, paths: Object.fromEntries(Object.entries(sourceMap).map(([name, path]) => [name, [path]])),
    };
    const program = ts.createProgram([...new Set(selected.map(entry => entry.source))], options);
    const diagnosticText = diagnostics => ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => repo, getCanonicalFileName: file => file, getNewLine: () => '\n',
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    await writeFile(resolve(checkpoint, 'native-declaration-diagnostics.txt'), diagnosticText(diagnostics));
    if (diagnostics.length) throw new Error('Native declaration program refused. See ' + resolve(checkpoint, 'native-declaration-diagnostics.txt'));
    const emittedDeclarations = new Map();
    const emitted = program.emit(undefined, (filename, text) => {
      const layout = relative(temporaryDeclarations, filename).split(sep);
      if (layout.length < 3 || layout[1] !== 'src' || !within(temporaryDeclarations, filename))
        throw new Error('Unexpected native declaration output layout: ' + filename);
      const destination = resolve(checkpoint, layout[0], 'dist', ...layout.slice(2));
      emittedDeclarations.set(destination, text);
    }, undefined, true);
    if (emitted.emitSkipped || emitted.diagnostics.length) {
      await writeFile(resolve(checkpoint, 'native-declaration-emit-diagnostics.txt'), diagnosticText(emitted.diagnostics));
      throw new Error('Native declaration emission refused.');
    }
    for (const [destination, text] of emittedDeclarations) {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, text);
      outputFiles.add(destination);
    }
    for (const source of program.getSourceFiles())
      if (!source.isDeclarationFile && within(packageRoot, source.fileName)) sourceFiles.add(resolve(source.fileName));
    for (const path of Object.values(typesMap)) await access(path);
    for (const directory of new Set(selected.map(entry => entry.directory)))
      await writeFile(resolve(checkpoint, directory, 'package.json'), JSON.stringify({ type: 'module' }) + '\n');

    // Hash the actual owned source inputs for the already built editor targets.
    const editorConfig = ts.getParsedCommandLineOfConfigFile(resolve(repo, 'packages/barocss-cad-editor/tsconfig.json'), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(diagnosticText([diagnostic])); },
    });
    if (!editorConfig) throw new Error('Cannot read owned editor source configuration.');
    for (const path of editorConfig.fileNames)
      if (within(resolve(repo, 'packages/barocss-cad-editor/src'), path)) sourceFiles.add(path);
    sourceFiles.add(resolve(repo, 'packages/barocss-cad-editor/src/styles.css'));

    const consumerPath = resolve(checkpoint, 'published-consumer.tsx');
    await writeFile(consumerPath, `import { createCadEditorSession, type CadEditorCandidate } from '@barocss/cad-editor';
import { CadEditor, type CadEditorProps } from '@barocss/cad-editor/react';
import { parseCadDocument } from '@barocss/cad';
const session = createCadEditorSession(parseCadDocument('{}').document);
const props: CadEditorProps = { session, displayOptions: { viewer: {mmToSceneUnit:0.01,background:[0.07,0.08,0.10]}, document: {basis:'authored-xyz-matches-rhyup',native:{sourceVersion:0,countU:17,countV:17,unitsPerMillimeter:1,curveDisplay:{chordToleranceMM:0.1,maxSegments:64,maxDepth:8}},bodyIds:['surface_body','curve_body']} }, onDisplay: receipt => {const index:number = receipt.readIndex; const hash:string = receipt.pixelHash;}, onAccepted: accepted => {const generation:number=accepted.generation;} };
const element = <CadEditor {...props}/>;
const candidate: CadEditorCandidate | null = session.prepareApply();
const decision = session.requestSelection({bodyId:'surface_body',uIndex:1,vIndex:1});
if (decision) session.resolveSelectionTransition(decision.token, 'cancel');
const selectedBody:string|null = session.getSnapshot().selectedBodyId;
`);
    const consumerProgram = ts.createProgram([consumerPath], {
      target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
      jsx:ts.JsxEmit.ReactJSX,noEmit:true,strict:true,skipLibCheck:false,types:[],
      baseUrl:repo,paths:{...Object.fromEntries(Object.entries(typesMap).map(([name,path])=>[name,[path]])),
        react:[resolve(repo,'node_modules/@types/react/index.d.ts')],
        'react/jsx-runtime':[resolve(repo,'node_modules/@types/react/jsx-runtime.d.ts')]},
    });
    const consumerDiagnostics = ts.getPreEmitDiagnostics(consumerProgram);
    await writeFile(resolve(checkpoint,'published-consumer-diagnostics.txt'),diagnosticText(consumerDiagnostics));
    if(consumerDiagnostics.length) throw new Error('Published declaration consumer refused. See '+resolve(checkpoint,'published-consumer-diagnostics.txt'));
    receipt.publishedDeclarationConsumer = {status:'passed',source:consumerPath,sourceRuntimeFallback:false};
    const loaderPath = resolve(checkpoint, 'runtime-loader.mjs');
    const loader = `import { pathToFileURL } from 'node:url';
const map = ${JSON.stringify(runtimeMap, null, 2)};
export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(map, specifier)) return { url: pathToFileURL(map[specifier]).href, shortCircuit: true };
  if (specifier.startsWith('@barocss/')) throw new Error('No compiled public runtime map for ' + specifier);
  if (/\\.(?:ts|tsx)(?:[?#]|$)/.test(specifier)) throw new Error('Source runtime fallback refused: ' + specifier);
  const resolved = await nextResolve(specifier, context);
  if (resolved.url.startsWith('file:') && /\\.(?:ts|tsx)(?:[?#]|$)/.test(resolved.url))
    throw new Error('Source runtime resolution refused: ' + resolved.url);
  return resolved;
}
`;
    await writeFile(loaderPath, loader);
    const runtimeMapPath = resolve(checkpoint, 'runtime-map.json');
    await writeFile(runtimeMapPath, JSON.stringify(runtimeMap, null, 2) + '\n');
    outputFiles.add(loaderPath);
    receipt.externalImports = [...externals].sort();
    receipt.runtimeMap = runtimeMap;
    receipt.typesMap = typesMap;
    receipt.declarationOptions = options;
    receipt.status = 'prepared-not-consumer-executed';
    for (const path of [...sourceFiles].sort()) receipt.sources.push({ path: relative(repo, path), sha256: hash(await readFile(path)) });
    for (const path of [...outputFiles].sort()) receipt.outputs.push({ path, sha256: hash(await readFile(path)) });
    await writeFile(resolve(checkpoint, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    return { runtimeMap, runtimeMapPath, typesMap, loaderPath,
      nativeCadPath: runtimeMap['@barocss/cad'], editorRootPath: runtimeMap['@barocss/cad-editor'] };
  } catch (error) {
    receipt.status = 'preparation-failed';
    receipt.failure = { message: error instanceof Error ? error.message : String(error),
      errors: error?.errors, warnings: error?.warnings };
    await writeFile(resolve(checkpoint, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    throw error;
  }
}
