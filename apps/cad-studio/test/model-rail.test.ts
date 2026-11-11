import test from 'node:test';
import assert from 'node:assert/strict';
import type { Ctx, Selection } from '@barocss/cad-model/app/commands';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { contextualModelCommand, primaryModelCommands } from '../src/app/modelRail';

const doc = rectanglePart(40, 24, 12);
const evaluated = evaluateDoc(doc, 0);
assert.ok(evaluated.ok);
const [body] = evaluated.bodies;
const top = body.mesh.faces.findIndex(face => face.kind === 'plane' && face.normal[2] > 0.99);
assert.ok(top >= 0);
const face = { body: 0, face: top };
const edge = { body: 0, edge: 0 };
const empty: Selection = { faces: [], edges: [], bodies: [] };
const context = (selection: Selection): Ctx => ({ doc, bodies: [body], selection });

test('the Model rail always offers Sketch and Extrude, with Hole and Fillet on the matching picks', () => {
  assert.deepEqual(primaryModelCommands.map(command => command.id), ['sketch', 'extrude']);
  assert.equal(contextualModelCommand(context({ ...empty, faces: [face] }), true)?.id, 'hole');
  assert.equal(contextualModelCommand(context({ ...empty, edges: [edge] }), true)?.id, 'fillet');
});

test('context tools clear on stale, missing or mixed picks and preserve the command eligibility boundary', () => {
  const selections: Selection[] = [
    empty,
    { ...empty, faces: [{ ...face, body: 9 }] },
    { ...empty, faces: [{ ...face, face: 99 }] },
    { ...empty, edges: [{ ...edge, edge: 99 }] },
    { ...empty, faces: [face], edges: [edge] },
    { ...empty, faces: [face], vertices: [{ body: 0, at: [0, 0, 12] }] },
    { ...empty, edges: [edge], sketches: [0] },
  ];
  for (const selection of selections) assert.equal(contextualModelCommand(context(selection), true), undefined);
  assert.equal(contextualModelCommand(context({ ...empty, faces: [face] }), false), undefined);
  assert.equal(contextualModelCommand({ ...context({ ...empty, faces: [face] }), direct: ['surface'] }, true), undefined);
  const faceted = { ...context({ ...empty, edges: [edge] }), bodies: [{ ...body, family: 'faceted' }] };
  assert.equal(contextualModelCommand(faceted, true), undefined);
  const tilted = { ...body, mesh: { ...body.mesh, faces: body.mesh.faces.map((surface, i) =>
    i === top ? { ...surface, normal: [Math.SQRT1_2, 0, Math.SQRT1_2] as [number, number, number] } : surface) } };
  assert.equal(contextualModelCommand({ ...context({ ...empty, faces: [face] }), bodies: [tilted] }, true), undefined);
});
