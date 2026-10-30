// B2 qualification: an associative 3D band surface (an exact ruled sheet between two edge chains of two bodies). Cylinder 1 (r 20 = parameter R, z 0..10) and cylinder 2 (r 10, z 40..50) come from
// test/fixtures/band-surface.bcad. The top face of cylinder 1 is selected (A: all its edges), "Band surface" is started from the palette, the bottom face of cylinder 2 is clicked as B (as the viewport reports a click),
// Apply makes the band node. The independent Python oracle (python3 -I, zero product imports) decides: the frustum area pi (r1 + r2) sqrt((r1 - r2)^2 + h^2) against the kernel's area over the exact surfaces (1e-9), and the faceted display mesh area to 1e-2,
// the boundary radii at the sheet's two ends, no volume (a sheet has no mass), the stored node (sides, names, parents) and the kernel's boundary report. Steps: R 20 -> 25 (the area follows), Undo / Redo, Save + fresh Open equal,
// the band editor reopened with its values, deleting cylinder 1 refused with its toast, and a saved file with one A edge name renamed to a missing name: the band is held with its reason, the two cylinders are present.
// B2 v1 has no thickness: there is no thicken step and the command has no Thickness / Side field.
// Root must freeze all sources first. Run from apps/cad-studio:
//   BAND_SURFACE_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/band-surface-browser.mjs /absolute/artifacts
// Plumbing is in ./flow-helper.mjs. Faces are picked through the existing dev hooks window.__studioSelectFace / __studioPickFace (canvas picks of a bottom face are not reproducible); buttons, palette, HUD, Parameters panel,
// outliner, Undo / Redo, Save and Open are real UI. Not confirmed statically: the HUD button / select labels, the band editor's input labels, the outliner order and the held reason text.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Independent check of a ruled band sheet between two coaxial circles. Product imports: zero."""
import json, math, sys

data = json.load(sys.stdin)
doc = data['doc']; read = data['read']; exp = data['expect']
params = doc.get('parameters') or {}

def finite(v, path):
    if isinstance(v, bool): return
    if isinstance(v, (int, float)): assert math.isfinite(v), ('non-finite', path)
    elif isinstance(v, list):
        for i, x in enumerate(v): finite(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): finite(x, path + '.' + k)
    elif v is None: raise AssertionError(('null', path))
finite(doc, 'doc')

def resolve(x):
    if isinstance(x, dict): return float(params[x['parameter']])
    return float(x)

nodes = doc['nodes']
bands = [n for n in nodes if n['kind'] == 'band-surface']; assert len(bands) == 1, ('one band node', len(bands))
band = bands[0]
r1 = resolve(nodes[0]['radius']); r2 = resolve(nodes[2]['radius']); z1 = float(nodes[1]['height']); z2 = float(nodes[3]['from'])
assert abs(r1 - exp['r1']) < 1e-12 and abs(r2 - exp['r2']) < 1e-12, ('radii', r1, r2, exp)
assert band['a']['parent'] == {'node': 1, 'side': 'solid'} and band['b']['parent'] == {'node': 3, 'side': 'solid'}, ('parents', band['a'], band['b'])
assert len(band['a']['edges']) >= 1 and len(band['b']['edges']) >= 1
assert not set(band['a']['edges']) & set(band['b']['edges']), 'a name on one side only'
assert band['a']['edges'] == exp['aEdges'] and band['b']['edges'] == exp['bEdges'], ('stored names', band['a']['edges'], band['b']['edges'])
assert not band.get('flip'), 'flip is off'
for k in ('thickness', 'side'): assert k not in band, ('v1 has no ' + k)

h = z2 - z1
want = math.pi * (r1 + r2) * math.sqrt((r1 - r2) ** 2 + h * h)
bodies = read['bodies']; sheets = [b for b in bodies if b.get('band')]; assert len(sheets) == 1, ('one sheet body', [b['key'] for b in bodies])
sheet = sheets[0]; assert len(bodies) == 3, ('two cylinders and the band stay bodies', [b['key'] for b in bodies])
# The kernel's area over the exact surfaces must equal the frustum; the faceted display mesh only to its chord error.
assert sheet.get('areaBasis') == 'exact', ('the band area is computed on the exact surfaces', sheet.get('areaBasis'))
exact = sheet['area']; rel_exact = abs(exact - want) / want
assert rel_exact <= 1e-9, ('exact band area against the frustum', exact, want, rel_exact)
area = sum(sheet['faceAreas']); rel = abs(area - want) / want
assert rel <= 1e-2, ('display mesh area against the frustum (faceted)', area, want, rel)
assert abs(sheet['zMin'] - z1) < 1e-6 and abs(sheet['zMax'] - z2) < 1e-6, ('sheet z range', sheet['zMin'], sheet['zMax'])
for r in sheet['radiiAtZMin']: assert abs(r - r1) < 1e-6, ('boundary radius at A', r, r1)
for r in sheet['radiiAtZMax']: assert abs(r - r2) < 1e-6, ('boundary radius at B', r, r2)
assert len(sheet['radiiAtZMin']) >= 8 and len(sheet['radiiAtZMax']) >= 8
assert sheet['volume'] in (None, 0), ('a sheet has no volume', sheet['volume'])
rep = sheet['band']; assert rep['closed'] is True and rep['exact'] is True, rep
assert rep['boundaryDeviation'] <= 1e-6, ('boundary deviation', rep['boundaryDeviation'])
assert 'chord' not in rep or rep['chord'] is None, 'no thickness, no chord'
print(json.dumps({'status': 'PASS', 'r1': r1, 'r2': r2, 'h': h, 'frustumArea': want, 'exactArea': exact, 'exactRelative': rel_exact, 'meshArea': area, 'relative': rel, 'report': rep}, indent=2))
`;

const inspectorSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));const before=JSON.stringify(doc);
const out:any={ok:false,error:null,thrown:null,bodies:[]};let view:any=null;
try{view=evaluateDoc(doc,0);}catch(e:any){out.thrown=String(e?.message??e);}
if(view){out.ok=!!view.ok;out.error=view.ok?null:String(view.error?.detail??view.error?.title??view.error??'evaluation failed');
if(view.ok)for(const b of view.bodies){const p=b.mesh.positions as Float32Array;let zMin=Infinity,zMax=-Infinity;for(let i=2;i<p.length;i+=3){zMin=Math.min(zMin,p[i]);zMax=Math.max(zMax,p[i]);}
const at=(z:number)=>{const r:number[]=[];for(let i=0;i<p.length;i+=3)if(Math.abs(p[i+2]-z)<1e-6)r.push(Math.hypot(p[i],p[i+1]));return r;};
out.bodies.push({key:b.key,ref:b.ref??null,volume:b.volume??null,band:b.band??null,area:b.area??null,areaBasis:b.areaBasis??null,faceAreas:b.mesh.faces.map((f:any)=>f.area),zMin,zMax,radiiAtZMin:at(zMin),radiiAtZMax:at(zMax)});}}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;

const f = await createFlow({ name: 'band-surface', envFrozen: 'BAND_SURFACE_SOURCE_FROZEN', output: process.argv[2], qualification: 'ASSOCIATIVE_3D_BAND_SURFACE', oracleSource, inspectorSource,
  initialFiles: ['apps/cad-studio/test/band-surface-browser.mjs', 'apps/cad-studio/test/band-highlight.test.ts', 'apps/cad-studio/test/fixtures/band-surface.bcad', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/app/bandHighlight.ts', 'apps/cad-studio/src/ui/Hud.tsx',
    'packages/barocss-cad-model/src/app/bandSurfaceCommand.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts', 'packages/barocss-cad-model/src/engine/doc.ts', 'packages/barocss-cad-model/src/engine/references.ts', 'packages/barocss-cad/src/features/band-surface.ts'],
  requiredFrozen: ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/app/bandHighlight.ts', 'packages/barocss-cad-model/src/app/bandSurfaceCommand.ts'],
  limits: ['A thickened band (B2 v1 has no thicken) is not run.', 'Faces are picked through the dev hooks __studioSelectFace / __studioPickFace, not by canvas clicks.', 'The band area is the kernel\'s area over the exact surfaces (areaBasis exact, 1e-9 of the frustum); the faceted display mesh area is checked only to 1e-2.', 'Only coaxial circles (closed to closed, equal counts) are run.'] });

await f.run(async () => {
  const fixture = resolve(f.app, 'test/fixtures/band-surface.bcad'), hud = () => f.page.getByRole('dialog', { name: 'Band surface', exact: true });
  const expectFor = (r1, aEdges, bEdges) => ({ r1, r2: 10, aEdges, bEdges });
  await f.newPage(); f.phase = 'open fixture'; await f.openFile(fixture, 4); const doc00 = await f.doc();
  assert.equal((await f.bodies()).bodies.length, 2, 'two cylinders'); await f.snapshot('00-fixture');

  // 1. A = the top face of cylinder 1 (its edges), Band surface from the palette, B = the bottom face of cylinder 2, Apply.
  f.phase = 'pick A'; assert.ok(await f.page.evaluate(() => window.__studioSelectFace('n1.top')), 'the top face of cylinder 1 is selectable');
  await f.page.waitForTimeout(200); await f.command('Band surface'); await hud().waitFor();
  await f.snapshot('01-hud-a'); f.report.observations.push({ label: 'hud-after-A', text: await f.page.evaluate(() => document.querySelector('.hud')?.textContent ?? null) });
  f.phase = 'pick B'; assert.ok(await f.page.evaluate(() => window.__studioPickFace('n3.bottom')), 'the bottom face of cylinder 2 is pickable');
  await f.page.waitForFunction(() => /preview/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 30000 });
  const hudB = await f.page.evaluate(() => document.querySelector('.hud')?.textContent ?? ''); f.report.observations.push({ label: 'hud-after-B', text: hudB });
  assert.equal(await f.page.evaluate(() => [...document.querySelectorAll('.hud select[aria-label]')].some(s => /thick|side/i.test(s.getAttribute('aria-label') ?? '')) || [...document.querySelectorAll('.hud input[aria-label]')].some(s => /thick/i.test(s.getAttribute('aria-label') ?? ''))), false, 'no Thickness / Side field');
  await f.snapshot('02-hud-b');
  f.phase = 'Apply band'; await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await f.changed(doc00); await hud().waitFor({ state: 'hidden' }); await f.ready();
  const s03 = await f.snapshot('03-band'), doc03 = s03.doc; assert.equal(doc03.nodes.length, 5); const node = doc03.nodes[4]; assert.equal(node.kind, 'band-surface');
  assert.deepEqual(await f.toasts(), []); assert.equal(s03.bodies.bodies.length, 3, 'two cylinders and the sheet');
  const aEdges = node.a.edges, bEdges = node.b.edges;
  const read03 = await f.inspect('03-native', doc03); assert.equal(read03.ok, true, read03.error);
  const o03 = await f.runOracle({ doc: doc03, read: read03, expect: expectFor(20, aEdges, bEdges) }, '03');

  // 2. Cylinder 1 radius R 20 -> 25: the band area follows, names unchanged.
  const s04 = await f.setParameter('R', 25, '04-R-25'), doc04 = s04.doc; assert.deepEqual(doc04.nodes[4].a.edges, aEdges); assert.deepEqual(doc04.nodes[4].b.edges, bEdges); assert.deepEqual(await f.toasts(), []);
  const read04 = await f.inspect('04-native', doc04); assert.equal(read04.ok, true, read04.error); const o04 = await f.runOracle({ doc: doc04, read: read04, expect: expectFor(25, aEdges, bEdges) }, '04');
  assert.ok(o04.meshArea > o03.meshArea, 'a wider A gives a larger band area');

  // 3. Undo / Redo.
  await f.undo(); await f.same(doc03); await f.snapshot('05-undo'); await f.redo(); await f.same(doc04); await f.snapshot('06-redo');

  // 4. Save, fresh Open equal, the band editor reopened.
  const saved = await f.save('band-surface'); await f.freshOpen(saved.file, saved.doc, '07-fresh-open');
  const read07 = await f.inspect('07-native', saved.doc); assert.equal(read07.ok, true, read07.error); await f.runOracle({ doc: saved.doc, read: read07, expect: expectFor(25, aEdges, bEdges) }, '07');
  // (The band is edited in its command HUD, like the cylindrical wrap: opening its history entry starts the edit with its values.)
  await f.ready(); await f.page.evaluate(() => document.activeElement?.blur()); await f.page.locator('.history .hs[data-node-index="4"]').click();
  await f.page.waitForFunction(() => /Band surface/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 30000 });
  const editHud = await f.page.evaluate(() => ({ text: document.querySelector('.hud')?.textContent ?? '', selects: [...document.querySelectorAll('.hud select')].map(s => ({ label: s.closest('label')?.textContent ?? s.getAttribute('aria-label'), value: s.value })) }));
  f.report.observations.push({ label: 'band-edit-hud', ...editHud }); await f.snapshot('08-band-editor');
  assert.ok(editHud.selects.some(s => /flip/i.test(s.label ?? '') && s.value === 'no'), `the band edit shows Flip = no: ${JSON.stringify(editHud.selects)}`);
  assert.ok(/re-?pick/i.test(editHud.text), `the band edit offers Re-pick: ${editHud.text}`);
  assert.equal(/thick/i.test(editHud.text), false, 'no Thickness field in the band edit');
  await f.page.keyboard.press('Escape'); await f.page.waitForFunction(() => !document.querySelector('.hud'), null, { timeout: 15000 }); await f.same(saved.doc);

  // 5. Deleting cylinder 1 is refused with its toast (the band names its edges).
  // (A feature is deleted from its editor. Deleting cylinder 1's extrude, which the band uses as side A's parent, asks first and names
  // the band that goes with it (Undo restores both); Cancel leaves the document as it was.)
  f.phase = 'delete cylinder 1'; await f.openFeatureEditor(1, 'cylinder 1'); await f.page.getByRole('button', { name: 'Delete feature', exact: true }).click();
  const ask = f.page.getByRole('dialog', { name: 'Delete with dependents' }); await ask.waitFor({ timeout: 15000 });
  const askText = await ask.textContent(); f.report.observations.push({ label: 'delete-asks', text: askText }); await f.snapshot('09-delete-asks');
  assert.match(askText ?? '', /Band surface/, 'the delete names the band that goes with the cylinder');
  await ask.getByRole('button', { name: 'Cancel', exact: true }).click(); await ask.waitFor({ state: 'hidden' }); await f.closeEditor(); await f.same(saved.doc);

  // 6. A saved file with one A edge renamed to a missing name. Studio's Open verifies references only after a moved-reference
  // failure; a lost name fails the evaluation with [BAND_EDGE_LOST] naming the edge (as a fillet's lost edge does), and nothing is
  // retargeted: the document opens as it is, the message says which edge is gone.
  f.phase = 'renamed edge file'; const renamed = JSON.parse(JSON.stringify(saved.doc)); const missing = `${aEdges[0].split('|')[0]}|n1.gone`; renamed.nodes[4].a.edges[0] = missing; if (renamed.nodes[4].sigs) { renamed.nodes[4].sigs[missing] = renamed.nodes[4].sigs[aEdges[0]]; delete renamed.nodes[4].sigs[aEdges[0]]; }
  const file = join(f.output, 'band-surface-renamed.bcad'); await writeFile(file, JSON.stringify(renamed)); await f.newPage();
  await f.page.setInputFiles('input[aria-label="Model file"]', file);
  const lost = await f.waitToast(/BAND_EDGE_LOST|no longer exists/i, 60000); const opened = await f.doc(); await f.snapshot('10-lost-edge');
  f.report.observations.push({ label: 'lost-edge-open', toast: lost, node: opened.nodes[4] });
  assert.match(lost, /\[BAND_EDGE_LOST\]/, 'the message carries the band tag'); assert.ok(lost.includes(missing), `the message names the lost edge: ${lost}`);
  assert.deepEqual(opened.nodes[4].a.edges, renamed.nodes[4].a.edges, 'the name is not retargeted'); assert.deepEqual(opened.nodes.length, 5, 'the document opened as it is');
  await f.dismissToasts();
});
