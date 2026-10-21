import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { flatPatternDxf, writeDxf } from '@barocss/cad';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';

// R12.5 (D121): the RB9 ladder's sheet-metal rungs — 5, an L-bracket, and 10, a PCB enclosure — built by the agent's
// tools from the calls in test/fixtures (the flow sends the same calls through the real chat). Acceptance by closed forms
// of the outside dimensions and the sheet's rules, none read from the build: the volume, the flat's size, its holes, its
// bends; the kernel's conformance cases r12/accept-* hold the same part documents (WRITE_ACCEPTANCE=1 rewrites them).
const root = process.cwd(), conformance = join(root, '../../packages/barocss-cad/conformance/r12');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function build(name: string): Promise<ChatState> {
  const { calls } = JSON.parse(readFileSync(join(root, 'test/fixtures', `${name}.calls.json`), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  // (One turn on an empty part: the first build, applied directly at L2, D41.)
  let state: ChatState = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() };
  for (const c of calls) { const r = await dispatchTool(state, c.tool, c.args, evaluate); assert.ok(!r.isError, `${c.tool}: ${r.content}`); state = r.state; }
  return state;
}
const T = 1.5, R = 1.5, K = 0.44, th = Math.PI / 2, BD = 2 * (R + T) * Math.tan(th / 2) - th * (R + K * T);
const close = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
/** The kernel's conformance case of a part the agent built: its part document, and what it must give. */
function caseFile(name: string, doc: StudioDoc, about: string, expect: object, oracle: string) {
  const file = join(conformance, `${name}.json`), partDocument = toPartDocument(doc);
  if (process.env.WRITE_ACCEPTANCE) writeFileSync(file, JSON.stringify({ id: `r12-${name}`, step: 'R12', decisions: ['D121'], about, input: { partDocument }, expect, oracle }, null, 2) + '\n');
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).input.partDocument, JSON.parse(JSON.stringify(partDocument)), `${name}: the conformance case holds the part the agent built`);
}

test('RB9 rung 5 (D121): the sheet-metal L-bracket by the agent — one body; the volume, the flat (70 − BD) × 30 with its two holes, one bend, by closed forms; its DXF', async () => {
  const s = await build('sheet-l-bracket'), [b] = s.bodies, r = 2.75, W = 30;
  assert.equal(s.bodies.length, 1);
  // The middle line: 40 + 30 less the bend's 2(R + T)·tan 45° plus its middle arc; two holes T deep.
  const mid = 40 + 30 - 2 * (R + T) + th * (R + T / 2), V = W * T * mid - 2 * Math.PI * r * r * T;
  close(b.volumeMM3!, V, 1e-9, 'volume');
  const f = b.flat!;
  close(Math.max(...f.box.max), 70 - BD, 1e-12, 'flat length'); close(Math.min(...f.box.max), W, 1e-12, 'flat width');
  assert.equal(f.loops.length, 3);
  assert.deepEqual(f.loops.filter(l => !l.outer).map(l => l.segments.map(x => x.kind === 'arc' ? +x.radius.toFixed(12) : x.kind)), [[2.75], [2.75]]);
  assert.deepEqual(f.bends.map(x => [x.direction, +x.angleDegrees.toFixed(9), +x.radiusMM.toFixed(12)]), [['down', 90, 1.5]]);
  close(f.areaMM2, (70 - BD) * W - 2 * Math.PI * r * r, 1e-12, 'flat area');
  const text = writeDxf(flatPatternDxf(f), {}).text;
  assert.equal(text.match(/\nCIRCLE\r?\n/g)?.length, 2); assert.equal(text.match(/\nTEXT\r?\n/g)?.length, 1);
  caseFile('accept-l-bracket', s.doc, 'RB9 rung 5 (R12.5): the sheet-metal L-bracket the agent builds (test/fixtures/sheet-l-bracket.calls.json): legs 40 and 30 outside, 30 wide, 1.5 sheet, R 1.5, K 0.44, a Ø5.5 hole in each leg.',
    { outputs: [{ volumeMM3: { value: V, relTol: 1e-9 }, centroidMM: { value: b.centroid, absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 2 }],
      flat: { areaMM2: { value: (70 - BD) * W - 2 * Math.PI * r * r, relTol: 1e-12 }, loops: 3, bends: [{ name: 'n0.bend1', direction: 'down', angleDegrees: 90 }] } }], stepRoundTrip: { relTol: 1e-9 } },
    'Closed form: the middle line 70 − 2(R + T) + (π/2)(R + T/2) × 30 × T less two holes; the flat (70 − BD) × 30 less two holes. Centroid by this kernel.');
});

test('RB9 rung 10 (D121): the sheet-metal PCB enclosure by the agent — corner reliefs, four flanges, four standoff holes, a connector slot; the volume and the flat (100 + 2(25 − BD)) × (70 + 2(25 − BD)) with six loops, four bends up', async () => {
  const s = await build('sheet-pcb-enclosure'), [b] = s.bodies, A = 100, B = 70, h = 25, cs = 3, t = R + T, r = 1.6;
  assert.equal(s.bodies.length, 1);
  // The plate less four reliefs; each flange on its edge less two reliefs: its trim off, its section on; the holes and the slot.
  const V = A * B * T - 4 * cs * cs * T + [A, B, A, B].reduce((v, L) => v - t * T * (L - 2 * cs) + (L - 2 * cs) * (th * T * (R + T / 2) + (h - t) * T), 0) - 4 * Math.PI * r * r * T - 20 * 8 * T;
  close(b.volumeMM3!, V, 1e-9, 'volume');
  const f = b.flat!, Lx = A + 2 * (h - BD), Ly = B + 2 * (h - BD);
  close(f.box.max[0], Lx, 1e-12, 'flat length'); close(f.box.max[1], Ly, 1e-12, 'flat width');
  assert.equal(f.loops.length, 6);
  assert.deepEqual(f.bends.map(x => x.direction), ['up', 'up', 'up', 'up']);
  close(f.areaMM2, V / T + (K - 0.5) * T * th * (2 * (A + B) - 8 * cs), 1e-11, 'flat area by the K-factor\'s identity');
  const doc = flatPatternDxf(f);
  assert.deepEqual(['OUTLINE', 'BEND_UP', 'BEND_DOWN', 'BEND_NOTES'].map(l => doc.entities.filter(e => e.layer === l).length), [f.loops.reduce((n, l) => n + l.segments.length, 0), 4, 0, 4]);
  caseFile('accept-pcb-enclosure', s.doc, 'RB9 rung 10 (R12.5): the sheet-metal PCB enclosure the agent builds (test/fixtures/sheet-pcb-enclosure.calls.json): 100 × 70 base, 1.5 sheet, R 1.5, K 0.44, 3 mm square corner reliefs, 25 mm flanges, four Ø3.2 holes, a 20 × 8 slot in the front flange.',
    { outputs: [{ volumeMM3: { value: V, relTol: 1e-9 }, centroidMM: { value: b.centroid, absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 5 }],
      flat: { areaMM2: { value: V / T + (K - 0.5) * T * th * (2 * (A + B) - 8 * cs), relTol: 1e-9 }, box: { value: [Lx, Ly], absTol: 1e-9 }, loops: 6, bends: ['n6', 'n7', 'n8', 'n9'].map(n => ({ name: `${n}.bend`, direction: 'up', angleDegrees: 90 })) } }], stepRoundTrip: { relTol: 1e-9 } },
    'Closed form: the plate less the reliefs, each flange its edge less 2 × 3 long (trim off, section on), less the holes and the slot; the flat by the textbook BD and the K-factor\'s area identity on that volume. Centroid by this kernel.');
});
