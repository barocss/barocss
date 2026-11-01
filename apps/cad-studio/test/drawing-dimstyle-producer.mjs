// D414 test-only current-source producer. No browser export/download action.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INSPECTOR_SOURCE = `
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brepsFor } from '@barocss/cad-model/engine/evaluate';
import { projectViews } from '@barocss/cad-model/drawing/project';
import { buildSheet } from '@barocss/cad-model/drawing/sheet';
import { layoutSheet } from '@barocss/cad-model/drawing/views';
import { sheetDxf } from '@barocss/cad-model/io/dxf';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const options = JSON.parse(process.argv[3]);
const source = brepsFor(doc);
if (!('breps' in source)) throw Error(JSON.stringify(source));
const projected = projectViews(source.breps, source.prefixes);
if (!projected.ok) throw Error(JSON.stringify(projected));
const layout = layoutSheet(projected.views, doc.drawing);
const sheet = buildSheet(projected.views, layout, doc.drawing, { title: 'Style snapshot', date: '2026-11-01' });
const files = ['AC1015', 'AC1009'].map(version => {
  const file = join(options.output, options.label + '-' + version + '.dxf');
  writeFileSync(file, sheetDxf(sheet, layout, version).bytes);
  return { file, version };
});
console.log(JSON.stringify({ settings: doc.drawing, sheetStandard: sheet.standard, files }));
`;

export async function makeFixture(output) {
  const app = resolve('apps/cad-studio');
  const { build } = createRequire(join(app, 'package.json'))('esbuild');
  const entry = `
import { writeFileSync } from 'node:fs';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { brepsFor } from '@barocss/cad-model/engine/evaluate';
import { projectViews } from '@barocss/cad-model/drawing/project';
import { snapPoints } from '@barocss/cad-model/drawing/dimensions';
import { defaultDrawing } from '@barocss/cad-model/drawing/types';
const doc = rectanglePart(30,12,6), source = brepsFor(doc);
if (!('breps' in source)) throw Error(JSON.stringify(source));
const projected = projectViews(source.breps, source.prefixes);
if (!projected.ok) throw Error(JSON.stringify(projected));
const points = snapPoints(projected.views.front);
const at = (x,z) => points.find(p=>p.at[0]===x&&p.at[1]===z).ref;
doc.drawing = {...defaultDrawing(),scale:1,dimensions:[
 {id:'width',kind:'linear',view:'front',orient:'horizontal',a:at(0,0),b:at(30,0),place:[15,-12]},
 {id:'height',kind:'linear',view:'front',orient:'vertical',a:at(0,0),b:at(0,6),place:[-12,3]},
]};
writeFileSync(process.argv[2],JSON.stringify(doc));
`;
  await mkdir(output, { recursive: true });
  const result = await build({ stdin: { contents: entry, sourcefile: 'd414-fixture.ts', resolveDir: app, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  const script = join(output, 'fixture-producer.mjs');
  await writeFile(script, result.outputFiles[0].contents);
  await writeFile(join(output, 'fixture-producer-source.ts'), entry);
  await writeFile(join(output, 'fixture-producer-inputs.json'), JSON.stringify(result.metafile.inputs, null, 2));
  const { spawnSync } = await import('node:child_process');
  const file = join(output, 'drawing-box.bcad'), run = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
  if (run.status !== 0) throw Error(run.stderr);
  return file;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await makeFixture(resolve(process.argv[2])));
