import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '../src/api';
import { evaluateDoc } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { commands, type Ctx } from '../src/app/commands';
import type { StudioDoc } from '../src/engine/doc';

const source: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] },
  { id: 'n1', kind: 'loft', from: [0, 0], sections: [{ sketch: 0, z: 0 }, { sketch: 0, z: 20 }],
    guide: { kind: 'nurbs', degree: 5, knots: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
      controlPoints: [[0, 0, 0], [0, 0, 4], [2, 0, 8], [-2, 0, 12], [0, 0, 16], [0, 0, 20]] } },
], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
// Independent Simpson integral of sqrt(400 + (40t-240t²+400t³-200t⁴)²), 16384 intervals.
const expected = 8000 - 0.5 ** 2 * (1 - Math.PI / 4) * 20.06333624702397;
function verify(doc: StudioDoc): void {
  const result = evaluateDoc(doc, 1);
  assert.ok(result.ok, result.ok ? '' : result.error.detail);
  assert.equal(result.bodies.length, 1);
  const volume = result.bodies[0].volume;
  assert.ok(volume !== null && Math.abs(volume - expected) <= 1e-9 * expected, `${volume} vs ${expected}`);
}

test('polynomial face fillet: public API stores named faces and signatures and survives save/open', async () => {
  const base = part('guided loft', source), before = structuredClone(base.doc);
  const made = base.faceFillet(body => body.faces().where(face => face.name === 'n1.side0' || face.name === 'n1.side3'), { radius: 0.5 });
  const node = made.doc.nodes.at(-1);
  assert.ok(node?.kind === 'face-fillet');
  assert.deepEqual([...node.faces].sort(), ['n1.side0', 'n1.side3']);
  assert.ok(node.faces.every(name => node.sigs?.[name]));
  verify(made.doc);
  const opened = await readStudioFile(encodeStudioFile(made.doc));
  assert.ok('doc' in opened, JSON.stringify(opened));
  // Computed face signatures can contain -0; the JSON container writes it as 0.
  assert.deepEqual(opened.doc, JSON.parse(JSON.stringify(made.doc)));
  verify(opened.doc); assert.deepEqual(base.doc, before);
});

test('polynomial face fillet: the Studio command accepts the curved face and uses the same authored references', () => {
  const result = evaluateDoc(source, 1);
  assert.ok(result.ok, result.ok ? '' : result.error.detail);
  const faces = result.bodies[0].mesh.faces;
  const selection = ['n1.side0', 'n1.side3'].map(name => ({ body: 0, face: faces.findIndex(face => face.name === name) }));
  assert.ok(selection.every(pick => pick.face >= 0));
  const context: Ctx = { doc: source, bodies: result.bodies, selection: { faces: selection, edges: [], bodies: [] } };
  const command = commands.find(candidate => candidate.id === 'face-fillet')!;
  assert.equal(command.available(context).ok, true);
  const built = command.build!(context, { r: 0.5 });
  const node = built.nodes.at(-1); assert.ok(node?.kind === 'face-fillet');
  assert.deepEqual([...node.faces].sort(), ['n1.side0', 'n1.side3']); verify(built);
});
