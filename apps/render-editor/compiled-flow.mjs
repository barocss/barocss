import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Explicit published-map checkpoint only. Development uses ordinary source imports.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'package.json'));
const families = ['cad', 'gpu', 'render-editor'].map((name) => ({ name: `@barocss/${name}`, directory: resolve(root, 'packages', `barocss-${name}`) }));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--output') throw new Error('Usage: node apps/render-editor/compiled-flow.mjs --output <new-evidence-directory>');
const output = resolve(args[1]);
await mkdir(dirname(output), { recursive: true });
// Exclusive creation preserves every previous receipt, including failed runs.
await mkdir(output);
const receipt = { issue: 1047, mode: 'explicit-published-maps', startedAt: new Date().toISOString(), status: 'running',
  scope: 'Fresh CAD/GPU/editor builds; compiled root/React/declarations/CSS only. No tarball, registry, viewport, or disk authoring flow.',
  node: process.version, builds: [], manifests: [], resolutions: [], runtimeGraphs: [], stages: [] };
let stage = 'environment';
const save = async () => writeFile(resolve(output, 'compiled-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
const command = async (label, executable, commandArgs, cwd = root) => {
  const started = performance.now();
  const result = spawnSync(executable, commandArgs, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, PATH: `${dirname(process.execPath)}${sep === '/' ? ':' : ';'}${process.env.PATH ?? ''}` } });
  await writeFile(resolve(output, `${label}.stdout.log`), result.stdout ?? '');
  await writeFile(resolve(output, `${label}.stderr.log`), result.stderr ?? '');
  const details = { label, executable, args: commandArgs, cwd, exitCode: result.status, signal: result.signal,
    elapsedMs: performance.now() - started, stdout: `${label}.stdout.log`, stderr: `${label}.stderr.log`,
    ...(result.error ? { error: result.error.message } : {}) };
  receipt.stages.push(details);
  await save();
  if (result.error || result.status !== 0) throw new Error(`${label} failed: ${result.error?.message ?? `exit ${result.status}, signal ${result.signal ?? 'none'}`}. See saved stdout/stderr.`);
  return { ...details, stdoutText: result.stdout ?? '' };
};
const leaves = (value) => {
  if (typeof value === 'string') return [value];
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 'Unsupported published export map value');
  return Object.values(value).flatMap(leaves);
};
const importTarget = (value) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    for (const condition of Object.keys(value)) {
      if (['import', 'node', 'default'].includes(condition)) return importTarget(value[condition]);
    }
  }
  throw new Error('Published export has no Node ESM import target');
};
const ownFamily = (path) => families.find((family) => path.startsWith(`${family.directory}/`)
  || path.includes(`/node_modules/${family.name}/`));

try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Run this checkpoint with installed Node 22');
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  assert.equal(git.status, 0, 'Cannot record native Git HEAD');
  receipt.head = git.stdout.trim();
  receipt.gitStatus = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  await save();
  for (const family of families) {
    stage = `build ${family.name}`;
    const result = await command(`build-${family.name.split('/')[1]}`, 'pnpm', ['--filter', family.name, 'build:library']);
    const { stdoutText, ...details } = result;
    receipt.builds.push({ package: family.name, ...details });
  }

  stage = 'complete published manifests';
  const published = new Map();
  for (const family of families) {
    const manifest = JSON.parse(await readFile(resolve(family.directory, 'package.json'), 'utf8'));
    assert.equal(manifest.name, family.name);
    assert.equal(manifest.type, 'module');
    assert.equal(manifest.private, false);
    const config = manifest.publishConfig;
    assert(config && config.main && config.types && config.exports, `${family.name} must have complete published main/types/exports`);
    assert.equal(config.access, 'public');
    const targets = [...new Set([config.main, config.types, ...leaves(config.exports)])];
    const artifacts = [];
    for (const target of targets) {
      assert(target.startsWith('./dist/') && !target.includes('..', 2), `${family.name} published target is outside dist: ${target}`);
      const path = resolve(family.directory, target), info = await stat(path);
      assert(info.isFile() && info.size > 0, `${family.name} missing or empty published artifact ${target}`);
      artifacts.push({ target, bytes: info.size, modifiedAt: info.mtime.toISOString() });
    }
    assert.equal(config.main, importTarget(config.exports['.']));
    assert.equal(config.types, config.exports['.'].types);
    receipt.manifests.push({ name: manifest.name, version: manifest.version, type: manifest.type, private: manifest.private,
      sourceMain: manifest.main, sourceTypes: manifest.types, sourceExports: manifest.exports, publishConfig: config,
      dependencies: manifest.dependencies ?? {}, peerDependencies: manifest.peerDependencies ?? {}, artifacts });
    published.set(family.name, { ...family, manifest, config });
  }
  const editor = published.get('@barocss/render-editor');
  assert.equal(editor.manifest.version, '0.0.0-experimental');
  assert(editor.config.exports['./react'].types && importTarget(editor.config.exports['./react']).endsWith('.js'));
  assert.equal(editor.config.exports['./style.css'], './dist/style.css');
  const rootArtifact = await readFile(resolve(editor.directory, editor.config.main), 'utf8');
  assert(/(?:from\s*|import\s*)["']@barocss\/gpu["']/.test(rootArtifact), 'Compiled editor root must retain its external public GPU dependency');
  assert(!/(?:from\s*|import\s*)["']react(?:\/[^"']*)?["']/.test(rootArtifact), 'Compiled pure root must not import React');
  receipt.externalGpuDependencyPreserved = true;

  stage = 'compiled mirror';
  const nodeModules = resolve(output, 'node_modules');
  await mkdir(resolve(nodeModules, '@barocss'), { recursive: true });
  await mkdir(resolve(nodeModules, '@types'), { recursive: true });
  for (const family of published.values()) {
    const directory = resolve(nodeModules, family.name);
    await mkdir(directory);
    // Only the published manifest and dist exist in each package mirror.
    const manifest = { ...family.manifest, main: family.config.main, types: family.config.types, exports: family.config.exports };
    await writeFile(resolve(directory, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    await symlink(resolve(family.directory, 'dist'), resolve(directory, 'dist'), 'dir');
  }
  const dependencies = ['react', '@types/react', 'typescript', 'csstype'];
  receipt.installedDependencies = [];
  for (const name of dependencies) {
    const manifestPath = require.resolve(`${name}/package.json`), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await symlink(dirname(manifestPath), resolve(nodeModules, name), 'dir');
    receipt.installedDependencies.push({ name, version: manifest.version, path: dirname(manifestPath) });
  }
  await writeFile(resolve(output, 'package.json'), JSON.stringify({ private: true, type: 'module' }) + '\n');
  const resolver = { name: 'render-editor-explicit-published-map', setup(builder) {
    builder.onResolve({ filter: /^@barocss\// }, (args) => {
      const name = args.path.split('/').slice(0, 2).join('/'), family = published.get(name);
      assert(family, `Unexpected own package outside the three-package checkpoint: ${args.path}`);
      const suffix = args.path.slice(name.length), key = suffix ? `.${suffix}` : '.';
      const target = importTarget(family.config.exports[key]);
      assert(target.startsWith('./dist/') && target.endsWith('.js'), `${args.path} must resolve through published dist JS`);
      const path = resolve(family.directory, target);
      receipt.resolutions.push({ specifier: args.path, importer: relative(root, args.importer), exportKey: key, target: relative(root, path) });
      return { path };
    });
  } };
  stage = 'compiled root and React runtime graph';
  const paths = {};
  for (const [name, specifier] of [['root', '@barocss/render-editor'], ['react', '@barocss/render-editor/react']]) {
    const path = resolve(output, `${name}-consumer.mjs`);
    const result = await build({ absWorkingDir: root, stdin: { contents: `export * from '${specifier}';`,
      resolveDir: output, sourcefile: `${name}-compiled-entry.mjs` }, bundle: true, write: false, outfile: path,
      platform: 'node', format: 'esm', target: 'es2022', metafile: true, plugins: [resolver], external: ['react', 'react/*'] });
    const inputs = Object.keys(result.metafile.inputs).map((path) => resolve(root, path));
    const own = inputs.filter(ownFamily), source = own.filter((path) => path.includes('/src/'));
    assert.equal(source.length, 0, `${name} compiled graph reached own source`);
    assert(own.some((path) => path.startsWith(`${editor.directory}/dist/`)), `${name} missing compiled editor input`);
    assert(own.some((path) => path.startsWith(`${published.get('@barocss/gpu').directory}/dist/`)), `${name} missing transitive compiled GPU input`);
    receipt.runtimeGraphs.push({ entry: specifier, sourceInputs: source.length, compiledInputs: own.length,
      ownInputs: own.map((path) => relative(root, path)), externalImports: result.metafile.outputs[Object.keys(result.metafile.outputs)[0]].imports });
    await writeFile(path, result.outputFiles[0].text);
    await writeFile(resolve(output, `${name}-metafile.json`), JSON.stringify(result.metafile, null, 2) + '\n');
    paths[name] = path;
  }
  receipt.sourceInputs = receipt.runtimeGraphs.reduce((sum, graph) => sum + graph.sourceInputs, 0);
  const globals = new Map();
  let api;
  try {
    for (const key of ['window', 'document', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'addEventListener']) {
      globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(`Compiled pure root accessed ${key}`); } });
    }
    api = await import(pathToFileURL(paths.root).href);
  } finally {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
  const panels = await import(pathToFileURL(paths.react).href);
  const panelNames = ['RenderEditor', 'SourcePanel', 'ObjectPanel', 'CameraPanel', 'DiagnosticsPanel', 'SceneViewport'];
  for (const name of panelNames) assert.equal(typeof panels[name], 'function', `Missing compiled React export ${name}`);
  const source = `@scene compiled_scene { version: 1; background: #102030; sphere #orb; box #block; cylinder #post; }
#orb { radius: 0.7; translate: -1 0 0; }
#block { size: 1 1 1; translate: 1 0 0; }
#post { radius: 0.3; height: 1.2; translate: 0 1 0; }
`;
  const camera = { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: 0.01, far: 100 };
  const document = { format: 'barocss-render-editor', version: 0, kind: 'gpu-scene', documentId: 'compiled_scene',
    title: 'Compiled consumer', revision: 0, sourceVersion: 1, sceneSource: source, camera };
  const session = api.createRenderEditorSession(document);
  assert.deepEqual(session.getSnapshot().metadata.objects.map((object) => object.id), ['orb', 'block', 'post']);
  session.setDraftSource(source.replace('radius: 0.7', 'radius: 0.8'));
  session.commitPrepared(session.prepareDraft('source'));
  assert.equal(session.getSnapshot().accepted.revision, 1);
  assert.equal(api.parseRenderEditorDocument(api.serializeRenderEditorDocument(session.getSnapshot().accepted)).sceneSource,
    session.getSnapshot().accepted.sceneSource);
  session.dispose();
  receipt.runtime = { headlessRootImport: true, compiledGpuMetadata: true, objectIds: ['orb', 'block', 'post'],
    sourceApplyRevision: 1, reactExports: panelNames, reactMounted: false };

  stage = 'compiled CSS';
  const sourceCss = await readFile(resolve(editor.directory, 'src/style.css'));
  const compiledCss = await readFile(resolve(editor.directory, editor.config.exports['./style.css']));
  assert(sourceCss.equals(compiledCss), 'Explicit published CSS is not byte-equal to the authored CSS');
  receipt.css = { exportKey: './style.css', target: editor.config.exports['./style.css'], bytes: compiledCss.length,
    sha256: createHash('sha256').update(compiledCss).digest('hex'), byteEqual: true };

  stage = 'compiled declaration consumer';
  const typeConsumer = `import {createRenderEditorSession, createRenderEditorController, type RenderSceneDocumentV0, type RenderEditorSessionSnapshot} from '@barocss/render-editor';
import {RenderEditor, SourcePanel, type RenderEditorProps, type RenderEditorPanelProps} from '@barocss/render-editor/react';
import type {MeshCamera, SourceRange} from '@barocss/gpu';
import type {CadSourceRange} from '@barocss/cad';
import type {ComponentProps} from 'react';
const camera: MeshCamera = ${JSON.stringify(camera)};
const document: RenderSceneDocumentV0 = {format: 'barocss-render-editor', version: 0, kind: 'gpu-scene',
  documentId: 'compiled_scene', title: 'Compiled consumer', revision: 0, sourceVersion: 1,
  sceneSource: ${JSON.stringify(source)}, camera};
const session = createRenderEditorSession(document);
const snapshot: RenderEditorSessionSnapshot = session.getSnapshot();
const controller = createRenderEditorController(session);
const editorProps: RenderEditorProps = {controller, onAction(action) { const command: 'new'|'open'|'save' = action; void command; }};
const panelProps: RenderEditorPanelProps = {controller};
const inferred: ComponentProps<typeof RenderEditor> = editorProps;
const sourceProps: ComponentProps<typeof SourcePanel> = panelProps;
const range: SourceRange|null = snapshot.metadata.objects[0]?.range ?? null;
const cadRange: CadSourceRange|null = null;
void inferred; void sourceProps; void range; void cadRange;
controller.dispose(); session.dispose();
`;
  await writeFile(resolve(output, 'consumer.mts'), typeConsumer);
  const tsconfig = { compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
    noEmit: true, skipLibCheck: false, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['react'], preserveSymlinks: true }, files: ['./consumer.mts'] };
  // preserveSymlinks keeps dist links inside the package-mirror dependency graph.
  // It is not a paths alias or a source condition.
  await writeFile(resolve(output, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
  const typed = await command('declaration-consumer', process.execPath, [require.resolve('typescript/bin/tsc'),
    '-p', resolve(output, 'tsconfig.json'), '--noEmit', '--traceResolution', '--listFiles'], output);
  const declaredFiles = typed.stdoutText.split(/\r?\n/).filter((line) => line.startsWith('/') && /\.d\.(?:ts|mts|cts)$/.test(line));
  const ownDeclarations = declaredFiles.filter(ownFamily);
  const sourceDeclarations = ownDeclarations.filter((path) => path.includes('/src/'));
  assert.equal(sourceDeclarations.length, 0, 'Published declaration graph reached own source');
  for (const family of families) assert(ownDeclarations.some((path) => ownFamily(path)?.name === family.name), `Missing emitted ${family.name} declarations`);
  receipt.types = { noEmit: true, skipLibCheck: false, preserveSymlinks: true, sourceInputs: sourceDeclarations.length,
    compiledDeclarations: ownDeclarations.length, ownDeclarationFiles: ownDeclarations, trace: 'declaration-consumer.stdout.log' };
  receipt.status = 'passed';
} catch (error) {
  receipt.status = 'failed';
  receipt.firstFailure = { stage, message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null };
  await writeFile(resolve(output, 'first-failure.json'), JSON.stringify(receipt.firstFailure, null, 2) + '\n');
  process.exitCode = 1;
}
receipt.finishedAt = new Date().toISOString();
await save();
console.log(JSON.stringify({ status: receipt.status, head: receipt.head, output,
  ...(receipt.firstFailure ? { firstFailure: receipt.firstFailure } : { sourceInputs: receipt.sourceInputs, types: receipt.types.compiledDeclarations, cssBytes: receipt.css.bytes }) }));
