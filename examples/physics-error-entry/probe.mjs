import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { families, publishedResolver } from '../workspace-source/probe.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const [mode, ...flags] = process.argv.slice(2);
if (!['source', 'compiled'].includes(mode) || flags.some(flag => flag !== '--observe') || flags.length > 1) {
  throw new Error('Usage: node examples/physics-error-entry/probe.mjs source|compiled [--observe]');
}
const observe = flags.includes('--observe');
const metadata = { work_id: 1022, mode, observe, timestamp: new Date().toISOString(), nodeVersion: process.version,
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() };

async function exportTargets() {
  const directory = resolve(root, 'packages/barocss-physics');
  const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  const expected = ['.', './cad-proxy', './replay', './fluid', './cloth', './fluid-cad'];
  assert.deepEqual(Object.keys(manifest.publishConfig.exports).sort(), [...expected].sort());
  const checked = [];
  for (const key of expected) {
    const entry = manifest.publishConfig.exports[key];
    assert.ok(entry.import.startsWith('./dist/') && entry.import.endsWith('.js'));
    assert.ok(entry.types.startsWith('./dist/') && entry.types.endsWith('.d.ts'));
    for (const [kind, target] of [['javascript', entry.import], ['declaration', entry.types]]) {
      const path = resolve(directory, target), info = await stat(path);
      assert.ok(info.isFile(), `${key} ${kind} target is not a file`);
      checked.push({ entry: key, kind, target: relative(root, path), exists: true });
    }
  }
  return checked;
}

function inputProof(metafile) {
  const own = Object.keys(metafile.inputs).map(path => resolve(root, path))
    .filter(path => families.some(family => path.startsWith(`${family.directory}/`)));
  const source = own.filter(path => path.includes('/src/'));
  const compiled = own.filter(path => path.includes('/dist/'));
  assert.ok(own.length > 0, 'Actual own package inputs must exist');
  assert.equal(mode === 'source' ? compiled.length : source.length, 0, 'No wrong-family src/dist inputs admitted');
  const targetDirectory = mode === 'source' ? 'src' : 'dist';
  for (const family of ['physics', 'cad']) {
    assert.ok(own.some(path => path.startsWith(`${root}/packages/barocss-${family}/${targetDirectory}/`)),
      `${family} must resolve to actual ${targetDirectory} input files`);
  }
  return { sourceFiles: source.length, compiledFiles: compiled.length,
    wrongFamilyInputs: [], ownInputs: own.map(path => relative(root, path)) };
}

try {
  const checkedExportTargets = await exportTargets();
  const published = mode === 'compiled' ? await publishedResolver() : null;
  const result = await build({ absWorkingDir: root, entryPoints: [resolve(here, 'entry.mjs')], bundle: true,
    write: false, platform: 'node', format: 'esm', target: 'es2022', metafile: true,
    ...(published ? { plugins: [published.plugin] } : {}) });
  const resolution = inputProof(result.metafile);
  const flow = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-', ...(observe ? ['--observe'] : [])],
    { input: result.outputFiles[0].text, encoding: 'utf8', cwd: root, maxBuffer: 8 * 1024 * 1024 }));
  assert.equal(flow.ok, true);
  if (!observe) assert.equal(flow.allConstructorsEqual, true);
  console.log(JSON.stringify({ ...metadata, ok: true, resolution, checkedExportTargets, flow,
    sourceAliases: false, sourceCustomConditions: false, sourceResolverPlugin: false,
    compiledResolver: published ? 'existing complete transitive publishConfig.exports resolver' : null,
    ...(published ? { publishedResolutions: published.resolutions } : {}) }));
} catch (error) {
  console.log(JSON.stringify({ ...metadata, ok: false, firstFailure: error.stack || String(error),
    ...(error.stdout ? { subprocessStdout: String(error.stdout) } : {}),
    ...(error.stderr ? { subprocessStderr: String(error.stderr) } : {}) }));
  process.exitCode = 1;
}
