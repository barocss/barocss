import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { ownedPackages } from './owned-packages.mjs';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function bundleLab({ tests = false, write = false } = {}) {
  execFileSync(process.execPath, [resolve(root, 'packages/barocss-physics/src/generate-provider.mjs')], { cwd: root, timeout: 15000, stdio: 'pipe' });
  const result = await build({ absWorkingDir: root, entryPoints: [resolve(here, tests ? 'session.test.mjs' : 'app.mjs')],
    bundle: true, write: false, format: 'esm', platform: tests ? 'node' : 'browser', target: 'es2022',
    metafile: true, sourcemap: false, plugins: [ownedPackages(root)] });
  const inputs = {};
  for (const path of Object.keys(result.metafile.inputs)) {
    const canonical = await realpath(resolve(root, path));
    if (!canonical.startsWith(root + '/')) throw new Error(`Bundle input escaped owned checkout: ${canonical}`);
    const bytes = await readFile(canonical); inputs[path] = { bytes: bytes.length, sha256: sha(bytes) };
  }
  const output = result.outputFiles[0].contents;
  if (output.length > 24 * 1024 * 1024) throw new Error('Lab bundle exceeded24MiB');
  if (write) {
    const directory = resolve(here, 'output/build'); await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, tests ? 'session.test.mjs' : 'app.mjs'), output);
    await writeFile(resolve(directory, tests ? 'test-inputs.json' : 'app-inputs.json'), JSON.stringify({ inputs, bundleBytes: output.length, bundleSHA256: sha(output) }, null, 2) + '\n');
  }
  return { bytes: output, inputs };
}
export async function startLab(port = 0) {
  const bundle = await bundleLab({ write: true });
  const staticFiles = new Map([
    ['/', ['text/html; charset=utf-8', await readFile(resolve(here, 'index.html'))]],
    ['/app.mjs', ['text/javascript; charset=utf-8', bundle.bytes]],
    ['/style.css', ['text/css; charset=utf-8', await readFile(resolve(here, 'style.css'))]],
    ['/reference.json', ['application/json; charset=utf-8', await readFile(resolve(here, 'reference.json'))]],
    ['/favicon.svg', ['image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#255aeb"/><path d="M10 12h11a6 6 0 0 1 0 12H10V12m0 12h13a5 5 0 0 1 0 10H10" fill="none" stroke="white" stroke-width="3" transform="translate(0 -4)"/></svg>')]],
  ]);
  const server = createServer((req, res) => {
    const entry = staticFiles.get(new URL(req.url, 'http://127.0.0.1').pathname);
    if (req.method !== 'GET' || !entry) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'content-type': entry[0], 'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(entry[1]);
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); });
  return { server, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok, fail) => server.close(e => e ? fail(e) : ok())) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--test-build')) await bundleLab({ tests: true, write: true });
  else if (process.argv.includes('--build')) await bundleLab({ write: true });
  else {
    const port = Number(process.env.PHYSICS_LAB_PORT ?? 52889);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PHYSICS_LAB_PORT must be0..65535');
    const running = await startLab(port); console.log(`Physics Lab: ${running.url}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await running.close(); process.exit(0); });
  }
}
