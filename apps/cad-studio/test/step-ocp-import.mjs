// D405 reverse interoperability: OCP-produced STEP through the current product importer.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const input = resolve(process.argv[2] ?? ''), output = resolve(process.argv[3] ?? '');
assert.ok(process.argv[2] && process.argv[3], 'STEP input and output folder required'); await mkdir(output, { recursive: true });
const source = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {emptyDoc,withNode} from '../../packages/barocss-cad-model/src/engine/doc';
import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate';
import {stepLengthUnit} from '../../packages/barocss-cad-model/src/engine/stepUnits';
const step=readFileSync(process.argv[2],'utf8'),unit=stepLengthUnit(step);assert.equal(unit.to,1);assert.equal(unit.declared,true);
const doc=withNode(emptyDoc(),{kind:'import',name:'OCP box',step});const r=evaluateDoc(doc,0);assert.ok(r.ok,JSON.stringify(r));
assert.equal(r.bodies.length,1);const b=r.bodies[0],expected=[5,-4,2,17,3,5],actual=[...b.mesh.bounds.min,...b.mesh.bounds.max];
const boundsErrors=actual.map((v,i)=>v-expected[i]),volumeError=b.volume!-252;assert.ok(boundsErrors.every(v=>Math.abs(v)<=1e-6),JSON.stringify(actual));assert.ok(Math.abs(volumeError)<=1e-5,String(b.volume));
console.log(JSON.stringify({status:'PASS',scope:'OCP_STEP_THROUGH_CURRENT_PRODUCT_IMPORTER',unit,bodies:1,volume:b.volume,bounds:actual,volumeError,boundsErrors,sourceBytes:Buffer.byteLength(step)}));`;
const built = await build({ stdin: { contents: source, resolveDir: resolve(import.meta.dirname, '..'), sourcefile: 'step-ocp-import.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
await writeFile(join(output, 'import-probe.ts'), source); await writeFile(join(output, 'import-probe.mjs'), built.outputFiles[0].contents);
await writeFile(join(output, 'import-inputs.json'), JSON.stringify(built.metafile, null, 2));
const run = spawnSync(process.execPath, [join(output, 'import-probe.mjs'), input], { encoding: 'utf8', maxBuffer: 2 ** 22 });
await writeFile(join(output, 'import.stdout.json'), run.stdout); await writeFile(join(output, 'import.stderr.txt'), run.stderr);
assert.equal(run.status, 0, run.stderr); process.stdout.write(run.stdout);
