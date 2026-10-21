import test from 'node:test';
import assert from 'node:assert/strict';
import { carryOver, NODE_EXTRA_FIELDS, rectanglePart, STUDIO_DOC_FIELDS, withNode, type ModelNode, type NodeExtras, type StudioDoc } from '../src/engine/doc';
import { deleteFeature, duplicateBody, moveFeature, replaceRange } from '../src/chat/features';
import { flattenAssembly } from '../src/assembly/flatten';
import { readStudioDoc } from '../src/engine/migrate';
import { defaultRender } from '../src/engine/render';
import { defaultDrawing } from '../src/drawing/types';

// Every field a document or a node can hold survives every path that rebuilds one: a field added to the types
// without being carried fails here (the lists are checked against the types at compile time, engine/doc.ts).
type DocField = typeof STUDIO_DOC_FIELDS[number];

/** A document with every field set (the type makes the list complete), and every node extra on some node. */
function full(): StudioDoc {
  let base = rectanglePart(40, 20, 8);
  base = withNode(base, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 2 });
  base = withNode(base, { kind: 'fillet', parent: { node: 2, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 1 });
  base = withNode(withNode(base, { kind: 'sketch', profile: 'rectangle', min: [60, 0], max: [70, 10] }), { kind: 'extrude', sketch: 4, height: 5 });
  const extras: { [K in keyof NodeExtras]-?: NonNullable<NodeExtras[K]> } = {
    suppressed: true, id: 'n3', rematched: { 'n1.side0|n1.top': 'n1.side1|n1.top' }, sigs: { 'n1.side0|n1.top': { k: 'line', p: [20, 0, 8], d: [1, 0, 0], s: 40 } }, held: 'test hold', bought: true,
  };
  // (The fillet carries every extra; it is held and suppressed, so the part still builds.)
  const nodes = base.nodes.map((n, i) => i === 3 ? { ...n, ...extras } as ModelNode : n);
  const values: { [K in DocField]-?: NonNullable<StudioDoc[K]> } = {
    format: 'barocss-cad-model', schema: 3, nextId: base.nextId!, units: 'mm', parameters: { w: 40 },
    configurations: { big: { w: 60 } }, pendingParts: { p: { doc: rectanglePart(5, 5, 5), rev: 'A', name: 'P' } },
    nodes, outputs: base.outputs, render: { ...defaultRender(), appearances: { b2: { ...defaultRender().defaultAppearance, roughness: 0.3 } } },
    direct: { sources: { s: 'cube' }, objects: [] }, instances: [{ id: 'i1', name: 'pin', doc: rectanglePart(4, 4, 10), position: [0, 0, 20], rotation: [0, 0, 0] }],
    drawing: defaultDrawing(), bodies: { b2: { color: '#ff0000', faceSigs: {}, facesWas: {} } },
    mates: [{ id: 'm1', kind: 'coincident', a: { part: 'base', face: 'n1.top', sig: { k: 'plane', p: [0, 0, 8], d: [0, 0, 1], s: 0 } }, b: { part: 'i1', face: 'n1.bottom' } }],
    robot: { version: 1, base: 'i1', joints: { 'base~i1': { lower: -1, upper: 1 } } },
    underlays: [{ id: 'u1', name: 'plate', draft: 'D1', polylines: [[[0, 0], [10, 0]]], texts: [{ at: [0, 0], text: 'A', height: 2.5, angle: 0 }], counts: { LINE: 1, TEXT: 1 } }],
    brief: { version: 1, process: { value: 'fdm', basis: 'stated', source: 'printed' } },
    ecrs: { version: 1, ecrs: [] },
    baselines: { version: 1, baselines: [] },
    interfaces: { version: 1, datums: [], keepouts: [], holePatterns: [], envelopes: [], budgets: { massG: 100 } },
    drafts: { version: 1, drafts: [{ id: 'F1', from: { image: 'a' }, nodes: ['n1'], dims: [{ name: 'width', label: 'w', value: 10, basis: 'scaled', drive: { kind: 'scale', nodes: ['n0'], about: [0, 0] } }] }] },
    references: { version: 1, references: [{ id: 'ref1', name: 'board', source: { mesh: { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3] } }, at: { position: [0, 0, 0], rotation: [0, 0, 0] } }], datums: [], keepouts: [] },
    questions: { version: 1, batches: [{ n: 1, questions: [{ id: 'q1', text: 'Material?', kind: 'text', blocks: { field: 'material' } }], status: 'open' }] },
    requirements: [{ id: 'R1', source: '40 long', hard: true, basis: 'assumed', confirmed: { by: 'user', at: '2026-10-18T00:00:00Z' }, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1 } }],
    proposals: [{ id: 'P1', title: 'thicker', status: 'rejected', by: { agent: 'chat' }, at: '2026-10-18T00:00:00Z', base: '00000000', ops: [], summary: 'no change',
      risk: { level: 'low', features_touched: 0, references_broken: 0, hard_requirements_changed: [], approval: [] } }],
    history: [{ id: 'h1', at: '2026-10-18T00:00:00Z', kind: 'prompt', by: { agent: 'chat' }, prompt: 'a plate' }],
    libraries: [{ library: { format: 'barocss-cad-library', version: 1, id: 'mine', name: 'Mine', libraryVersion: '1.0.0', units: 'mm', parts: [{ id: 'p', name: 'P', parameters: { w: { value: 5, source: 'test' } }, recipe: [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ expr: 'w' }, 5] }, { id: 'b', kind: 'extrude', sketch: 's', height: 5 }] }] }, authoredBy: 'agent', confirmed: false }],
    process: 'injection',
    printer: 'fdm-256',
    print: { direction: [0, 0, 1] }, mould: { version: 1, pull: [0, 0, 1], finish: 'pm-t1' }, machining: { version: 1, stock: [{ id: 'B1', kind: 'block', size: [100, 60, 25], source: 'the shop' }], allowanceMM: 1 }, casting: { version: 1, machined: ['n1.top'], machiningAllowanceMM: 2, shrink: 0.013 }, frames: { version: 1, stock: [{ id: 'S6', lengthMM: 6000, section: 'RHS 40×40×3', source: 'the shop' }], kerfMM: 2, sections: [{ id: 'R40', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, source: 'the shop' }] }, fits: { version: 1, tables: [{ id: 't', rows: [{ class: 'H7', overMM: 18, upToMM: 30, upperUM: 21, lowerUM: 0, estimate: true }] }], faces: [{ face: 'n0.side0#1', class: 'H7' }], pairs: [] }, bearings: { version: 1, rows: [{ id: '6204', boreMM: 20, outsideMM: 47, widthMM: 14, chamferMM: 1, estimate: true }] }, orings: { version: 1, rows: [{ id: '214', insideDiameterMM: 24.99, crossSectionMM: 3.53, estimate: true }] }, rings: { version: 1, rows: [{ id: 'DIN471-20', shaftDiameterMM: 20, grooveDiameterMM: 19, grooveWidthMM: 1.3, estimate: true }] }, drives: { version: 1, rows: [{ kind: 'chain', id: 'chain-a', pitchMM: 12.7, rollerDiameterMM: 8.51, estimate: true }] },
  };
  return values as StudioDoc;
}
/** The document's own fields (not the model's): kept as they were. */
const OWN = STUDIO_DOC_FIELDS.filter(k => !['nodes', 'outputs', 'nextId', 'schema'].includes(k));
function assertKept(what: string, before: StudioDoc, after: StudioDoc, own: readonly DocField[] = OWN) {
  for (const k of STUDIO_DOC_FIELDS) assert.ok(after[k] !== undefined, `${what}: ${k} dropped`);
  for (const k of own) assert.deepEqual(after[k], before[k], `${what}: ${k} changed`);
  const fillet = after.nodes.find(n => n.id === 'n3');
  if (fillet) for (const f of NODE_EXTRA_FIELDS) assert.ok(fillet[f] !== undefined, `${what}: the fillet's ${f} dropped`);
}

test('fields: every document and node field survives carry-over, delete, move, duplicate, replace, save and open', () => {
  const doc = full();
  // A command built on an evaluated document older than this one (none of the document's own fields).
  const was: StudioDoc = { format: doc.format, schema: doc.schema, units: doc.units, parameters: doc.parameters, nodes: doc.nodes, outputs: doc.outputs, nextId: doc.nextId };
  assertKept('carry-over', doc, carryOver(withNode(was, { kind: 'translate', parent: { node: 5, side: 'solid' }, offset: [1, 0, 0] }), was, doc));
  // (The separate box goes: its looks, if any, with it; everything else stays.)
  const del = deleteFeature(doc, 5); assert.ok('doc' in del, JSON.stringify(del));
  assertKept('delete', doc, del.doc);
  const moved = moveFeature(doc, 5, -1); assert.ok('doc' in moved, JSON.stringify(moved));
  assertKept('move', doc, moved.doc);
  assertKept('duplicate', doc, duplicateBody(doc, { node: 5, side: 'solid' }, [0, 30, 0]).doc, OWN.filter(k => k !== 'bodies'));
  assertKept('replace', doc, replaceRange(doc, 4, 2, [{ kind: 'sketch', profile: 'rectangle', min: [60, 0], max: [72, 10] }, { kind: 'extrude', sketch: 4, height: 5 }]));
  for (const schema of [3, 2]) {
    const read = readStudioDoc(JSON.stringify({ ...doc, schema })); assert.ok('doc' in read, JSON.stringify(read));
    assertKept(`save and open (schema ${schema})`, doc, read.doc);
  }
});

test('fields: an instance\'s node extras survive flattening, their names moved with the ids', () => {
  const part = full(), asm: StudioDoc = { ...rectanglePart(50, 50, 2), instances: [{ id: 'a', name: 'A', doc: part, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  const flat = flattenAssembly(asm), fillet = flat.nodes.find(n => n.kind === 'fillet')!;
  for (const f of NODE_EXTRA_FIELDS) assert.ok(fillet[f] !== undefined, `flatten: ${f} dropped`);
  const shifted = (fillet as { edges: string[] }).edges[0];
  assert.ok(fillet.sigs![shifted], `the signature is under the shifted name ${shifted}: ${Object.keys(fillet.sigs!)}`);
  assert.ok(fillet.rematched![shifted], 'the mark too');
});

test('fields: a change built on the document itself keeps what it cleared (not carried back from the document)', () => {
  const doc = full(), was: StudioDoc = { format: doc.format, schema: doc.schema, units: doc.units, parameters: doc.parameters, nodes: doc.nodes.slice(), outputs: doc.outputs, nextId: doc.nextId };
  // Every look cleared (show all bodies), the model untouched.
  const cleared: StudioDoc = { ...doc }; delete cleared.bodies;
  assert.equal(carryOver(cleared, was, doc).bodies, undefined);
  // A feature added to the document and its requirements removed: the model changed, the rest the document's.
  const added: StudioDoc = { ...withNode(doc, { kind: 'translate', parent: { node: 5, side: 'solid' }, offset: [1, 0, 0] }) }; delete added.requirements;
  assert.equal(carryOver(added, was, doc).requirements, undefined);
  assert.equal(carryOver(added, was, doc).history, doc.history);
});
