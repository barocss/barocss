import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, '../..');
export const names = ['cad', 'cad-interop', 'gpu', 'physics', 'viewer'];
export const families = names.map(name => ({ name: `@barocss/${name}`,
  directory: resolve(root, 'packages', `barocss-${name}`) }));

export function outputDirectory() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--output') {
    throw new Error('Usage: node <script>.mjs --output <evidence-directory>');
  }
  return resolve(args[1]);
}
export async function writeEvidence(directory, filename, value) {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, filename), `${JSON.stringify(value, null, 2)}\n`);
}
export function inputProof(metafile, mode) {
  const inputs = Object.keys(metafile.inputs).map(path => resolve(root, path));
  const own = inputs.filter(path => families.some(family => path.startsWith(`${family.directory}/`)));
  const source = own.filter(path => path.includes('/src/'));
  const compiled = own.filter(path => path.includes('/dist/'));
  assert.ok(own.length > 0, 'No own package inputs were bundled');
  assert.equal(mode === 'source' ? compiled.length : source.length, 0,
    `Unexpected own ${mode === 'source' ? 'dist' : 'src'} input`);
  const directory = mode === 'source' ? 'src' : 'dist';
  const familyInputs = Object.fromEntries(families.map(family => {
    const found = own.filter(path => path.startsWith(`${family.directory}/${directory}/`));
    assert.ok(found.length > 0, `${family.name} has no ${directory} inputs`);
    return [family.name, found.length];
  }));
  return { mode, sourceFiles: source.length, compiledFiles: compiled.length,
    familyInputs, ownInputs: own.map(path => relative(root, path)) };
}

// This resolver is used only for the compiled checkpoint. Source development uses no plugin.
export async function publishedResolver() {
  const packages = new Map(await Promise.all(families.map(async family => {
    const manifest = JSON.parse(await readFile(resolve(family.directory, 'package.json'), 'utf8'));
    assert.ok(manifest.publishConfig?.exports, `${family.name} has no published export map`);
    return [family.name, { ...family, exports: manifest.publishConfig.exports }];
  })));
  const resolutions = [];
  function importTarget(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      for (const condition of Object.keys(value)) {
        if (['import', 'node', 'default'].includes(condition)) {
          const target = importTarget(value[condition]);
          if (target) return target;
        }
      }
    }
    throw new Error('Published export has no supported Node ESM target');
  }
  return { resolutions, plugin: { name: 'test-published-maps', setup(builder) {
    builder.onResolve({ filter: /^@barocss\/(cad|cad-interop|gpu|physics|viewer)(\/|$)/ }, args => {
      const packageName = args.path.split('/').slice(0, 2).join('/');
      const family = packages.get(packageName);
      const subpath = args.path.slice(packageName.length);
      const key = subpath ? `.${subpath}` : '.';
      const target = importTarget(family.exports[key]);
      assert.ok(target.startsWith('./dist/') && target.endsWith('.js'),
        `${args.path} does not publish a dist JS target`);
      const path = resolve(family.directory, target);
      resolutions.push({ specifier: args.path, importer: relative(root, args.importer),
        exportKey: key, target: relative(root, path) });
      return { path };
    });
  } } };
}

export async function runProbe(mode) {
  const output = outputDirectory();
  const started = performance.now();
  let evidence;
  try {
    const published = mode === 'compiled' ? await publishedResolver() : null;
    const transformed = performance.now();
    const result = await build({ absWorkingDir: root, entryPoints: [resolve(here, 'cpu-entry.mjs')],
      bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', metafile: true,
      ...(published ? { plugins: [published.plugin] } : {}) });
    const transformMs = performance.now() - transformed;
    const inputs = inputProof(result.metafile, mode);
    const evaluated = performance.now();
    const flow = JSON.parse(execFileSync(process.execPath, ['--input-type=module'],
      { input: result.outputFiles[0].text, encoding: 'utf8', cwd: root, maxBuffer: 8 * 1024 * 1024 }));
    assert.equal(flow.ok, true);
    evidence = { work_id: 1010, mode, ok: true, timestamp: new Date().toISOString(),
      ...inputs, transformMs, evaluationMs: performance.now() - evaluated,
      elapsedMs: performance.now() - started, flow,
      ...(published ? { publishedResolutions: published.resolutions } : {}) };
  } catch (error) {
    evidence = { work_id: 1010, mode, ok: false, timestamp: new Date().toISOString(),
      elapsedMs: performance.now() - started, firstFailure: error.stack || String(error) };
    process.exitCode = 1;
  }
  await writeEvidence(output, `${mode}-probe.json`, evidence);
  console.log(JSON.stringify(evidence, null, 2));
}
