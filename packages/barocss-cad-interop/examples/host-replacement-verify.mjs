import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Use Node22 for this source verifier');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const bundle = await build({ entryPoints: [resolve(here, 'host-replacement-checkpoint.mjs')], absWorkingDir: root,
  bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
const sourceCounts = Object.fromEntries(['cad', 'cad-interop'].map(name => [name,
  inputs.filter(path => path.startsWith(resolve(root, `packages/barocss-${name}/src`) + '/')).length]));
const compiled = inputs.filter(path => path.startsWith(resolve(root, 'packages') + '/') && path.includes('/dist/'));
for (const count of Object.values(sourceCounts)) assert.ok(count > 0);
assert.equal(compiled.length, 0);
console.log(JSON.stringify({ stage: 'public-source-transform', node: process.version, sourceCounts, ownCompiledFiles: compiled.length,
  ownSourceInputs: inputs.filter(path => path.startsWith(resolve(root, 'packages') + '/') && path.includes('/src/')).map(path => relative(root, path)) }));
const port = 5196;
const child = spawn(process.execPath, [resolve(here, 'host-replacement-server.mjs'), '--port', String(port)],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stderr.on('data', chunk => process.stderr.write(chunk));
try {
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error('Saved HTTP/Vite server did not become ready')), 20000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited before readiness: ${code}`)); });
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.split('\n').some(line => { try { return JSON.parse(line).ready === true; } catch { return false; } })) {
        clearTimeout(timeout); resolveReady();
      }
    });
  });
  const health = await fetch(`http://127.0.0.1:${port}/__loader991/health`).then(response => response.json());
  assert.equal(health.ready, true);
  execFileSync(process.execPath, ['--input-type=module'], { cwd: root, input: bundle.outputFiles[0].text,
    env: { ...process.env, LOADER991_BASE_URL: `http://127.0.0.1:${port}` }, stdio: ['pipe', 'inherit', 'inherit'] });
} finally {
  if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
}
