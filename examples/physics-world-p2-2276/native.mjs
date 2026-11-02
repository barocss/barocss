// Native installed-artifact proof. No package install, bundling, network or publication.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const id = process.argv[2];
if (!/^[a-z0-9-]+$/.test(id ?? '') || process.argv.length !== 3 || !process.versions.node.startsWith('22.')) {
  throw Error('Use Node22 native.mjs <fresh-id>');
}
const dir = join(here, 'evidence', id), stage = join(dir, 'stage');
if (existsSync(dir)) throw Error('receipt already exists');
mkdirSync(stage, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const deadline = Date.now() + 180000, commands = [], artifacts = [];
let fatal = null;
const gates = Object.fromEntries(['published-map', 'retired-files', 'shared-registry-imports', 'native-types',
  'native-negative-types', 'native-runtime', 'cad-release-runtime', 'readme-types',
  ...Array.from({ length: 4 }, (_, i) => `readme-runtime-${i}`)].map(key => [key, 'NOT_RUN']));
function receipt() {
  writeFileSync(join(dir, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  writeFileSync(join(dir, 'result.json'), JSON.stringify({ utc: new Date().toISOString(),
    result: Object.values(gates).every(status => status === 'PASS') ? 'PASS' : 'FAIL', gates,
    firstFailure: commands.find(item => item.exit !== 0) ?? fatal,
    installedArtifacts: artifacts.length, publication: false, network: false, timeoutMs: 180000 }, null, 2) + '\n');
}
function run(label, args) {
  const command = [process.execPath, ...args];
  const result = spawnSync(process.execPath, args, { cwd: stage, encoding: 'utf8',
    timeout: Math.max(1, deadline - Date.now()), maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(dir, label + '.stdout.txt'), result.stdout ?? '');
  writeFileSync(join(dir, label + '.stderr.txt'), result.stderr ?? '');
  commands.push({ label, command, cwd: stage, exit: result.status, signal: result.signal,
    error: result.error?.message ?? null });
  gates[label] = result.status === 0 && !result.error ? 'PASS' : 'FAIL'; receipt();
  if (gates[label] === 'FAIL') throw Error(`${label} failed`);
}
function inventory(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) inventory(file);
    else artifacts.push({ path: relative(stage, file), sha256: hash(readFileSync(file)) });
  }
}
try {
  for (const name of ['physics', 'cad']) {
    const source = join(root, 'packages', `barocss-${name}`), target = join(stage, 'node_modules/@barocss', name);
    mkdirSync(target, { recursive: true });
    const manifest = JSON.parse(readFileSync(join(source, 'package.json')));
    for (const key of ['main', 'types', 'exports']) {
      assert.ok(manifest.publishConfig[key], `${name} lacks published ${key}`);
      manifest[key] = manifest.publishConfig[key];
    }
    writeFileSync(join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    cpSync(join(source, 'dist'), join(target, 'dist'), { recursive: true });
  }
  gates['published-map'] = 'PASS';
  const physicsDist = join(stage, 'node_modules/@barocss/physics/dist');
  for (const name of ['replay-scene', 'replay-session', 'replay-types']) {
    for (const extension of ['.js', '.d.ts']) assert.equal(existsSync(join(physicsDist, name + extension)), false, `retired ${name + extension} remains`);
  }
  gates['retired-files'] = 'PASS';
  for (const entry of ['index.js', 'replay.js']) {
    assert.match(readFileSync(join(physicsDist, entry), 'utf8'), /from\s*["']\.\/recording-owner\.js["']/, `${entry} must use sibling registry`);
  }
  gates['shared-registry-imports'] = 'PASS';
  for (const name of ['native.mjs', 'native-consumer.mts', 'native-negative.mts']) cpSync(join(here, name), join(stage, name));
  cpSync(join(root, 'examples/physics-scene/release-consumer.mjs'), join(stage, 'cad-release-consumer.mjs'));
  cpSync(join(root, 'examples/physics-cad-scene/two-surfaces.barocad'), join(stage, 'two-surfaces.barocad'));
  const readme = readFileSync(join(root, 'packages/barocss-physics/README.md'), 'utf8');
  const blocks = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map(match => match[1]);
  assert.equal(blocks.length, 4, 'README TypeScript block count changed');
  blocks.forEach((contents, index) => writeFileSync(join(stage, `readme-${index}.mts`), contents));
  writeFileSync(join(stage, 'README-input.md'), readme);
  const base = { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', strict: true,
    skipLibCheck: false, types: [] };
  writeFileSync(join(stage, 'tsconfig.json'), JSON.stringify({ compilerOptions: { ...base, outDir: 'compiled' }, files: ['native-consumer.mts'] }));
  writeFileSync(join(stage, 'negative-tsconfig.json'), JSON.stringify({ compilerOptions: { ...base, noEmit: true }, files: ['native-negative.mts'] }));
  writeFileSync(join(stage, 'readme-tsconfig.json'), JSON.stringify({ compilerOptions: { ...base, outDir: 'compiled-readme' }, files: blocks.map((_, i) => `readme-${i}.mts`) }));
  inventory(stage);
  artifacts.sort((a, b) => a.path.localeCompare(b.path));
  writeFileSync(join(dir, 'artifact-hashes.json'), JSON.stringify(artifacts, null, 2) + '\n');
  const tsc = join(root, 'node_modules/typescript/bin/tsc');
  writeFileSync(join(dir, 'compiler-hash.json'), JSON.stringify({ path: tsc, sha256: hash(readFileSync(tsc)) }, null, 2) + '\n');
  run('native-types', [tsc, '-p', 'tsconfig.json']);
  run('native-negative-types', [tsc, '-p', 'negative-tsconfig.json']);
  run('native-runtime', ['compiled/native-consumer.mjs']);
  run('cad-release-runtime', ['cad-release-consumer.mjs']);
  run('readme-types', [tsc, '-p', 'readme-tsconfig.json']);
  for (let i = 0; i < blocks.length; i++) run(`readme-runtime-${i}`, [`compiled-readme/readme-${i}.mjs`]);
  receipt();
} catch (error) {
  fatal = { message: error.message ?? String(error), stack: error.stack ?? null };
  writeFileSync(join(dir, 'fatal.stderr.txt'), error.stack ?? String(error));
  receipt(); process.exitCode = 1;
}
console.log(JSON.stringify({ gates, publication: false, installedArtifacts: artifacts.length }));
