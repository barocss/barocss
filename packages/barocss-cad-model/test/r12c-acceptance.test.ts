import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { massPropertiesOf, evaluateCadPart, type CadPartSnapshot } from '@barocss/cad';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { toPartDocument } from '../src/engine/part';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// R12c.8 (D163): R12c's acceptance — a gearbox output shaft and a spring-loaded plunger, each built by the agent's v2
// tools in one turn from the calls in test/fixtures (the flow sends the same calls through the real chat), the user's
// rows loaded first (the agent cannot load rows). Accepted by closed forms written here, none read from the build:
// - the shaft by Pappus, π∫r(z)²dz over its half-section — the fillets r_s + ρ − √(ρ² − (z − z_c)²) in the concave
//   corners, the chamfers linear — by Simpson, less the groove π(R² − r_g²)w and the end-milled keyseat
//   (l − b)∫(√(R² − x²) − (R − t))dx + ∫2√((b/2)² − x²)(√(R² − x²) − (R − t))dx;
// - the keyed gear: the gear alone (this kernel: its generated root has no closed form here) less the keyway's
//   L∫_{|v|≤b/2}(r + t2 − √(r² − v²))dv; the key (l − b)bh + π(b/2)²h; the ring π(R² − r²)s;
// - each bearing's rounded section turned (Pappus: the rectangle less four corner spandrels at their centroids);
// - the cover π(R² − r²)h less the rod gland's groove π(R_g² − r²)w; the O-ring 2π²(ID/2 + r)r² (its volume kept as it
//   stretches); squeeze (CS' − h)/CS' and fill πCS'²/4/(w·h) with r'²(R_b + r') = r²(ID/2 + r) by bisection;
// - the spring's rate Gd⁴/(8D³n), its solid pitch p_s where one turn's centreline comes a wire Ø from the next (solved
//   here: the least chord between θ and θ + φ, φ near 2π, equals d), solid height n_t p_s and free length 2p_s + n_a p;
//   its volume D153's closed form for these sizes (conformance r12c/spring-closed-ground, 1541.1998773);
// - the housing π15²·50 − π12²·40, the plunger π11.5²·15; no overlap anywhere (the agent's interference query).
// The kernel's conformance cases r12c/accept-* hold the same part documents (WRITE_ACCEPTANCE=1).
const root = resolve(import.meta.dirname, '..'), conformance = join(root, '../../packages/barocss-cad/conformance/r12c');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function build(name: string): Promise<{ state: ChatState; results: string[] }> {
  const f = JSON.parse(readFileSync(join(root, 'test/fixtures', `${name}.calls.json`), 'utf8')) as { rows: Partial<StudioDoc>; calls: { tool: string; args: Record<string, unknown> }[] };
  let state: ChatState = { doc: { ...emptyDoc(), ...f.rows }, bodies: [] };
  const results: string[] = [];
  for (const c of f.calls) { const r = await dispatchTool(state, c.tool, c.args, evaluate); assert.ok(!r.isError, `${c.tool}: ${r.content}`); state = r.state; results.push(r.content); }
  return { state, results };
}
const close = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const out = (snap: CadPartSnapshot, id: string) => { const o = snap.outputs.find(x => x.id === id); assert.ok(o, id); return o!; };
const vol = (snap: CadPartSnapshot, id: string) => massPropertiesOf(out(snap, id), 1).volume;
const notesOf = (s: ChatState, node: number) => (s.bodies.find(b => b.ref?.node === node)?.notes ?? []).map(n => n.text);
/** ∫f over [a, b] by Simpson on n intervals. */
function simpson(f: (x: number) => number, a: number, b: number, n = 20000): number { const h = (b - a) / n; let s = 0; for (let i = 0; i < n; i++) { const x = a + i * h; s += h / 6 * (f(x) + 4 * f(x + h / 2) + f(x + h)); } return s; }
function caseFile(name: string, doc: StudioDoc, about: string, expect: object, oracle: string) {
  const file = join(conformance, `${name}.json`), partDocument = toPartDocument(doc);
  if (process.env.WRITE_ACCEPTANCE) writeFileSync(file, JSON.stringify({ id: `r12c-${name}`, step: 'R12c', decisions: ['D163'], about, input: { partDocument }, expect, oracle }, null, 2) + '\n');
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).input.partDocument, JSON.parse(JSON.stringify(partDocument)), `${name}: the conformance case holds the part the agent built`);
}
const ONE = (v: number, relTol: number, c: number[], absTol: number, genus: number) => ({ volume: { value: v, relTol }, centroid: { value: c, absTol }, bodies: 1, topology: [{ shells: 1, genus }] });

test('R12c.8 the gearbox output shaft by the agent: the shaft by Pappus less its groove and keyseat, the keyed gear, the key, two bearings on their seats against the Ø25 shoulders, the ring, the sealed cover and its O-ring — each by its closed form; only the O-ring\'s squeeze overlaps, by Pappus on its segment', async () => {
  const { state, results } = await build('r12c-gearbox-shaft');
  assert.equal(state.bodies.length, 8);
  const snap = evaluateCadPart(toPartDocument(state.doc));
  // The shaft: steps Ø20 0–14, Ø25 14–44, Ø20 44–74, Ø25 74–94; fillets 0.5 in the concave corners (on the Ø20 side), chamfers 0.5 at the ends.
  const rho = 0.5, c = 0.5, fillet = (rs: number, zc: number) => (z: number) => rs + rho - Math.sqrt(Math.max(0, rho * rho - (z - zc) ** 2));
  const pieces: [number, number, (z: number) => number][] = [
    [0, c, z => 9.5 + z], [c, 14 - rho, () => 10], [14 - rho, 14, fillet(10, 14 - rho)], [14, 44, () => 12.5],
    [44, 44 + rho, fillet(10, 44 + rho)], [44 + rho, 74 - rho, () => 10], [74 - rho, 74, fillet(10, 74 - rho)], [74, 94 - c, () => 12.5], [94 - c, 94, z => 12.5 - (z - (94 - c))]];
  let shaft = 0, shaftZ = 0;
  for (const [a, b, r] of pieces) { shaft += Math.PI * simpson(z => r(z) ** 2, a, b); shaftZ += Math.PI * simpson(z => z * r(z) ** 2, a, b); }
  const groove = Math.PI * (100 - 9.5 ** 2) * 1.3, R = 12.5, t = 4, bk = 8, lk = 18, depth = (x: number) => Math.sqrt(R * R - x * x) - (R - t);
  const keyseat = (lk - bk) * simpson(depth, -bk / 2, bk / 2) + simpson(x => 2 * Math.sqrt(Math.max(0, (bk / 2) ** 2 - x * x)) * depth(x), -bk / 2, bk / 2);
  const shaftV = shaft - groove - keyseat;
  close(vol(snap, 'n0'), shaftV, 1e-7, 'the shaft');
  // The gear alone less the keyway: L∫(r + t2 − √(r² − v²))dv over |v| ≤ b/2 (r 12.5, t2 3.3, L 20).
  const alone = massPropertiesOf(evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [toPartDocument(state.doc).features[1]] }).outputs.find(o => o.id === 'n1')!, 1).volume;
  const keyway = 20 * simpson(v => 12.5 + 3.3 - Math.sqrt(12.5 ** 2 - v * v), -4, 4);
  close(alone - vol(snap, 'n2'), keyway, 1e-7, 'the keyway');
  const dims = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [toPartDocument(state.doc).features[1]] }).outputs.find(o => o.id === 'n1')!.gear!.dimensions;
  close(dims.referenceDiameter, 60, 1e-12, 'pitch Ø m z'); close(dims.tipDiameter, 64, 1e-12, 'tip Ø m(z + 2)'); close(dims.rootDiameter, 55, 1e-12, 'root Ø m(z − 2.5)'); close(dims.baseDiameter, 60 * Math.cos(20 * Math.PI / 180), 1e-12, 'base Ø m z cos α');
  // The key (round ends), the ring, the bearings' sections turned.
  close(vol(snap, 'n3'), (18 - 8) * 8 * 7 + Math.PI * 16 * 7, 1e-9, 'the key');
  close(vol(snap, 'n6'), Math.PI * (144 - 9.5 ** 2) * 1.2, 1e-9, 'the ring');
  const ri = 10, ro = 23.5, B = 14, cr = 1, sp = (1 - Math.PI / 4) * cr * cr, off = cr * (10 - 3 * Math.PI) / (3 * (4 - Math.PI));
  const Abr = (ro - ri) * B - 4 * sp, Mx = (ro - ri) * B * (ri + ro) / 2 - 2 * sp * (ri + off) - 2 * sp * (ro - off), bearing = 2 * Math.PI * Mx;
  close(vol(snap, 'n4'), bearing, 1e-7, 'bearing B'); close(vol(snap, 'n5'), bearing, 1e-7, 'bearing A'); void Abr;
  const zs = (id: string) => out(snap, id).brep.vertices.map(v => v.point[2]);
  assert.deepEqual([Math.min(...zs('n4')), Math.max(...zs('n4')), Math.min(...zs('n5')), Math.max(...zs('n5'))].map(x => Math.round(x * 1e9) / 1e9), [0, 14, 44, 58]);
  assert.ok(notesOf(state, 5).includes('On step 3 from 44 to 58, against the Ø25 shoulder (fillet r 0.5); its other side by ring groove 1; no overlap with the shaft'), JSON.stringify(notesOf(state, 5)));
  assert.ok(notesOf(state, 3).some(t => /^Key 8 × 7 × 18 \(round ends\) in keyseat 1: 0 play in the seat's width/.test(t)), JSON.stringify(notesOf(state, 3)));
  // The cover and its rod gland on the Ø25 end; the ring stretched on the rod (R_b 12.5) keeps its volume.
  const Dg = 30.648, w = 4.4, h = (Dg - 25) / 2, r0 = 3.53 / 2, ID = 24.99;
  close(vol(snap, 'n9'), Math.PI * (35 ** 2 - 12.55 ** 2) * 10 - Math.PI * ((Dg / 2) ** 2 - 12.55 ** 2) * w, 1e-9, 'the cover');
  close(vol(snap, 'n10'), 2 * Math.PI ** 2 * (ID / 2 + r0) * r0 * r0, 1e-7, 'the O-ring');
  let lo = r0 / 4, hi = 4 * r0; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (m * m * (12.5 + m) < r0 * r0 * (ID / 2 + r0)) lo = m; else hi = m; }
  const cs = lo + hi, squeeze = (cs - h) / cs, fill = Math.PI * cs * cs / 4 / (w * h);
  assert.ok(notesOf(state, 9).includes(`Stretch 0 %, the section ${+cs.toFixed(4)} stretched; squeeze ${+(100 * (3.53 - h) / 3.53).toFixed(1)} % (${+(100 * squeeze).toFixed(1)} % stretched); fill ${+(100 * fill).toFixed(1)} %`), JSON.stringify(notesOf(state, 9)));
  // Nothing overlaps (the agent's own interference query).
  const pairs = (JSON.parse(results.at(-1)!) as { pairs: { overlap?: number; clearance?: number }[] }).pairs;
  // The one overlap is the ring's squeeze into its cover: the stretched ring on the rod (R' = 12.5 + r') beyond the groove's
  // bottom Ø30.648 — Pappus on that circular segment, V = 2π(R' + ȳ)A (A = r'² acos(c/r') − c√(r'² − c²), ȳ = (2/3)(r'² − c²)^{3/2}/A).
  const rp = cs / 2, Rp = 12.5 + rp, cc = Dg / 2 - Rp, Aseg = rp * rp * Math.acos(cc / rp) - cc * Math.sqrt(rp * rp - cc * cc), yseg = 2 / 3 * (rp * rp - cc * cc) ** 1.5 / Aseg, squeezed = 2 * Math.PI * (Rp + yseg) * Aseg;
  const over = (pairs as { a: string; b: string; overlap?: number }[]).filter(p => p.overlap);
  assert.ok(over.length === 1 && over[0].a === 'b9' && over[0].b === 'b10' && Math.abs(over[0].overlap! - squeezed) < 1e-3, `${JSON.stringify(over)} vs ${squeezed}`);
  assert.ok(notesOf(state, 10).some(t => t.includes(`overlaps what squeezes it by ${+squeezed.toFixed(4)} mm³`)), JSON.stringify(notesOf(state, 10)));
  caseFile('accept-gearbox-shaft', state.doc, 'R12c.8 acceptance (D163): a gearbox output shaft built by the agent in one turn — a stepped, keyed shaft with a ring groove; a keyed spur gear m2 z30; a key; two 6204 envelopes (B1) against the Ø25 shoulders; a retaining ring; a cover sealed by an AS568-214 rod gland (O1) and its ring.', { outputs: [
    ONE(shaftV, 1e-7, [massPropertiesOf(out(snap, 'n0'), 1).centroid[0], massPropertiesOf(out(snap, 'n0'), 1).centroid[1], (shaftZ - groove * (59 + 0.65) - keyseat * (20 + 9)) / shaftV], 2e-3, 0),
    ONE(vol(snap, 'n2'), 1e-6, massPropertiesOf(out(snap, 'n2'), 1).centroid, 1e-6, 1),
    ONE((18 - 8) * 8 * 7 + Math.PI * 16 * 7, 1e-9, massPropertiesOf(out(snap, 'n3'), 1).centroid, 1e-6, 0),
    ONE(bearing, 1e-7, [0, 0, 7], 1e-7, 1), ONE(bearing, 1e-7, [0, 0, 51], 1e-7, 1),
    ONE(Math.PI * (144 - 9.5 ** 2) * 1.2, 1e-9, [0, 0, 59.65], 1e-7, 1),
    ONE(Math.PI * (35 ** 2 - 12.55 ** 2) * 10 - Math.PI * ((Dg / 2) ** 2 - 12.55 ** 2) * w, 1e-9, massPropertiesOf(out(snap, 'n9'), 1).centroid, 1e-6, 1),
    ONE(2 * Math.PI ** 2 * (ID / 2 + r0) * r0 * r0, 1e-7, [0, 0, 80 + 2.8 + w / 2], 1e-6, 1)], stepRoundTrip: { relTol: 1e-6 } },
    'The shaft by Pappus over its half-section (fillets and chamfers, Simpson) less the groove and the end-milled keyseat, its z-centroid by moments (x and y, off the keyseat, by this kernel); the keyed gear by this kernel (its generated root has no closed form here; its keyway checked in the acceptance test against L∫(r + t2 − √(r² − v²))dv); the key (l − b)bh + π(b/2)²h; each bearing\'s rounded section turned; the ring π(R² − r²)s; the cover less the rod gland\'s groove; the O-ring 2π²(ID/2 + r)r², centred in its groove.');
});

test('R12c.8 the spring-loaded plunger by the agent: the housing and its bore, the spring standing on the bottom — its rate Gd⁴/(8D³n), its solid pitch solved here, solid height and free length — the plunger resting on its top; nothing overlaps', async () => {
  const { state, results } = await build('r12c-plunger');
  assert.equal(state.bodies.length, 3);
  const snap = evaluateCadPart(toPartDocument(state.doc)), d = 2, D = 20, na = 6, p = 5, G = 79300, k = G * d ** 4 / (8 * D ** 3 * na);
  // The solid pitch: the least chord between the centreline at θ and θ + φ (φ near 2π) is d. f(φ) = 4R² sin²(φ/2) + p²φ²/4π².
  const Rm = D / 2, least = (ps: number) => { let a = Math.PI, b = 3 * Math.PI; const f = (phi: number) => 4 * Rm * Rm * Math.sin(phi / 2) ** 2 + ps * ps * phi * phi / (4 * Math.PI ** 2); for (let i = 0; i < 200; i++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (f(m1) < f(m2)) b = m2; else a = m1; } return Math.sqrt(f((a + b) / 2)); };
  let lo = d, hi = 2 * d; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (least(m) < d) lo = m; else hi = m; }
  const ps = (lo + hi) / 2, nt = na + 2, L0 = 2 * ps + na * p;
  close(ps, 2.001013985863015, 1e-9, 'the solid pitch (D153\'s figure)');
  const sn = notesOf(state, 3);
  assert.ok(sn.some(t => t.includes(`free length ${+L0.toFixed(3)} mm`)) && sn.some(t => t.startsWith(`Solid height ${+(nt * ps).toFixed(4)} mm (turns a wire Ø apart at pitch ${+ps.toFixed(3)})`)) && sn.some(t => t.startsWith(`Rate ${+k.toFixed(4)} N/mm`)), JSON.stringify(sn));
  close(vol(snap, 'n2'), Math.PI * 225 * 50 - Math.PI * 144 * 40, 1e-9, 'the housing less its bore');
  close(vol(snap, 'n3'), 1541.1998773110126, 4e-4, 'the spring (D153\'s closed form)');
  close(vol(snap, 'n5'), Math.PI * 11.5 ** 2 * 15, 1e-9, 'the plunger');
  const sz = out(snap, 'n3').brep.vertices.map(v => v.point[2]);
  close(Math.min(...sz), 10, 1e-9, 'on the bore\'s bottom'); close(Math.max(...sz), 10 + L0, 1e-6, 'its top at the free length');
  // Radial room in the bore: (24 − (D + d))/2 = 1.
  assert.equal((24 - (D + d)) / 2, 1);
  const pairs = (JSON.parse(results.at(-1)!) as { pairs: { a: string; b: string; overlap?: number; clearance?: number }[] }).pairs;
  assert.ok(pairs.length === 3 && pairs.every(x => !(x.overlap! > 1e-6)) && pairs.filter(x => (x.clearance ?? 1) < 1e-3).length === 2, JSON.stringify(pairs));
  caseFile('accept-plunger', state.doc, 'R12c.8 acceptance (D163): a spring-loaded plunger built by the agent in one turn — a Ø30 × 50 housing with a Ø24 blind bore 40 deep; a closed and ground compression spring (wire Ø2, mean Ø20, 6 active coils, pitch 5) on the bore\'s bottom; a Ø23 × 15 plunger on its top.', { outputs: [
    ONE(Math.PI * 225 * 50 - Math.PI * 144 * 40, 1e-9, [0, 0, (Math.PI * 225 * 50 * 25 - Math.PI * 144 * 40 * 30) / (Math.PI * 225 * 50 - Math.PI * 144 * 40)], 1e-7, 0),
    ONE(1541.1998773110126, 4e-4, massPropertiesOf(out(snap, 'n3'), 1).centroid, 0.005, 0),
    ONE(Math.PI * 11.5 ** 2 * 15, 1e-9, [0, 0, 44.002 + 7.5], 1e-7, 0)], stepRoundTrip: { relTol: 1e-6 } },
    'The housing π15²·50 less the bore π12²·40, its centroid by moments; the spring D153\'s closed form πa²S − (4/3)a³R/h_s for these sizes (conformance r12c/spring-closed-ground; the fit\'s bound 4e-4), its centroid by this kernel to 0.005; the plunger π11.5²·15 centred on its axis.');
});
