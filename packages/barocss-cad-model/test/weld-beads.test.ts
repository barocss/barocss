import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { beadIdOf, beadsOf } from '../src/engine/part';
import { weldList, weldListTable, type WeldRecord } from '../src/frames/welds';
import { bomPanelDataOf } from '../src/bom/bom';

// FRk2 (D166), the outer lane's side (queue 5b): the person's O118 weld records become the kernel's weld beads. The
// kernel's frk/ scenes built from records, not from features: the 40 rail's bead on the 80 post 756 mm³, on the 40
// post (flush sides) 360, the clipped gusset's two seams (105 + 85)·z² = 1710; each the joint's bead, with its leg and
// throat. A mitre set to fillet and an oblique brace are refused by the kernel — said on the joint and in the weld
// list, the part still evaluates; a mitre's or a cap's record with no kind is no bead, quietly. Beads weigh, no BOM line.
const conf = (name: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, '../../barocss-cad/conformance/frk', `${name}.json`), 'utf8')) as { input: { partDocument: { features: Record<string, unknown>[] } }; expect: { outputs: { volumeMM3: { value: number } }[] } };
const ok = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r; };
/** The scene's frame (and gusset) as studio nodes, from the conformance case's features. */
function scene(name: string): StudioDoc {
  const fs = conf(name).input.partDocument.features;
  let doc = emptyDoc();
  for (const f of fs) {
    const { id: _id, ...rest } = f; void _id;
    if (f.kind === 'frame') doc = withNode(doc, rest as never);
    if (f.kind === 'gusset') doc = withNode(doc, { ...rest, frame: 0 } as never);
  }
  return doc;
}
const withWelds = (doc: StudioDoc, welds: WeldRecord[]): StudioDoc => ({ ...doc, frames: { version: 1, ...(doc.frames ?? {}), welds } });

test('5b: the kernel\'s frk scenes from records — a rail\'s bead on the 80 post 756 mm³, on the 40 post 360 (its flush sides none), the clipped gusset\'s seams 1710; each its joint\'s bead (leg 3, throat 3/√2); beads weigh, no BOM line', () => {
  for (const [name, want] of [['bead-tee-wide-post', 756], ['bead-tee-flush', 360]] as const) {
    const doc = scene(name), joints = weldList(doc, ok(doc).bodies).joints, j = joints.find(x => x.kind === 'butt')!;
    assert.ok(j, `${name}: the rail's butt joint`);
    const welded = withWelds(doc, [{ joint: j.id, size: 3 }]), r = ok(welded);
    const bead = r.bodies.find(b => b.key === beadIdOf(j.id))!;
    assert.ok(bead && bead.element?.kind === 'weld-bead', `${name}: the bead's body`);
    assert.ok(Math.abs(bead.volumeMM3! - want) < 1e-9 * want, `${name}: ${bead.volumeMM3}`);
    assert.ok(Math.abs(bead.volumeMM3! - conf(name).expect.outputs[2].volumeMM3.value) < 1e-9 * want, 'the kernel\'s own case');
    const jj = weldList(welded, r.bodies).joints.find(x => x.id === j.id)!;
    assert.ok(jj.bead && !('refused' in jj.bead) && jj.bead.legMM === 3 && Math.abs(jj.bead.throatMM - 3 / Math.SQRT2) < 1e-6 && Math.abs(jj.bead.volumeMM3 - want) < 1e-6, JSON.stringify(jj.bead));
    // (A bead weighs; it is no BOM line.)
    const bom = bomPanelDataOf(welded, d => evaluateDoc(d, 1), 'frame');
    assert.ok(!bom.bom.lines.some(l => /bead/.test(l.item)), 'no BOM line for a bead');
    // (Its volume in the part's bodies: what the part's mass is summed over.)
    assert.ok(r.bodies.reduce((t, b) => t + (b.volumeMM3 ?? 0), 0) - ok(doc).bodies.reduce((t, b) => t + (b.volumeMM3 ?? 0), 0) > want - 1e-6);
  }
  // (The gusset: its two seam joints, a bead each — together the kernel's one bead of 1710.)
  const doc = scene('bead-gusset'), joints = weldList(doc, ok(doc).bodies).joints.filter(x => x.kind === 'gusset');
  assert.equal(joints.length, 2);
  const welded = withWelds(doc, joints.map(j => ({ joint: j.id, size: 3 }))), r = ok(welded);
  const beads = weldList(welded, r.bodies).joints.filter(x => x.kind === 'gusset').map(x => x.bead);
  assert.ok(beads.every(b => b && !('refused' in b)), JSON.stringify(beads));
  // (Both joints name the one gusset: the kernel welds all its seams in one bead, so one feature — the first joint's — and both read it.)
  const vol = (beads[0] as { volumeMM3: number }).volumeMM3;
  assert.ok(Math.abs(vol - 1710) < 1e-6, String(vol));
});

test('5b: refusals said on the joint, the part still evaluating — a mitre set to fillet (BEAD_KIND), an oblique brace (BEAD_ANGLE); unset on a mitre or a cap: no bead, quietly; no size: no bead', () => {
  const mitre = scene('refuse-bead-mitre'), mj = weldList(mitre, ok(mitre).bodies).joints.find(x => x.kind === 'mitre')!;
  const set = withWelds(mitre, [{ joint: mj.id, kind: 'fillet', size: 3 }]), r = ok(set), j = weldList(set, r.bodies).joints.find(x => x.id === mj.id)!;
  assert.ok(j.bead && 'refused' in j.bead && /\[BEAD_KIND\] member 0's end is mitred/.test(j.bead.refused), JSON.stringify(j.bead));
  assert.ok(weldListTable(weldList(set, r.bodies), new Map()).notes!.some(n => /^W1: no bead — \[BEAD_KIND\]/.test(n)));
  // (Unset on the mitre: its default is a groove weld — no bead, nothing said.)
  const unset = withWelds(mitre, [{ joint: mj.id, size: 3 }]), ru = ok(unset), ju = weldList(unset, ru.bodies).joints.find(x => x.id === mj.id)!;
  assert.equal(ju.bead, undefined); assert.equal(ju.weld.kind, 'butt');
  // (The 60° brace: refused by angle, said.)
  const brace = scene('refuse-bead-angle'), bj = weldList(brace, ok(brace).bodies).joints.find(x => x.kind === 'butt')!;
  const bset = withWelds(brace, [{ joint: bj.id, size: 3 }]), rb = ok(bset), jb = weldList(bset, rb.bodies).joints.find(x => x.id === bj.id)!;
  assert.ok(jb.bead && 'refused' in jb.bead && /\[BEAD_ANGLE\]/.test(jb.bead.refused), JSON.stringify(jb.bead));
  // (No size set: no bead at all.)
  assert.deepEqual(beadsOf(withWelds(brace, [{ joint: bj.id }])), []);
});
