import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateDoc, exportStudioStep, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { withLook } from '@barocss/cad-model/app/bodies';
import { printability } from '@barocss/cad-model/print/rules';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { checkMaterials, MATERIALS_DATA, materialData } from '@barocss/cad-model/library/materials';
import { machiningOf, shrinkOf } from '@barocss/cad-model/casting/allowances';
import { patternOf } from '@barocss/cad-model/casting/pattern';
import { castingProfileOf } from '@barocss/cad-model/engine/castingRuleRows';
import { loadShopFile, sampleFile } from '../src/app/sizesFile';

// IM8b (O108): a casting pattern's allowances against closed forms — NPTEL's shrinkage (inches per foot by the pattern
// dimension's band in feet) and machining allowance (inches by the dimension's band in inches), as printed; each band's
// top in it; the user's own over the table's; the pattern of a 100 × 60 × 20 aluminium block with its top machined is
// 100 · 60 · (20 + 2.286) scaled 1 + 0.155/12 in every direction about its box centre, its STEP read back to that volume.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const block = (w: number, d: number, h: number) => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] }), { kind: 'extrude', sketch: 0, height: h });
const cast = (doc: StudioDoc, material: string, casting?: StudioDoc['casting'], process = 'sand-casting'): StudioDoc => {
  // (O7c: the casting rules are the sample rows, loaded as the person loads them.)
  const d: StudioDoc = withCastingSample({ ...doc, process, mould: { version: 1, pull: [0, 0, 1] }, ...(casting ? { casting } : {}) });
  return withLook(d, bodiesOf(d)[0], { material });
};
/** The document with the casting rules sample loaded, as the person loads it in the Library panel. */
function withCastingSample(doc: StudioDoc): StudioDoc {
  const r = loadShopFile(doc, 'casting-rules', sampleFile('casting-rules'), readFileSync(join(process.cwd(), '../../packages/barocss-cad-model/samples/rows/casting-rules.json'), 'utf8'));
  if ('error' in r) throw new Error(r.error);
  return r.doc;
}
const SAND = castingProfileOf(withCastingSample(emptyDoc()), 'sand-casting')!, AL = 0.155 / 12;
const rule = async (d: StudioDoc, id: string) => (await printability(d, bodiesOf(d), evaluate)).rules.find(r => r.id === id)!;
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

test('IM8b the data as NPTEL prints it: Table 1 in inch/ft (grey iron 0.125/0.105/0.083 by 2 and 4 ft; cast steel 0.251/0.191/0.155 by 2 and 6 ft; aluminium 0.155/0.143/0.125 by 4 and 6 ft; magnesium 0.173/0.155 by 4 ft); Table 3 in inches; each with its page and rule; grey iron an iron', () => {
  assert.deepEqual(checkMaterials(MATERIALS_DATA), []);
  const a = SAND.allowances!, sh = (f: string) => a.shrink.find(s => s.family === f)!.bands.map(b => [b.upToFt, b.inPerFt]), mc = (c: string) => a.machining.find(m => m.class === c)!.bands.map(b => [b.upToIn, b.in]);
  assert.deepEqual([sh('iron'), sh('steel'), sh('aluminium'), sh('magnesium')], [[[2, 0.125], [4, 0.105], [null, 0.083]], [[2, 0.251], [6, 0.191], [null, 0.155]], [[4, 0.155], [6, 0.143], [null, 0.125]], [[4, 0.173], [null, 0.155]]]);
  assert.deepEqual([mc('iron'), mc('steel'), mc('nonferrous')], [[[12, 0.12], [20, 0.2], [40, 0.25]], [[6, 0.12], [20, 0.25], [40, 0.3]], [[8, 0.09], [12, 0.12], [40, 0.16]]]);
  for (const t of [...a.shrink, ...a.machining]) assert.ok(/^https:\/\/archive\.nptel\.ac\.in\//.test(t.page.url) && t.page.read === '2026-10-21' && /as printed/.test(t.page.note ?? ''), t.page.label);
  assert.equal(materialData('grey-iron')!.castFamily, 'iron');
  assert.equal(castingProfileOf(withCastingSample(emptyDoc()), 'die-casting')!.allowances, undefined, 'no die-casting allowance read');
});

test('IM8b shrinkage by band, the band\'s top in it: aluminium 100 mm and exactly 4 ft 0.155/12, 1500 mm 0.143/12, 2000 mm 0.125/12; steel 700 mm 0.191/12; magnesium 1300 mm 0.155/12; zinc none (said); yours over the table', () => {
  const doc = emptyDoc();
  for (const [family, size, inPerFt, band] of [['aluminium', 100, 0.155, 'up to 4 ft'], ['aluminium', 4 * 304.8, 0.155, 'up to 4 ft'], ['aluminium', 1500, 0.143, '4 ft to 6 ft'], ['aluminium', 2000, 0.125, 'over 6 ft'], ['steel', 700, 0.191, '2 ft to 6 ft'], ['iron', 500, 0.125, 'up to 2 ft'], ['magnesium', 1300, 0.155, 'over 4 ft']] as const) {
    const s = shrinkOf(doc, SAND, family, size); assert.ok(s.ok, `${family} ${size}`);
    assert.ok(near(s.ratio, inPerFt / 12, 1e-15) && s.band === band && s.basis === 'table', `${family} ${size}: ${JSON.stringify(s)}`);
  }
  const zinc = shrinkOf(doc, SAND, 'zinc', 100); assert.ok(!zinc.ok && /no sand casting shrinkage for a zinc alloy/.test(zinc.why));
  const yours = shrinkOf({ ...doc, casting: { version: 1, shrink: 0.013 } }, SAND, 'zinc', 100); assert.ok(yours.ok && yours.ratio === 0.013 && yours.basis === 'set');
});

test('IM8b machining allowance by band (inches × 25.4): non-ferrous 100 mm 2.286, 250 mm 3.048; cast steel 700 mm 7.62; cast iron 400 mm 5.08; past 40 in — none, said; yours over the table', () => {
  const doc = emptyDoc();
  for (const [family, size, mm, band] of [['aluminium', 100, 2.286, 'up to 8 in'], ['aluminium', 250, 3.048, '8 in to 12 in'], ['steel', 700, 7.62, '20 in to 40 in'], ['iron', 400, 5.08, '12 in to 20 in'], ['magnesium', 8 * 25.4, 2.286, 'up to 8 in']] as const) {
    const m = machiningOf(doc, SAND, family, size); assert.ok(m.ok, `${family} ${size}`);
    assert.ok(near(m.mm, mm, 1e-9) && m.band === band, `${family} ${size}: ${JSON.stringify(m)}`);
  }
  const past = machiningOf(doc, SAND, 'aluminium', 1100); assert.ok(!past.ok && /past the table's last band \(40 in\)/.test(past.why));
  const yours = machiningOf({ ...doc, casting: { version: 1, machiningAllowance: 1.5 } }, SAND, 'aluminium', 1100); assert.ok(yours.ok && yours.mm === 1.5 && yours.basis === 'set');
});

test('IM8b in the report: an A356 block 100 × 60 × 20, top machined — shrink 1.012917 and 2.286 mm on one face, each with its page; none marked n/a; a face not on the part fails; die casting\'s shrinkage unknown', async () => {
  const b = block(100, 60, 20), top = cast(b, 'a356', { version: 1, machined: ['n1.top'] });
  const sh = await rule(top, 'shrink'), ma = await rule(top, 'machining-allowance');
  assert.deepEqual([sh.status, sh.value, ma.status, ma.value, ma.entities], ['pass', 1.012917, 'pass', 2.286, ['n1.top']]);
  assert.match(sh.message, /Aluminum, up to 4 ft: the part's largest 100 mm/); assert.match(sh.source!, /lecture3\.htm$/); assert.match(ma.source!, /lecture4\.htm$/);
  assert.equal((await rule(cast(b, 'a356'), 'machining-allowance')).status, 'n/a');
  const gone = await rule(cast(b, 'a356', { version: 1, machined: ['n9.top'] }), 'machining-allowance'); assert.equal(gone.status, 'fail'); assert.match(gone.message, /\[CASTING_FACE\]/);
  const die = await rule(cast(b, 'a380', undefined, 'die-casting'), 'shrink'); assert.equal(die.status, 'unknown'); assert.match(die.why!, /no die casting shrinkage/);
});

test('IM8b the pattern: the block with 2.286 mm on its top, scaled 1 + 0.155/12 about its box centre — its volume 100·60·22.286·f³ (1e-9 relative) and its box; its STEP read back to the same volume', async () => {
  const d = cast(block(100, 60, 20), 'a356', { version: 1, machined: ['n1.top'] }), p = await patternOf(d, bodiesOf(d), evaluate);
  assert.ok(p.ok, JSON.stringify(p));
  const f = 1 + AL, exact = 100 * 60 * (20 + 2.286) * f ** 3;
  assert.ok(near(p.bodies[0].volume!, exact, 1e-9 * exact), `${p.bodies[0].volume} vs ${exact}`);
  assert.deepEqual(p.file.pivot, [50, 30, 10]);
  const want = { min: [50 - 50 * f, 30 - 30 * f, 10 - 10 * f], max: [50 + 50 * f, 30 + 30 * f, 10 + 12.286 * f] };
  for (const k of [0, 1, 2]) assert.ok(near(p.file.pattern.min[k], want.min[k], 1e-5) && near(p.file.pattern.max[k], want.max[k], 1e-5), JSON.stringify(p.file.pattern));
  assert.deepEqual([p.file.shrink.factor, p.file.shrink.band, p.file.machining!.mm, p.file.machining!.faces], [1.012917, 'up to 4 ft', 2.286, ['n1.top']]);
  const step = exportStudioStep(p.doc, { name: 'pattern' }); assert.match(step.text, /^ISO-10303-21;/);
  const back = evaluateDoc(withNode(emptyDoc(), { kind: 'import', name: 'pattern', step: step.text } as never), 1); assert.ok(back.ok);
  assert.ok(near(back.bodies[0].volume!, exact, 1e-6 * exact), `STEP read back: ${back.bodies[0].volume}`);
});

test('IM8b refusals by name: set_casting with a face not on the part, a negative allowance, a shrink of 20 %, nothing given; a pattern of two bodies, of a wrought alloy, of a die-cast part, of a curved machined face', async () => {
  const b = block(100, 60, 20), s = { doc: b, bodies: bodiesOf(b) } as never as ChatState;
  for (const [args, re] of [[{ machined: ['n9.top'] }, /\[CASTING_FACE\] not a face of the part: n9\.top/], [{ allowance: -1 }, /\[CASTING_ALLOWANCE\]/], [{ shrink: 0.2 }, /\[CASTING_SHRINK\]/], [{}, /Give machined, allowance, shrink/]] as const) {
    const r = await dispatchTool(s, 'set_casting', args as Record<string, unknown>, evaluate); assert.ok(r.isError); assert.match(JSON.parse(r.content).error, re);
  }
  const set = await dispatchTool(s, 'features', { action: 'casting', machined: ['n1.top', 'n1.top'], allowance: 1.5 }, evaluate);
  assert.ok(!set.isError, set.content); assert.deepEqual(set.state.doc.casting, { version: 1, machined: ['n1.top'], machiningAllowance: 1.5 });
  const two = withNode(withNode(cast(b, 'a356'), { kind: 'sketch', profile: 'rectangle', min: [200, 0], max: [210, 10] }), { kind: 'extrude', sketch: 2, height: 5 } as never);
  for (const [d, code] of [[two, 'PATTERN_ONE_BODY'], [cast(b, 'al6061'), 'PATTERN_MATERIAL'], [cast(b, 'a380', undefined, 'die-casting'), 'PATTERN_NOT_CASTING']] as const) {
    const p = await patternOf(d, bodiesOf(d), evaluate); assert.ok(!p.ok && p.code === code, JSON.stringify(p));
  }
  const rod = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }), { kind: 'extrude', sketch: 0, height: 50 });
  const curved = cast(rod, 'a356', { version: 1, machined: ['n1.side0'] }), p = await patternOf(curved, bodiesOf(curved), evaluate);
  assert.ok(!p.ok && p.code === 'PATTERN_FACE' && /only flat faces/.test(p.message));
  assert.equal((await rule(curved, 'machining-allowance')).status, 'unknown');
});

test('IM8b cad-cli pattern: the saved block — exit 0, pattern.json (factor 1.012917, 2.286 mm on n1.top, NPTEL\'s pages) and pattern.step; a die-cast part — exit 1, PATTERN_NOT_CASTING', () => {
  const dir = mkdtempSync(join(tmpdir(), 'im8b-')), part = join(dir, 'block.bcad'), die = join(dir, 'die.bcad');
  writeFileSync(part, encodeStudioFile(cast(block(100, 60, 20), 'a356', { version: 1, machined: ['n1.top'] })));
  writeFileSync(die, encodeStudioFile(cast(block(100, 60, 20), 'a380', undefined, 'die-casting')));
  const cli = (...a: string[]) => spawnSync(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), 'pattern', ...a], { encoding: 'utf8', timeout: 120000 });
  let r = cli(part, '-o', join(dir, 'out'));
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const j = JSON.parse(readFileSync(join(dir, 'out/pattern.json'), 'utf8'));
  assert.deepEqual([j.format, j.shrink.factor, j.machining.mm, j.machining.faces, /lecture3/.test(j.shrink.page), /lecture4/.test(j.machining.page)], ['barocss-pattern', 1.012917, 2.286, ['n1.top'], true, true]);
  assert.ok(existsSync(join(dir, 'out/pattern.step')) && readFileSync(join(dir, 'out/pattern.step'), 'utf8').startsWith('ISO-10303-21;'));
  r = cli(die, '-o', join(dir, 'none')); assert.equal(r.status, 1); assert.match(r.stdout, /PATTERN_NOT_CASTING/);
});

test('IM8b the uniform factor said as a simplification (O109): a 1500 × 100 × 100 aluminium bar — one factor by its largest extent (0.143/12, 4–6 ft), and each dimension\'s own band where they differ (Y, Z 0.155/12); pattern.json lists them', async () => {
  const d = cast(block(1500, 100, 100), 'a356'), sh = await rule(d, 'shrink');
  assert.equal(sh.value, 1.011917);
  assert.match(sh.message, /a simplification: one factor by the largest extent — a pattern maker may scale each dimension by its own band \(X 1\.011917, 4 ft to 6 ft; Y 1\.012917, up to 4 ft; Z 1\.012917, up to 4 ft\)/, sh.message);
  const p = await patternOf(d, bodiesOf(d), evaluate); assert.ok(p.ok);
  assert.deepEqual(p.file.shrink.byDimension.map(x => [x.axis, x.factor]), [['X', 1.011917], ['Y', 1.012917], ['Z', 1.012917]]);
  assert.match(p.file.shrink.simplification, /one factor by the largest extent/);
  // (One band throughout: said a simplification, no list.)
  assert.doesNotMatch((await rule(cast(block(100, 60, 20), 'a356'), 'shrink')).message, /\(X /);
});
