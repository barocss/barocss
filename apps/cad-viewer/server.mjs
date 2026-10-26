import { createServer } from 'node:http';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (directory, path) => {
  const child = relative(directory, path);
  return child === '' || (!isAbsolute(child) && child !== '..' && !child.startsWith('../'));
};
const packages = new Map();
for (const name of await readdir(resolve(root, 'packages'))) {
  const directory = resolve(root, 'packages', name);
  try {
    const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
    if (manifest.name?.startsWith('@barocss/')) packages.set(manifest.name, { directory, manifest });
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
  }
}
const publicEntries = new Map();
const sourceResolver = { name: 'cad-viewer-own-public-source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    const parts = path.split('/'), name = parts.slice(0, 2).join('/');
    const item = packages.get(name);
    const subpath = parts.length === 2 ? '.' : './' + parts.slice(2).join('/');
    const entry = item?.manifest.exports?.[subpath];
    const target = typeof entry === 'string' ? entry : entry?.import;
    if (typeof target !== 'string' || !target.startsWith('./src/'))
      throw new Error('Missing own public source entry: ' + path);
    const absolutePath = await realpath(resolve(item.directory, target));
    if (!within(resolve(item.directory, 'src'), absolutePath))
      throw new Error('Public source entry leaves this clone: ' + path);
    publicEntries.set(path, { specifier: path, packageName: name, target, absolutePath });
    return { path: absolutePath };
  });
} };

// Reuse the existing root esbuild tool. Do not read package source through its node_modules links.
const bundle = await build({ absWorkingDir: root, entryPoints: [resolve(directory, 'src/main.tsx')],
  bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', target: 'es2022',
  jsx: 'automatic', alias: { '@': resolve(directory, 'src') },
  define: { 'process.env.NODE_ENV': '"development"' }, plugins: [sourceResolver] });
const inputs = await Promise.all(Object.keys(bundle.metafile.inputs).map(async input => {
  const path = resolve(root, input), absolutePath = await realpath(path), bytes = await readFile(absolutePath);
  const owner = [...packages.values()].find(item => within(item.directory, absolutePath));
  const ownKind = owner && within(resolve(owner.directory, 'src'), absolutePath) ? 'source'
    : owner && within(resolve(owner.directory, 'dist'), absolutePath) ? 'dist' : null;
  if (owner && ownKind !== 'source') throw new Error('Own package input leaves source: ' + absolutePath);
  // Symlinked workspace packages must never introduce source from another checkout.
  if (!owner && /(?:^|\/)packages\/barocss-[^/]+\/(?:src|dist)\//.test(absolutePath))
    throw new Error('Foreign own package input: ' + absolutePath);
  return { path: relative(root, path), absolutePath, packageName: owner?.manifest.name ?? null,
    ownKind, bytes: bytes.length, sha256: sha(bytes) };
}));
const ownSource = inputs.filter(input => input.ownKind === 'source').map(input => input.absolutePath);
const ownDist = inputs.filter(input => input.ownKind === 'dist').map(input => input.absolutePath);
if (ownSource.length === 0 || ownDist.length !== 0) throw new Error('Expected own source inputs only.');
const html = await readFile(resolve(directory, 'index.html'));
async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.[jt]sx?$/.test(entry.name)) files.push(path);
  }
  return files;
}
const cssEntry = resolve(directory, 'tailwind.css');
const cssDependencies = new Set([cssEntry]);
const compiler = await compile(await readFile(cssEntry, 'utf8'), {
  base: directory, from: cssEntry, onDependency: path => cssDependencies.add(path),
});
// Scan actual local content with Tailwind's scanner. No app class list is hand-maintained.
const candidateFiles = [...new Set([
  resolve(directory, 'index.html'), ...await sourceFiles(resolve(directory, 'src')),
  ...inputs.filter(input => within(directory, input.absolutePath)).map(input => input.absolutePath),
])].sort();
const candidates = new Scanner({}).scanFiles(await Promise.all(candidateFiles.map(async file => ({
  content: await readFile(file, 'utf8'), extension: extname(file).slice(1),
}))));
if (candidates.length === 0) throw new Error('Tailwind did not find any local class candidates.');
const compiledCSS = compiler.build(candidates);
if (!compiledCSS.includes('.bg-primary {') || !compiledCSS.includes('.fixed {'))
  throw new Error('Tailwind did not emit the required Button and Dialog utilities.');
const css = Buffer.from(compiledCSS);
const cssInputs = await Promise.all([...new Set([...cssDependencies, ...candidateFiles])].sort().map(async path => {
  const absolutePath = await realpath(path), bytes = await readFile(absolutePath);
  return { path: relative(root, path), absolutePath, role: extname(path) === '.css' ? 'stylesheet' : 'candidate-source',
    bytes: bytes.length, sha256: sha(bytes) };
}));
const sample = await readFile(resolve(root, 'packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json'));
const audit = { mode: 'source-react-shadcn-app', bundleSHA256: sha(bundle.outputFiles[0].contents), inputs,
  ownSourceCount: ownSource.length, ownDistCount: ownDist.length, ownSource, ownDist,
  htmlSHA256: sha(html), cssSHA256: sha(css), sampleSHA256: sha(sample),
  cssEntry: relative(root, cssEntry), cssInputs, cssCandidateCount: candidates.length,
  publicEntries: [...publicEntries.values()] };
const files = new Map([
  ['/', ['text/html; charset=utf-8', html]],
  ['/index.html', ['text/html; charset=utf-8', html]],
  ['/styles.css', ['text/css; charset=utf-8', css]],
  ['/bundle.js', ['text/javascript; charset=utf-8', bundle.outputFiles[0].contents]],
  ['/sample.cad-document.json', ['application/json; charset=utf-8', sample]],
  ['/input-audit.json', ['application/json; charset=utf-8', JSON.stringify(audit, null, 2)]],
]);
const port = Number(process.env.CAD_VIEWER_PORT ?? 53032);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('CAD_VIEWER_PORT must be 1 to 65535.');
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (path === '/favicon.ico') { response.writeHead(204).end(); return; }
  const file = files.get(path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': file[0], 'cache-control': 'no-store' }).end(file[1]);
});
const buildSummary = { url: 'http://127.0.0.1:' + port, mode: audit.mode,
    bundleSHA256: audit.bundleSHA256, inputs: inputs.length,
    ownSourceCount: ownSource.length, ownDistCount: ownDist.length,
    htmlSHA256: audit.htmlSHA256, cssSHA256: audit.cssSHA256,
    cssInputs: cssInputs.length, cssCandidateCount: candidates.length };
if (process.argv.includes('--check')) console.log(JSON.stringify({ ...buildSummary, listening: false }));
else server.listen(port, '127.0.0.1', () => console.log(JSON.stringify(buildSummary)));
