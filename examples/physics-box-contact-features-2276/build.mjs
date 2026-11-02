import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const home = dirname(fileURLToPath(import.meta.url)), root = resolve(home, '../..');
const id = process.argv[2];
if (!/^[a-z0-9-]+$/.test(id ?? '')) throw Error('fresh build ID required');
const out = resolve(home, 'evidence', id), strict = resolve(out, 'strict');
mkdirSync(resolve(home, 'evidence'), { recursive: true });
mkdirSync(out); mkdirSync(strict);
const pin = path => { const bytes = readFileSync(path); return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; };
const sources = Object.fromEntries(['candidate.ts', 'cases.json', 'CONTRACT.md', 'AMENDMENT-01.md', 'reference.py', 'tsconfig.json', 'package.json', 'build.mjs', 'run.mjs'].map(name => [name, pin(resolve(home, name))]));
writeFileSync(resolve(out, 'source-pins.json'), JSON.stringify(sources, null, 2) + '\n', { flag: 'wx' });
const bank = JSON.parse(readFileSync(resolve(home, 'cases.json')));
for (const [path, expected] of Object.entries(bank.pins)) {
  if (JSON.stringify(pin(resolve(root, path))) !== JSON.stringify(expected)) throw Error('SAVED_INPUT_PIN_DRIFT:' + path);
}
const bundled = await build({ entryPoints: [resolve(home, 'candidate.ts')], outfile: resolve(out, 'source.mjs'), bundle: true,
  platform: 'node', format: 'esm', target: 'node22', metafile: true, logLevel: 'silent' });
writeFileSync(resolve(out, 'source-metafile.json'), JSON.stringify(bundled.metafile, null, 2) + '\n', { flag: 'wx' });
const command = [resolve(root, 'node_modules/typescript/bin/tsc'), '--project', resolve(home, 'tsconfig.json'), '--outDir', strict];
const compiled = spawnSync(process.execPath, command, { cwd: root, encoding: 'utf8', timeout: 150000 });
writeFileSync(resolve(out, 'strict-stdout.txt'), compiled.stdout ?? '', { flag: 'wx' });
writeFileSync(resolve(out, 'strict-stderr.txt'), compiled.stderr ?? '', { flag: 'wx' });
if (compiled.error || compiled.status !== 0) {
  writeFileSync(resolve(out, 'result.json'), JSON.stringify({ status: 'BUILD_NO_GO', exitCode: compiled.status, error: compiled.error?.message }, null, 2) + '\n', { flag: 'wx' });
  process.exitCode = 1;
} else {
  writeFileSync(resolve(out, 'result.json'), JSON.stringify({ status: 'PASS_PRIVATE_BUILD', sources,
    outputs: { source: pin(resolve(out, 'source.mjs')), strict: pin(resolve(strict, 'candidate.js')) },
    WorldCalls: 0, candidateCalls: 0, scope: 'private Source bundle and strict NodeNext emit only' }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'PASS_PRIVATE_BUILD', out }));
}
