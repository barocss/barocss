// Build-time only. No file I/O or Node dependency reaches the numerical root.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const emitted = process.argv.includes('--emitted');
const root = resolve(packageRoot, emitted ? 'dist' : 'src');
const extension = emitted ? '.js' : '.ts';
const excluded = `provider-manifest.generated${extension}`;
const seen = new Map();
async function visit(path) {
  const name = relative(root, path).split('\\').join('/');
  if (name === excluded || seen.has(name)) return;
  if (name.startsWith('../')) throw new Error(`provider escapes package graph: ${name}`);
  const bytes = await readFile(path);
  seen.set(name, createHash('sha256').update(bytes).digest('hex'));
  const source = bytes.toString('utf8');
  // Runtime local dependencies only. Type imports are absent from emitted JS;
  // source manifests include declarations because admission is part of that graph.
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    let target = resolve(dirname(path), specifier);
    if (!emitted && extname(target) === '.js') target = target.slice(0,-3) + '.ts';
    await visit(target);
  }
}
await visit(resolve(root, `index${extension}`));
await visit(resolve(root, `replay${extension}`));
const manifest = { format: 'barocss-physics-provider', version: 1, graph: emitted ? 'emitted' : 'source',
  entries: [`index${extension}`, `replay${extension}`], files: Object.fromEntries([...seen].sort(([a],[b])=>a<b?-1:a>b?1:0)) };
const manifestPath = resolve(root, excluded);
const contents = `// Generated from the actual ${manifest.graph} provider graph. Do not edit.\nexport const providerManifest = ${JSON.stringify(manifest,null,2)}${emitted?'':' as const'};\n`;
let previous;
try { previous = await readFile(manifestPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (previous !== contents) await writeFile(manifestPath, contents);
console.log(`${manifest.graph} Physics provider: ${seen.size} files`);
