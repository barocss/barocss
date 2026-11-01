// Current-source bounded L-frame style fixture, with no external input or downloads.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const output = resolve(process.argv[2] ?? ''); assert.ok(process.argv[2]); await mkdir(output, { recursive: true });
const repo = resolve(import.meta.dirname, '../../..');
const source = `import {ordinaryTextFixture} from './packages/barocss-cad-model/test/drawing-ordinary-text-fixture';import {sheetSvg} from './packages/barocss-cad-model/src/io/svg';import {writeFileSync} from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';const out=process.argv[2],report={};for(const standard of [undefined,'iso','asme']){const {doc,context}=ordinaryTextFixture(standard),name=standard??'plain',svg=sheetSvg(context.sheet,'Ordinary text');writeFileSync(join(out,name+'.bcad'),JSON.stringify(doc,null,2));writeFileSync(join(out,name+'.svg'),svg);report[name]={sha256:createHash('sha256').update(svg).digest('hex'),texts:context.sheet.groups.filter(g=>['label','table','weld','dimension'].includes(g.role)).map(g=>({role:g.role,texts:g.marks.filter(m=>m.kind==='text').map(m=>({text:m.text,size:m.size}))}))};}writeFileSync(join(out,'measurement.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));`;
const built = await build({ stdin: { contents: source, resolveDir: repo, sourcefile: 'drawing-ordinary-text-producer.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
await writeFile(join(output, 'producer.mjs'), built.outputFiles[0].contents); await writeFile(join(output, 'producer-inputs.json'), JSON.stringify(built.metafile, null, 2));
const run = spawnSync(process.execPath, [join(output, 'producer.mjs'), output], { encoding: 'utf8', maxBuffer: 2 ** 22 }); await writeFile(join(output, 'producer.stdout.json'), run.stdout); await writeFile(join(output, 'producer.stderr.txt'), run.stderr); assert.equal(run.status, 0, run.stderr); process.stdout.write(run.stdout);
