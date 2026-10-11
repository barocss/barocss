import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readlink, symlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultApp = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function bundleGeneratedScene(app = defaultApp, platform = 'browser', consumerText, consumerName = 'generated-scene') {
  if (!/^[a-z][a-z0-9-]{0,47}$/.test(consumerName)) throw Error('Invalid generated scene consumer name');
  const root = resolve(app, '../..');
  const profile = JSON.parse(await readFile(resolve(app, 'scripts/profiles/gpu-generated-scene-v0.json'), 'utf8'));
  const snapshot = resolve(app, 'docs/.vitepress/cache/generated-scene', profile.sourcePin);
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  if (git(['rev-parse', '--show-object-format']).toString().trim() !== 'sha1') throw Error('Unexpected Git format');
  const hash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const actual = Object.fromEntries(git(['ls-tree', '-r', '-z', profile.sourcePin, '--', ...profile.sourcePaths])
    .toString().split('\0').filter(Boolean).map(record => {
      const [info, path] = record.split('\t'), [mode, kind, oid] = info.split(' ');
      if (kind !== 'blob' || !['100644', '100755'].includes(mode)) throw Error('Unsupported source blob');
      return [path, oid];
    }));
  if (JSON.stringify(actual) !== JSON.stringify(profile.files)) throw Error('Generated scene source profile mismatch');
  for (const [path, oid] of Object.entries(profile.files)) {
    const destination = resolve(snapshot, path);
    let bytes;
    try { bytes = await readFile(destination); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      bytes = git(['show', `${profile.sourcePin}:${path}`]);
      if (hash(bytes) !== oid) throw Error(`Source mismatch: ${path}`);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
    if (hash(bytes) !== oid) throw Error(`Cached source mismatch: ${path}`);
  }
  const namespace = resolve(snapshot, 'node_modules/@barocss');
  await mkdir(namespace, { recursive: true });
  for (const name of profile.packages) {
    const link = resolve(namespace, name), target = resolve(snapshot, `packages/barocss-${name}`);
    try { await symlink(relative(namespace, target), link, 'dir'); }
    catch (error) {
      if (error.code !== 'EEXIST' || resolve(namespace, await readlink(link)) !== target) throw error;
    }
  }
  const presets = consumerText === undefined ? { 'generated-scene': JSON.parse(await readFile(resolve(app, 'scripts/snippets/generated-scene.json'), 'utf8')) } : {};
  const host = consumerText === undefined ? await readFile(resolve(app, 'scripts/snippets/generated-scene-host.mjs'), 'utf8') : '';
  const text = consumerText ?? `${host}\nexport const presets = ${JSON.stringify(presets)};\n`;
  const consumers = resolve(snapshot, 'consumers');
  await mkdir(consumers, { recursive: true });
  const entry = resolve(consumers, platform === 'browser' ? 'generated-scene-entry.mjs' : `${consumerName}-check.mjs`);
  await writeFile(entry, text);
  const result = await build({ absWorkingDir: snapshot, entryPoints: [entry], bundle: true,
    platform, format: 'esm', target: platform === 'node' ? 'node22' : 'es2022', write: false, metafile: true });
  const ownInputs = Object.keys(result.metafile.inputs).filter(path => path.startsWith('packages/'));
  for (const path of ownInputs) {
    if (!profile.files[path] || path.includes('/dist/') || hash(await readFile(resolve(snapshot, path))) !== profile.files[path]) throw Error(`Unpinned generated scene input: ${path}`);
  }
  const unexpected = Object.keys(result.metafile.inputs).filter(path => !path.startsWith('packages/') && path !== relative(snapshot, entry));
  if (!ownInputs.length || unexpected.length) throw Error(`Unexpected generated scene closure: ${unexpected.join(', ')}`);
  const provenance = { sourcePin: profile.sourcePin, verifiedBlobs: Object.keys(profile.files).length,
    ownSourceInputs: ownInputs.length, ownDistInputs: 0, host: platform === 'browser' ? 'Application Canvas2D diagnostic local boxes from public compiled Scene2; no GL' : 'Public generated Scene2 compiler consumer; no GL',
    oldVisualPinUnchanged: '5f5ad866205a21510ac69552e704cc162fa253b5' };
  await writeFile(resolve(consumers, platform === 'browser' ? 'browser-metafile.json' : `${consumerName}-node-metafile.json`), JSON.stringify(result.metafile, null, 2) + '\n');
  return { result, provenance };
}
export async function buildGeneratedScene(app = defaultApp) {
  const { result, provenance } = await bundleGeneratedScene(app);
  const output = resolve(app, 'docs/.vitepress/generated');
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'generated-scene.js'), result.outputFiles[0].contents);
  console.log(JSON.stringify({ generatedScene: provenance, bundleBytes: result.outputFiles[0].contents.length }));
  return provenance;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildGeneratedScene();
