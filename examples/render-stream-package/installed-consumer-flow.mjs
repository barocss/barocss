import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const packageDir = path.join(repo, 'packages/barocss-render-stream');
const requestedOut = process.env.RESULT_ROOT
  ? path.resolve(process.env.RESULT_ROOT)
  : await fs.mkdtemp(path.join(os.tmpdir(), 'render-stream-installed-'));
assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Use Node 22 or newer');
await fs.mkdir(requestedOut, { recursive: true });
const out = await fs.realpath(requestedOut);
assert.ok(path.relative(repo, out).startsWith('..'), 'Result directory must be outside the repository');
const packDir = path.join(out, 'pack');
const consumerDir = path.join(out, 'consumer');
await fs.mkdir(packDir, { recursive: true });
await fs.mkdir(consumerDir, { recursive: true });
const pnpm = process.env.PNPM_BIN ?? 'pnpm';

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}
async function sha256(file) {
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}
async function copyIfPresent(source, target) {
  try { await fs.cp(source, target, { recursive: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function packedTarball(dir, prefix) {
  run(pnpm, ['pack', '--pack-destination', packDir, '--json'], dir);
  const names = (await fs.readdir(packDir)).filter((name) => name.startsWith(prefix) && name.endsWith('.tgz'));
  assert.equal(names.length, 1, `Expected one packed ${prefix} tarball`);
  return path.join(packDir, names[0]);
}

// These three existing emitted outputs are an explicit local dependency lease.
// Pack their tracked publish manifests and emitted files without editing their packages.
async function packDependency(folder, tarballPrefix, transform = (manifest) => manifest) {
  const source = path.join(repo, 'packages', folder);
  const stage = path.join(out, 'staging', folder);
  await fs.mkdir(stage, { recursive: true });
  const manifest = transform(JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8')));
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify(manifest, null, 2));
  await fs.cp(path.join(source, 'dist'), path.join(stage, 'dist'), { recursive: true });
  await copyIfPresent(path.join(source, 'README.md'), path.join(stage, 'README.md'));
  await copyIfPresent(path.join(source, 'LICENSE'), path.join(stage, 'LICENSE'));
  const tarball = await packedTarball(stage, tarballPrefix);
  return { name: manifest.name, version: manifest.version, tarball, sha256: await sha256(tarball) };
}

run(process.execPath, [path.join(packageDir, 'build.mjs')], repo);
const kit = await packDependency('barocss', 'barocss-kit-');
const render = await packDependency('barocss-render', 'barocss-render-');
const server = await packDependency('barocss-server', 'barocss-server-', (manifest) => {
  assert.equal(manifest.dependencies['@barocss/kit'], 'workspace:*');
  manifest.dependencies['@barocss/kit'] = kit.version;
  return manifest;
});

// pnpm resolves workspace:* when these package-local links point to the matching clean packages.
const linksDir = path.join(packageDir, 'node_modules/@barocss');
const created = [];
let streamTarball;
await fs.mkdir(linksDir, { recursive: true });
try {
  for (const [name, folder] of [['render', 'barocss-render'], ['server', 'barocss-server']]) {
    const link = path.join(linksDir, name);
    const target = path.join(repo, 'packages', folder);
    try { assert.equal(await fs.realpath(link), target); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.symlink(target, link, 'dir');
      created.push(link);
    }
  }
  streamTarball = await packedTarball(packageDir, 'barocss-render-stream-');
} finally {
  for (const link of created) await fs.unlink(link);
}
const stream = { name: '@barocss/render-stream', version: '0.12.0', tarball: streamTarball,
  sha256: await sha256(streamTarball) };

const consumerManifest = {
  name: 'render-stream-installed-consumer', private: true, type: 'module',
  dependencies: {
    '@barocss/kit': `file:${kit.tarball}`,
    '@barocss/render': `file:${render.tarball}`,
    '@barocss/server': `file:${server.tarball}`,
    '@barocss/render-stream': `file:${stream.tarball}`,
    react: '19.2.3', jsdom: '26.1.0',
  },
  devDependencies: { typescript: '5.9.3', '@types/react': '19.2.14' },
  pnpm: { overrides: {
    '@barocss/kit': `file:${kit.tarball}`,
    '@barocss/render': `file:${render.tarball}`,
    '@barocss/server': `file:${server.tarball}`,
  } },
};
await fs.writeFile(path.join(consumerDir, 'package.json'), JSON.stringify(consumerManifest, null, 2));
run(pnpm, ['install', '--offline', '--ignore-scripts', '--reporter', 'append-only'], consumerDir);
const installed = await fs.realpath(path.join(consumerDir, 'node_modules/@barocss/render-stream'));
assert.ok(installed.startsWith(path.join(consumerDir, 'node_modules/.pnpm/')),
  'Stream must resolve inside the outside-workspace consumer store');
const installedDependencies = {
  render: await fs.realpath(path.join(path.dirname(installed), 'render')),
  server: await fs.realpath(path.join(path.dirname(installed), 'server')),
};
installedDependencies.kit = await fs.realpath(path.join(path.dirname(installedDependencies.server), 'kit'));
for (const [name, resolved] of Object.entries(installedDependencies)) {
  assert.ok(resolved.includes(`@barocss+${name}@file+`), `${name} must resolve from its local tarball`);
}

const consumerSource = String.raw`
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCompiler, createCompiledResponse, createJsonlDecoder, encodeRecord } from '@barocss/render-stream';
import { PROTOCOL_VERSION } from '@barocss/render-stream/protocol';
import { createCompiler as serverImport } from '@barocss/render-stream/server';
import { createCompiledResponse as fetchImport } from '@barocss/render-stream/fetch';

assert.equal(PROTOCOL_VERSION, 1);
assert.equal(typeof serverImport, 'function');
assert.equal(typeof fetchImport, 'function');
const identity = { streamId: 'installed-consumer', revision: 1 };
const contract = { textBindings: [], actions: [] };
let seq = 0;
const record = (type, fields = {}) => ({ version: 1, ...identity, seq: ++seq, type, ...fields });
const records = [
  record('root', { id: 'root' }),
  record('node', { id: 'root', node: { type: 'Layout', props: { id: 'root', columns: 'single', gap: 'fractional' }, children: ['title'] } }),
  record('node', { id: 'title', node: { type: 'Text', props: { id: 'title', text: 'Installed package' }, children: [] } }),
  record('checkpoint'), record('commit'),
];
const input = Buffer.concat(records.map((value) => Buffer.from(encodeRecord(value))));
const seenInput = [];
const inputDecoder = createJsonlDecoder({ identity, onRecord: (value) => seenInput.push(value) });
inputDecoder.push(input);
assert.equal(inputDecoder.finish().records, 5);
const compiler = serverImport({ identity, contract });
for (const value of seenInput) compiler.accept(value);
assert.equal(compiler.finish().final, true);

let admissions = 0;
const response = fetchImport({ identity, contract,
  source: async function* () { yield input; },
  acceptFinal() { admissions++; return true; },
});
const chunks = [];
const snapshots = [];
const outputDecoder = createJsonlDecoder({ identity, kind: 'output', onRecord: (value) => snapshots.push(value) });
for await (const chunk of response.body) { chunks.push(Buffer.from(chunk)); outputDecoder.push(chunk); }
assert.equal(outputDecoder.finish().records, 2);
assert.equal(snapshots.at(-1).phase, 'committed');
assert.equal(admissions, 1);

const bad = Buffer.from(JSON.stringify(records[0]).replace('"streamId":"installed-consumer"',
  '"streamId":"other","streamId":"installed-consumer"') + '\n');
const badDecoder = createJsonlDecoder({ identity, onRecord() { throw new Error('Invalid input delivered'); } });
assert.throws(() => badDecoder.push(bad), /Duplicate JSON member/);
let badAdmissions = 0;
const badResponse = createCompiledResponse({ identity, contract,
  source: async function* () { yield bad; },
  acceptFinal() { badAdmissions++; return true; },
});
await assert.rejects(badResponse.text(), /Duplicate JSON member/);
assert.equal(badAdmissions, 0);
const hash = (value) => createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({ status: 'passed', inputRecords: seenInput.length,
  outputSnapshots: snapshots.length, finalAdmissions: admissions, invalidAdmissions: badAdmissions,
  inputSha256: hash(input), outputSha256: hash(Buffer.concat(chunks)), modelCalls: 0 }));
`;
await fs.writeFile(path.join(consumerDir, 'consume.mjs'), consumerSource);
const result = JSON.parse(run(process.execPath, ['consume.mjs'], consumerDir));

const typeSource = `import { createCompiledResponse, type InputRecord, type StreamIdentity } from '@barocss/render-stream';\nimport type { JsonlDecoder } from '@barocss/render-stream/protocol';\nconst identity: StreamIdentity = { streamId: 'typed', revision: 1 };\nconst root: InputRecord = { version: 1, ...identity, seq: 1, type: 'root', id: 'root' };\nconst decoder: JsonlDecoder | null = null;\nvoid [root, decoder, createCompiledResponse];\n`;
await fs.writeFile(path.join(consumerDir, 'types.ts'), typeSource);
run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--skipLibCheck', 'types.ts'], consumerDir);

const report = { ...result, node: process.version, parent: run('git', ['rev-parse', 'HEAD'], repo),
  consumer: consumerDir, installed, installedDependencies, packages: [kit, render, server, stream],
  emittedStream: {
    jsSha256: await sha256(path.join(packageDir, 'dist/index.js')),
    declarationSha256: await sha256(path.join(packageDir, 'dist/index.d.ts')),
  },
  dependencyLease: {
    kitJsSha256: await sha256(path.join(repo, 'packages/barocss/dist/index.js')),
    renderJsSha256: await sha256(path.join(repo, 'packages/barocss-render/dist/index.js')),
    serverJsSha256: await sha256(path.join(repo, 'packages/barocss-server/dist/index.es.js')),
  },
};
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: result.status, report: path.join(out, 'report.json'),
  snapshots: result.outputSnapshots, admissions: result.finalAdmissions, invalidAdmissions: result.invalidAdmissions }));
