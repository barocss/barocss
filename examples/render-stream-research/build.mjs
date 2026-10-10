import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const destination = path.join(here, '.build');
const hashes = {};
for (const [name, folder] of [['render', 'barocss-render'], ['kit', 'barocss'], ['server', 'barocss-server']]) {
  const source = path.join(repo, 'packages', folder);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
  const published = { ...manifest, ...manifest.publishConfig };
  delete published.publishConfig;
  const target = path.join(destination, 'node_modules', '@barocss', name);
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(path.join(source, 'dist'), path.join(target, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(published, null, 2));
  const entry = published.exports['.'].import;
  const filename = typeof entry === 'string' ? entry : entry.default;
  if (!filename.startsWith('./dist/')) throw new Error('Expected actual compiled public export');
  hashes[name] = { version: manifest.version, entry: filename,
    sha256: createHash('sha256').update(fs.readFileSync(path.join(target, filename))).digest('hex') };
}
fs.writeFileSync(path.join(destination, 'render-api.mjs'), 'export { Renderer, validateSpec, classesFor, getRenderSpecDefinition } from "@barocss/render";\n');
fs.writeFileSync(path.join(destination, 'server-api.mjs'), 'export { ServerRuntime, ssrStyleTag } from "@barocss/server";\n');
fs.writeFileSync(path.join(destination, 'provenance.json'), JSON.stringify(hashes, null, 2));
// Native imports resolve actual published manifests and emitted files. No source fallback.
await import('./.build/render-api.mjs');
const { ServerRuntime } = await import('./.build/server-api.mjs');
if (!new ServerRuntime().generateCss('grid gap-2.5').includes('display: grid')) throw new Error('Compiled server API unavailable');
console.log(JSON.stringify({ status: 'ready', compiled: hashes }));
