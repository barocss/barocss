import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const require = createRequire(path.join(repo, 'package.json'));
const { build } = require('esbuild');
const output = path.join(here, '.build');
const packages = [
  ['kit', 'barocss'], ['server', 'barocss-server'],
  ['render', 'barocss-render'], ['render-stream', 'barocss-render-stream'],
];
const provenance = {};

for (const [name, folder] of packages) {
  const source = path.join(repo, 'packages', folder);
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
  const published = { ...manifest, ...manifest.publishConfig };
  delete published.publishConfig;
  const target = path.join(output, 'node_modules', '@barocss', name);
  await fs.mkdir(target, { recursive: true });
  await fs.cp(path.join(source, 'dist'), path.join(target, 'dist'), { recursive: true });
  await fs.writeFile(path.join(target, 'package.json'), JSON.stringify(published, null, 2));
  const entry = published.exports['.'].import;
  const filename = typeof entry === 'string' ? entry : entry.default;
  if (!filename.startsWith('./dist/')) throw new Error(`Expected compiled public export for ${name}`);
  provenance[name] = { version: manifest.version, entry: filename,
    sha256: createHash('sha256').update(await fs.readFile(path.join(target, filename))).digest('hex') };
}

try { await fs.symlink('.build/node_modules', path.join(here, 'node_modules')); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
await build({ entryPoints: [path.join(here, 'browser.mjs')], outfile: path.join(output, 'app.js'),
  bundle: true, platform: 'browser', format: 'iife', target: 'es2022' });
await fs.writeFile(path.join(output, 'provenance.json'), JSON.stringify(provenance, null, 2));
const { createCompiledResponse } = await import('@barocss/render-stream/fetch');
if (typeof createCompiledResponse !== 'function') throw new Error('Public stream export unavailable');
console.log(JSON.stringify({ status: 'staged', provenance }));
