import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const publicRoot = path.resolve(process.env.PUBLIC_DEPS_ROOT ?? repo);
const depsRoot = path.resolve(process.env.PACKAGE_DEPS_ROOT ?? repo);
const stage = path.join(here, '.build');
const modules = path.join(stage, 'node_modules');
const provenance = {};
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
await fs.rm(stage, { recursive: true, force: true });
await fs.mkdir(modules, { recursive: true });
for (const [name, folder, root] of [
  ['ui-compiler', 'barocss-ui-compiler', repo],
  ['render', 'barocss-render', publicRoot],
  ['server', 'barocss-server', publicRoot],
  ['kit', 'barocss', publicRoot],
]) {
  const source = path.join(root, 'packages', folder);
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
  const published = { ...manifest, ...manifest.publishConfig };
  delete published.publishConfig;
  const target = path.join(modules, '@barocss', name);
  await fs.mkdir(target, { recursive: true });
  await fs.cp(path.join(source, 'dist'), path.join(target, 'dist'), { recursive: true });
  await fs.writeFile(path.join(target, 'package.json'), JSON.stringify(published, null, 2));
  const entry = published.exports['.'].import;
  const filename = typeof entry === 'string' ? entry : entry.default;
  provenance[`@barocss/${name}`] = { version: manifest.version, entry: filename,
    sha256: sha(await fs.readFile(path.join(target, filename))) };
}
for (const name of ['esbuild', 'typescript', 'react', 'react-dom'])
  await fs.symlink(path.join(depsRoot, 'node_modules', name), path.join(modules, name));
for (const [name, files] of [
  ['react', ['cjs/react.production.js', 'cjs/react-jsx-runtime.production.js']],
  ['react-dom', ['cjs/react-dom-client.production.js']],
]) {
  const root = path.join(depsRoot, 'node_modules', name);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  provenance[name] = { version: manifest.version, files: {} };
  for (const filename of files)
    provenance[name].files[filename] = sha(await fs.readFile(path.join(root, filename)));
}
await fs.writeFile(path.join(stage, 'provenance.json'), JSON.stringify(provenance, null, 2));
await fs.copyFile(path.join(here, 'consumer.mjs'), path.join(stage, 'consumer.mjs'));
const { compileUi } = await import('./.build/consumer.mjs');
if (typeof compileUi !== 'function') throw new Error('Emitted compiler import failed');
console.log(JSON.stringify({ stage, provenance }));
