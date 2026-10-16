import { build } from 'esbuild';
import ts from 'typescript';
import { mkdir, readFile, readlink, symlink, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const root = resolve(app, '../..');
// The commit whose package sources the examples bundle: the WebGPU viewer core (@barocss/gpu/viewer,
// the async @barocss/viewer). A workspace that matches it bundles in place; otherwise its Git snapshot.
export const pin = 'c79d752cb3463a34e6c93cb64e3693bc493c271f';
// cad-editor and render-editor are retired (folded into apps/cad-studio) and canvas2d was
// deleted; none of them is part of the pinned package list.
const names = ['gpu', 'cad', 'cad-interop', 'viewer', 'physics'];
const sourcePaths = names.flatMap(name => [`packages/barocss-${name}/package.json`, `packages/barocss-${name}/src`]);
const cache = resolve(app, 'docs/.vitepress/cache/source-pin');
const snapshot = resolve(cache, pin);
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const within = (parent, file) => file.startsWith(parent + sep);
const blobHash = (bytes, algorithm) => createHash(algorithm).update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

function pinnedFiles() {
  const files = new Map();
  for (const record of git(['ls-tree', '-r', '-z', pin, '--', ...sourcePaths]).toString().split('\0').filter(Boolean)) {
    const [info, path] = record.split('\t');
    const [mode, kind, oid] = info.split(' ');
    if (kind !== 'blob' || !['100644', '100755'].includes(mode)) throw new Error(`Unsupported pinned source file: ${path}`);
    files.set(path, oid);
  }
  for (const name of names) {
    if (!files.has(`packages/barocss-${name}/package.json`) || !files.has(`packages/barocss-${name}/src/index.ts`)) {
      throw new Error(`Pinned package is incomplete: @barocss/${name}`);
    }
  }
  return files;
}
async function validateFiles(project, files, algorithm) {
  for (const [path, oid] of files) {
    const bytes = await readFile(resolve(project, path));
    if (blobHash(bytes, algorithm) !== oid) throw new Error(`Pinned source content mismatch: ${path}`);
  }
}
async function linkPackages(project, namespace) {
  await mkdir(namespace, { recursive: true });
  for (const name of names) {
    const target = resolve(project, `packages/barocss-${name}`), link = resolve(namespace, name);
    try { await symlink(relative(namespace, target), link, 'dir'); }
    catch (error) {
      if (error.code !== 'EEXIST' || resolve(namespace, await readlink(link)) !== target) throw error;
    }
  }
}
async function materialize(files, algorithm) {
  await mkdir(cache, { recursive: true });
  try { await readFile(resolve(snapshot, '.source-pin.json')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const staging = await mkdtemp(resolve(cache, `${pin}-staging-`));
    try {
      const archive = git(['archive', '--format=tar', pin, ...sourcePaths]);
      execFileSync('tar', ['-x', '-f', '-', '-C', staging], { input: archive, maxBuffer: 64 * 1024 * 1024 });
      await validateFiles(staging, files, algorithm);
      await writeFile(resolve(staging, '.source-pin.json'), JSON.stringify({ sourcePin: pin, files: files.size, packages: names }, null, 2) + '\n');
      try { await rename(staging, snapshot); }
      catch (error) { if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error; }
    } finally { await rm(staging, { recursive: true, force: true }); }
  }
  const marker = JSON.parse(await readFile(resolve(snapshot, '.source-pin.json'), 'utf8'));
  if (marker.sourcePin !== pin || marker.files !== files.size) throw new Error('Pinned source cache metadata mismatch');
  // Check actual Git blob content on reuse too. A modified cache is refused, not silently used.
  await validateFiles(snapshot, files, algorithm);
  await linkPackages(snapshot, resolve(snapshot, 'node_modules/@barocss'));
  return snapshot;
}
function checkStandalone(entry, text) {
  const ast = ts.createSourceFile(entry, text, ts.ScriptTarget.Latest, true);
  function check(specifier) {
    if (!specifier || !ts.isStringLiteralLike(specifier)) {
      throw new Error('Pinned snapshot fallback requires literal bare imports in a standalone consumer');
    }
    if (specifier.text.startsWith('.') || specifier.text.startsWith('/') || specifier.text.startsWith('file:') || /^[A-Za-z]:[\\/]/.test(specifier.text)) {
      throw new Error(`Pinned snapshot fallback cannot preserve consumer-relative import ${specifier.text}; use a standalone consumer with public bare package imports`);
    }
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) check(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) check(node.moduleReference.expression);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) check(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

export async function bundleExample(entry, platform = 'browser') {
  entry = resolve(entry);
  const files = pinnedFiles();
  const algorithm = git(['rev-parse', '--show-object-format']).toString().trim();
  const forced = process.env.BAROCSS_DOCS_FORCE_SOURCE_PIN === '1';
  const changed = git(['diff', pin, '--', ...sourcePaths]).length !== 0;
  let project = root, selectedEntry = entry, mode = 'matching-workspace';
  if (forced || changed) {
    const text = await readFile(entry, 'utf8');
    checkStandalone(entry, text);
    project = await materialize(files, algorithm);
    mode = 'pinned-git-snapshot';
    const consumers = resolve(project, 'consumers');
    await mkdir(consumers, { recursive: true });
    const digest = createHash('sha256').update(entry).update('\0').update(text).digest('hex').slice(0, 20);
    selectedEntry = resolve(consumers, `${digest}-${basename(entry)}`);
    await writeFile(selectedEntry, text);
  } else {
    // Existing extraction/public-API tools retain their workspace package links.
    await linkPackages(root, resolve(app, 'scripts/snippets/node_modules/@barocss'));
  }
  const result = await build({
    absWorkingDir: project, entryPoints: [selectedEntry], bundle: true,
    nodePaths: mode === 'pinned-git-snapshot' ? [resolve(project, 'node_modules'), resolve(root, 'node_modules')] : [resolve(app, 'scripts/snippets/node_modules')],
    platform, format: 'esm', write: false, metafile: true, target: platform === 'node' ? 'node22' : 'es2022',
  });
  const inputs = Object.keys(result.metafile.inputs).filter(path => path.includes('packages/barocss-'));
  if (!inputs.length) throw new Error('Example did not consume own pinned source');
  for (const path of inputs) {
    const absolute = resolve(project, path), ownPath = relative(project, absolute).split(sep).join('/');
    if (!within(resolve(project, 'packages'), absolute) || path.includes('/dist/') || !files.has(ownPath)) {
      throw new Error(`Example requires only pinned own source: ${path}`);
    }
    if (blobHash(await readFile(absolute), algorithm) !== files.get(ownPath)) {
      throw new Error(`Example input differs from pinned Git blob: ${ownPath}`);
    }
  }
  return { result, inputs, provenance: {
    sourcePin: pin, sourceMode: mode, forcedSnapshot: forced,
    sourceRoot: relative(root, project) || '.', consumerOriginal: relative(root, entry),
    manifestCount: names.length, pinnedFiles: files.size,
    ownSourceInputs: inputs.length, ownDistInputs: 0,
    validation: mode === 'pinned-git-snapshot' ? 'all materialized manifest/src Git blobs and consumed inputs matched' : 'matching manifest/src Git diff and consumed Git blobs matched',
  } };
}
