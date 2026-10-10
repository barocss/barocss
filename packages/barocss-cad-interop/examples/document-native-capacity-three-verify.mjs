import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Run this source verifier with Node22');
const entry = fileURLToPath(new URL('./document-native-capacity-three-checkpoint.mjs', import.meta.url));
const root = resolve(dirname(entry), '../../..');
const bundle = await build({ entryPoints: [entry], absWorkingDir: root, bundle: true,
  platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
const families = ['cad', 'cad-interop'];
const sourceInputs = Object.fromEntries(families.map(name => [name, inputs.filter(path =>
  path.startsWith(resolve(root, `packages/barocss-${name}/src`) + '/')).map(path => relative(root, path))]));
const compiledInputs = inputs.filter(path => path.startsWith(resolve(root, 'packages') + '/') && path.includes('/dist/'));
for (const name of families) assert.ok(sourceInputs[name].length > 0, `${name} source input is required`);
assert.equal(compiledInputs.length, 0, 'Own compiled inputs must not replace actual source entries');
console.log(JSON.stringify({ stage: 'public-source-transform', node: process.version,
  ownCadSourceFiles: sourceInputs.cad.length, ownInteropSourceFiles: sourceInputs['cad-interop'].length,
  ownCompiledFiles: compiledInputs.length, sourceInputs }));
execFileSync(process.execPath, ['--input-type=module'], {
  cwd: root, input: bundle.outputFiles[0].text, stdio: ['pipe', 'inherit', 'inherit'],
});
