import test from 'node:test';
import assert from 'node:assert/strict';
import type { CadLibraryInterface } from '@barocss/cad';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { insertLibraryPart, libraryInstance, memberInterfaces, snapByInterfaces } from '../src/library/libraries';
import { BASE, rotationMatrix } from '../src/assembly/mates';

// FRe (O120): a T-slot frame member's interfaces, read off its faces, are tslot-20's own profile's — every slot, end and
// face frame the same in each one's section coordinates (20×20 with four slots open, and 20×40 with six) — and a slot
// nut snapped 100 along a member's top slot sits where the same nut snapped onto the library's profile sits, held by
// mates on faces the member has. A member of another section has none; a missing interface is refused, the rest named.

type V = [number, number, number];
const TSLOT = { size: 20, opening: 6.2, lip: 1.8, undercut: 11, depth: 6.1, bore: 4.2 };
const member = (cells: 1 | 2): StudioDoc => withNode(emptyDoc(), { kind: 'frame-member', section: { kind: 'tslot', cells, ...(cells === 1 ? { openSlots: 4 } : {}), ...TSLOT }, start: [0, 0, 0], end: [0, 0, 300] } as never);
const profile = (cells: 1 | 2): StudioDoc => insertLibraryPart(emptyDoc(), 'tslot-20', 'profile', { variant: cells === 1 ? '2020' : '2040', params: { L: 300 } });
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: readonly unknown[]): V => { const n = v as number[], l = Math.hypot(n[0], n[1], n[2]); return [n[0] / l, n[1] / l, n[2] / l]; };
/** A part's section basis: its first cell's centre at the start, X, Y across, A along (the library profile's is the world's). */
interface Basis { O: V; X: V; Y: V; A: V }
const toSection = (b: Basis, p: readonly number[]): V => { const d = [p[0] - b.O[0], p[1] - b.O[1], p[2] - b.O[2]]; return [dot(d, b.X), dot(d, b.Y), dot(d, b.A)]; };
const dirIn = (b: Basis, v: readonly unknown[]): V => { const u = unit(v); return [dot(u, b.X), dot(u, b.Y), dot(u, b.A)]; };
const near = (a: readonly number[], b: readonly number[], what: string) => assert.ok(a.every((x, k) => Math.abs(x - b[k]) <= 1e-9), `${what}: ${a} vs ${b}`);
const WORLD: Basis = { O: [0, 0, 0], X: [1, 0, 0], Y: [0, 1, 0], A: [0, 0, 1] };
const basisOf = (itf: readonly CadLibraryInterface[]): Basis => {
  const by = (id: string) => itf.find(i => i.id === id)!;
  return { O: by('end0').frame.origin as V, X: unit(by('face-right').frame.z), Y: unit(by('face-top').frame.z), A: unit(by('end1').frame.z) };
};

for (const cells of [1, 2] as const) test(`FRe a T-slot member's interfaces are tslot-20's profile's (${cells === 1 ? '20×20, four slots open' : '20×40, six slots'}): every id, role and accepts, and every frame the same in its section`, () => {
  const lib = (profile(cells).nodes.find(n => n.kind === 'library') as { interfaces: CadLibraryInterface[] }).interfaces;
  const [m] = memberInterfaces(member(cells)); assert.ok(m, 'the member has interfaces');
  const libIds = lib.filter(i => !i.when || (cells === 2 ? true : !/cells == 2$/.test(i.when))).map(i => i.id).sort();
  assert.deepEqual(m.interfaces.map(i => i.id).sort(), libIds);
  const B = basisOf(m.interfaces);
  for (const i of m.interfaces) {
    const l = lib.find(x => x.id === i.id)!;
    assert.deepEqual([i.role, i.accepts], [l.role, l.accepts], i.id);
    near(toSection(B, i.frame.origin as number[]), toSection(WORLD, l.frame.origin as number[]), `${i.id} origin`);
    near(dirIn(B, i.frame.z), dirIn(WORLD, l.frame.z), `${i.id} z`); near(dirIn(B, i.frame.x), dirIn(WORLD, l.frame.x), `${i.id} x`);
  }
});

test('FRe a slot nut snapped 100 along the top slot sits where it sits on tslot-20\'s own profile (position and turn, in each one\'s section); its mates on faces the member has', () => {
  const place = (base: StudioDoc, itf: string) => {
    const withNut = libraryInstance(base, 'tslot-20', 'slot-nut-m5'), r = snapByInterfaces(withNut.doc, { part: BASE, interface: itf }, { part: withNut.id, interface: 'seat' }, [100, 0, 0]);
    assert.ok(!('error' in r), JSON.stringify(r));
    const inst = r.doc.instances!.find(i => i.id === withNut.id)!;
    return { position: inst.position, R: rotationMatrix(inst.rotation), mates: r.mates };
  };
  const onLib = place(profile(1), 'slot-t1'), doc = member(1), [m] = memberInterfaces(doc), onMember = place(doc, `${m.body}.slot-t1`), B = basisOf(m.interfaces);
  near(toSection(B, onMember.position), toSection(WORLD, onLib.position), 'the nut\'s position');
  for (let j = 0; j < 3; j++) near(dirIn(B, [onMember.R[j], onMember.R[3 + j], onMember.R[6 + j]]), dirIn(WORLD, [onLib.R[j], onLib.R[3 + j], onLib.R[6 + j]]), `the nut's axis ${j}`);
  const faces = new Set(evaluateDoc(doc, 1).ok ? (evaluateDoc(doc, 1) as { bodies: { mesh: { faces: { name: string }[] } }[] }).bodies[0].mesh.faces.map(f => f.name) : []);
  assert.ok(onMember.mates.length >= 1 && onMember.mates.every(x => faces.has(x.a.face)), JSON.stringify(onMember.mates));
});

test('FRe a member of another section has no interfaces; a missing one is refused with the part\'s interfaces named', () => {
  const rhs = withNode(emptyDoc(), { kind: 'frame-member', section: { kind: 'rect-tube', width: 20, height: 20, wall: 2, outerRadius: 0 }, start: [0, 0, 0], end: [0, 0, 300] } as never);
  assert.deepEqual(memberInterfaces(rhs), []);
  const withNut = libraryInstance(member(1), 'tslot-20', 'slot-nut-m5'), r = snapByInterfaces(withNut.doc, { part: BASE, interface: 'b0.slot-t9' }, { part: withNut.id, interface: 'seat' });
  assert.ok('error' in r && /has no interface b0\.slot-t9 \(interfaces: .*\.slot-t1, .*\.end0/.test(r.error), JSON.stringify(r));
});

test('FRe through the chat: get_assembly lists the member\'s interfaces (b0.slot-t1 …), insert_part and snap_part put a nut in its top slot 50 along — the same place as the model call', async () => {
  const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
  let s = { doc: member(1), bodies: (evaluateDoc(member(1), 1) as { bodies: never[] }).bodies } as never as import('../src/chat/tools').ChatState;
  const { dispatchTool } = await import('../src/chat/tools');
  const listed = JSON.parse((await dispatchTool(s, 'get_assembly', {}, evaluate)).content);
  assert.ok(listed.base.member_interfaces.includes('b0.slot-t1 (t-slot ⇄ slot-nut)') && listed.base.member_interfaces.includes('b0.end1 (profile-end ⇄ end-cap)'), JSON.stringify(listed.base));
  let r = await dispatchTool(s, 'insert_part', { library: 'tslot-20', part: 'slot-nut-m5' }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  r = await dispatchTool(s, 'snap_part', { a: { part: 'base', interface: 'b0.slot-t1' }, b: { part: 'p1', interface: 'seat' }, offset: [50, 0, 0] }, evaluate); assert.ok(!r.isError, r.content);
  const viaModel = snapByInterfaces(libraryInstance(member(1), 'tslot-20', 'slot-nut-m5').doc, { part: BASE, interface: 'b0.slot-t1' }, { part: 'p1', interface: 'seat' }, [50, 0, 0]);
  assert.ok(!('error' in viaModel));
  near(r.state.doc.instances![0].position, viaModel.doc.instances![0].position, 'the same place');
});
