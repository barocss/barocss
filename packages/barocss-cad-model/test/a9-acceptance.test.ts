import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { resolveShopTree } from '../src/engine/shopRows';
import { receivePersonRowFiles, type PersonRowFiles } from '../src/chat/rowFiles';

// A9 (O5): the coordinator's acceptance — a written brief to what a shop needs, one scripted agent through the real v2
// tools (dispatchTool, no live model), the brief as decisions-outer.md's A9 S0 froze it and O158 corrected it.
// The rows are conformance/a9/rows/*.json: a TEST FIXTURE standing in for the person's files, loaded through the chat's
// person-file path (rows rule b). The owner's own acceptance with a real person-supplied file stays pending.
// O159 holds steps 1–7 (rows, briefs, the four parts); the assembly, drawings, BOM, CSV, outputs and the bundle
// (steps 8–11) follow. Where a part's oracle is not met yet it is said, not asserted (see O159's findings).
const DIR = resolve(import.meta.dirname, '..', 'conformance/a9/rows');
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
/** A placed part's bodies as the assembly sees it: its document with the shop rows it inherits. */
const partBodies = (id: string) => { const inst = s.doc.instances!.find(i => i.id === id)!, r = evaluateDoc(resolveShopTree(inst.doc, s.doc, id), 1); assert.ok(r.ok, JSON.stringify(r)); return r.bodies; };
/** The fixture's files, received as attachments of one conversation at turn 1 (rows rule b). */
function personFiles(): { rowFiles: PersonRowFiles; file: (name: string) => string } {
  const names = readdirSync(DIR).filter(n => n.endsWith('.json')).sort();
  const rowFiles = receivePersonRowFiles('a9a9a9a9a9a9a9a9a9a9a9a9', names.map(name => ({ name, text: readFileSync(join(DIR, name), 'utf8'), turn: 1 })), 1);
  return { rowFiles, file: name => rowFiles.files.find(f => f.source.filename === name)!.id };
}
let s: ChatState;
async function call(tool: string, args: Record<string, unknown>) {
  const r = await dispatchTool(s, tool, args, evaluate);
  assert.ok(!r.isError, `${tool} ${JSON.stringify(args)}: ${r.content}`);
  s = r.state;
  return JSON.parse(r.content) as Record<string, unknown>;
}
async function refused(tool: string, args: Record<string, unknown>) {
  const r = await dispatchTool(s, tool, args, evaluate);
  assert.ok(r.isError, `${tool} ${JSON.stringify(args)} was not refused: ${r.content}`); assert.equal(r.state.doc, s.doc);
  return String((JSON.parse(r.content) as { error?: string }).error ?? r.content);
}

const stated = (value: string) => ({ value, basis: 'stated', source: 'the A9 brief' });
const exclude = <T extends Record<string, unknown>>(o: T) => { const { shopRows: _r, provenance: _p, ...rest } = o; void _r; void _p; return rest; };
const PITCH = 0.5e-6;

test('A9 steps 1–7: the person\'s rows (the fixture), a brief per part, and the frame, plate, shaft and cover by their oracles', async () => {
  const files = personFiles();
  s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc(), rowFiles: files.rowFiles } as never as ChatState;

  // 1. Rows. The frame's section and stock lengths, then the parts' stock; the fit, bearing and O-ring rows on the base,
  // which the parts inherit (A9-8). Agent-written rows refused; each loaded row keeps the person's file as its source.
  assert.match(await refused('features', { action: 'frame_sections', rows: JSON.parse(readFileSync(join(DIR, 'sections.json'), 'utf8')) }), /\[ROWS_NOT_FROM_PERSON\]/);
  const sections = await call('features', { action: 'frame_sections', file: files.file('sections.json') });
  assert.deepEqual([sections.added, (sections.rows as { estimate?: boolean }[])[0].estimate], [['R40'], true]);
  await call('features', { action: 'frame_stock', file: files.file('frame-stock.json'), kerf: 2 });
  await call('features', { action: 'stock', file: files.file('stock.json'), allowance: 1 });
  assert.deepEqual([s.doc.frames?.stock?.map(r => r.id), s.doc.frames?.kerfMM, s.doc.machining?.stock?.map(r => r.id), s.doc.machining?.allowanceMM], [['S6'], 2, ['B1', 'R30'], 1]);

  // 3. The frame (the base part): the table skeleton on R40, butt corners, steel. Exact: A · ΣL with A = 40² − 34².
  await call('features', { action: 'command', command: 'frame', values: { skeleton: 'table', W: 400, D: 300, H: 300, x: 0, y: 0, z: 0, section: 'library', row: 'R40', corners: 'butt' } });
  await call('features', { action: 'material', material: 'steel' });
  assert.equal(s.bodies.length, 8);
  const A = 40 ** 2 - 34 ** 2, frameVolume = s.bodies.reduce((a, b) => a + b.volumeMM3!, 0);
  assert.ok(Math.abs(frameVolume - A * (4 * 320 + 2 * 360 + 2 * 260)) <= 1e-6 * frameVolume, String(frameVolume));
  assert.equal(Math.max(...s.bodies.map(b => b.mesh.bounds.max[2])), 320, 'the rails\' top');
  // (The cut list: legs 320 × 4, rails 360 × 2 and 260 × 2; nested into one S6 with FRb's rule, n − 1 kerfs a bar.)
  const cut = await call('query', { action: 'cutlist' }) as { rows: { quantity: number; longPointMM: number }[]; nesting: { bars: { stock: string; usedMM: number; kerfMM: number; offcutMM: number }[]; unplaced: unknown[] } };
  assert.deepEqual(cut.rows.map(r => [r.quantity, Math.round(r.longPointMM)]), [[4, 320], [2, 360], [2, 260]]);
  assert.deepEqual(cut.nesting.bars.map(b => [b.stock, b.usedMM, b.kerfMM, b.offcutMM]), [['S6', 2520, 7 * 2, 6000 - 2520 - 7 * 2]]);
  assert.deepEqual(cut.nesting.unplaced, []);

  // 2. Briefs per part (A9-2). The frame states purpose and material only: no weldment process (A9-12, the cut and weld
  // lists stand in), so its process stays a gap.
  const frameBrief = await call('requirements', { action: 'brief', fields: { purpose: stated('the bench drive unit\'s welded frame'), material: stated('steel') } }) as { gaps: { field: string }[] };
  assert.deepEqual(frameBrief.gaps.map(g => g.field), ['process']);

  // 5. The plate (p1): 200 × 300 × 14 (its 300 bridges the frame's two 360 rails), four Ø6.6 through holes over the rails,
  // the Ø47 bore classed H7, a 50 × 30 × 8 pocket. Exact (B-rep): 840000 − 12000 − 4π·3.3²·14 − π·23.5²·14.
  await call('assembly', { action: 'add_part', name: 'Plate', position: [0, 0, 0] });
  const P = (args: Record<string, unknown>) => ({ ...args, part: 'p1' });
  await call('features', P({ action: 'command', command: 'box', values: { w: 200, d: 300, h: 14, x: 0, y: 0, z: 0 } }));
  for (const [x, y] of [[20, 20], [180, 20], [20, 280], [180, 280]]) await call('features', P({ action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 6.6, x, y } }));
  await call('features', P({ action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 47, x: 100, y: 150 } }));
  await call('features', P({ action: 'command', command: 'box', values: { w: 50, d: 30, h: 8, x: 30, y: 200, z: 6 } }));
  const [plate, pocketBox] = partBodies('p1').map(b => b.key);
  await call('features', P({ action: 'command', command: 'difference', values: {}, bodies: [plate, pocketBox] }));
  const plateVolume = partBodies('p1')[0].volumeMM3!, plateExact = 840000 - 12000 - 4 * Math.PI * 3.3 ** 2 * 14 - Math.PI * 23.5 ** 2 * 14;
  assert.ok(Math.abs(plateVolume - plateExact) <= PITCH * plateExact, `${plateVolume} vs ${plateExact}`);

  // 6. The shaft (p2): the defaults, the key, and the 6204 — refused before its rows, then on step 3 against the Ø25
  // shoulder at k5 (O158). Exact: the bearing's body by Pappus, the kernel's case.
  await call('assembly', { action: 'add_part', name: 'Shaft', position: [0, 0, 0] });
  const S = (args: Record<string, unknown>) => ({ ...args, part: 'p2' });
  await call('features', S({ action: 'command', command: 'shaft', values: {} }));
  await call('features', S({ action: 'command', command: 'key', values: { h: 6 }, bodies: ['b0'] }));
  const bearingArgs = S({ action: 'command', command: 'bearing', values: { sc: 'k5', step: 3, against: 'start' }, bodies: ['b0'] });
  assert.match(await refused('features', bearingArgs), /Load your bearing rows first/);
  for (const [kind, name] of [['bearings', 'bearings.json'], ['fits', 'fits.json'], ['orings', 'orings.json']]) {
    const loaded = await call('features', { action: 'load_rows', kind, file: files.file(name) }) as { source: { filename: string; suppliedBy: string; turn: number } };
    assert.deepEqual([loaded.source.filename, loaded.source.suppliedBy, loaded.source.turn], [name, 'person', 1]);
  }
  await call('features', bearingArgs);
  const shaft = partBodies('p2'), notes = shaft.flatMap(b => (b.notes ?? []).map(n => n.text));
  assert.ok(Math.abs(shaft.find(b => b.key === 'b2')!.volumeMM3! - 19800.6522) < 1e-4, String(shaft[2].volumeMM3));
  assert.ok(notes.includes('Shaft seat k5: 20.002 to 20.011 (the ring\'s tolerance is not in its row), an estimate'), JSON.stringify(notes));
  assert.ok(notes.some(n => /^Bearing 6204: Ø20 × Ø47 × 14, corners r 1 \(your row, B1 \(D139\): NSK/.test(n)), JSON.stringify(notes));
  const fit = exclude(await call('query', S({ action: 'fit_clearance', hole_class: 'H7', shaft_class: 'k6', size: 20 })));
  assert.deepEqual([fit.kind, fit.clearanceMinUM, fit.clearanceMaxUM, fit.estimate], ['transition', -15, 19, true]);

  // 7. The cover (p3): Ø60 × 8 with a face gland on its top for the 214 — the prefills by their closed forms.
  await call('assembly', { action: 'add_part', name: 'Cover', position: [0, 0, 0] });
  const C = (args: Record<string, unknown>) => ({ ...args, part: 'p3' });
  await call('features', C({ action: 'command', command: 'cylinder', values: { r: 30, h: 8, x: 0, y: 0, z: 0 } }));
  await call('features', C({ action: 'command', command: 'oring-gland', values: {}, faces: ['n1.top'] }));
  const gland = s.doc.instances![2].doc.nodes.find(n => n.kind === 'oring-gland') as { gland: string; ring: string; width: number; depth: number };
  const h = 3.53 * (1 - 0.25), w = Math.PI * 1.765 ** 2 / (0.8 * h);
  assert.deepEqual([gland.gland, gland.ring], ['face', '214']);
  assert.ok(Math.abs(gland.depth - h) <= 5e-4 + 1e-9 && Math.abs(gland.width - w) <= 5e-4 + 1e-9, `${gland.depth} vs ${h}, ${gland.width} vs ${w} (prefills to 3 decimals)`);

  // 2 (the parts). Material and brief per part; each judged by its own process (A9-2).
  for (const [part, process, material] of [['p1', 'cnc-milling', 'al6061'], ['p2', 'cnc-turning', 'steel'], ['p3', 'fdm', 'petg']]) {
    await call('features', { action: 'material', material, part });
    await call('requirements', { action: 'brief', part, fields: { purpose: stated(`the bench drive unit's ${part}`), process: stated(process), material: stated(material) } });
    const dfm = exclude(await call('query', { action: 'manufacturability', part }));
    assert.deepEqual([dfm.part, dfm.process], [part, process]);
  }

  // 5 (the plate's CAM package, G23 B, from its own document on the base's inherited stock): the pocket's levels 11, 8, 6
  // at step-down 3 in the +Z setup; the stock a box from B1 with the allowance 1.
  const cam = await call('query', { action: 'cam', part: 'p1' }) as { files: { path: string; text: string }[] };
  const pkg = JSON.parse(cam.files[0].text) as { notForProduction: boolean; stock: { kind: string; min: number[]; max: number[] }; setups: { setup: string; moves: { kind: string; a: number[] }[] }[] };
  assert.equal(pkg.notForProduction, true);
  assert.deepEqual([pkg.stock.kind, pkg.stock.max.map((v, k) => v - pkg.stock.min[k])], ['box', [210, 310, 16]]);
  const top = pkg.setups.find(x => x.setup === '+Z')!;
  assert.deepEqual([...new Set(top.moves.filter(m => m.kind === 'feed').map(m => +m.a[2].toFixed(6)))], [11, 8, 6]);
});
