import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { modelPrint, defaultDrawing } from '@barocss/cad-model/drawing/types';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { drawingDocument } from '@barocss/cad-model/drawing/scope';
import { defaultRender } from '@barocss/cad-model/engine/render';
import { drawingRevisionPrint } from '../src/ui/drawing/revisionPrint';

function parameterized(): StudioDoc {
  const doc = rectanglePart(60, 40, 10);
  const sketch = doc.nodes[0]; assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  sketch.max[0] = { parameter: 'W' };
  return { ...doc, parameters: { W: 60 } };
}

test('parameter-only geometry edits change the stamp while the same authored nodes stay exact', () => {
  const doc = parameterized(), before = structuredClone(doc), changed = { ...doc, parameters: { W: 70 } };
  assert.deepEqual(changed.nodes, doc.nodes);
  assert.notEqual(drawingRevisionPrint(changed), drawingRevisionPrint(doc));
  assert.deepEqual(doc, before, 'reading a stamp does not change the document');
});

test('parameter-free parts retain the exact legacy stamp and changed nodes still invalidate it', () => {
  const doc = rectanglePart(60, 40, 10);
  assert.equal(drawingRevisionPrint(doc), modelPrint(doc.nodes));
  const changed = structuredClone(doc), extrude = changed.nodes[1]; assert.ok(extrude.kind === 'extrude'); extrude.height = 12;
  assert.notEqual(drawingRevisionPrint(changed), drawingRevisionPrint(doc));
  assert.equal(drawingRevisionPrint(changed), modelPrint(changed.nodes));
  const bound = parameterized(), changedBound = structuredClone(bound), boundExtrude = changedBound.nodes[1];
  assert.ok(boundExtrude.kind === 'extrude'); boundExtrude.height = 12;
  assert.notEqual(drawingRevisionPrint(changedBound), drawingRevisionPrint(bound));
});

test('drawing revision, layout and observed dimension signature enrichment do not change a model stamp', () => {
  const doc = parameterized(), old = drawingRevisionPrint(doc);
  const drawing = { ...defaultDrawing(), revision: 'A', revisedModel: old, dimensions: [{
    id: 'd1', view: 'top' as const, kind: 'linear' as const, orient: 'horizontal' as const, place: [20, -10] as [number, number],
    a: { edge: 'n1.bottom|n1.side0', at: 'end' as const, near: [0, 0, 0] as [number, number, number] },
    b: { edge: 'n1.bottom|n1.side0', at: 'end' as const, near: [60, 0, 0] as [number, number, number] },
  }] };
  const before = { ...doc, drawing }, changed = structuredClone(before);
  changed.drawing.revision = 'B'; changed.drawing.revisedModel = 'new issue'; changed.drawing.scale = 0.5;
  const dim = changed.drawing.dimensions[0];
  Object.assign(dim.a, { sig: { k: 'line', p: [35, 0, 0], d: [1, 0, 0], s: 70 } });
  Object.assign(dim.b, { sig: { k: 'line', p: [35, 40, 0], d: [-1, 0, 0], s: 70 } });
  assert.equal(drawingRevisionPrint(before), old); assert.equal(drawingRevisionPrint(changed), old);
  assert.notDeepEqual(changed.drawing, before.drawing);
});

test('Save/Open preserves a multi-parameter stamp and tracks authored parameter values', async () => {
  const doc = { ...parameterized(), parameters: { W: 60, Depth: 40, Unused: 3 } };
  const stamp = drawingRevisionPrint(doc), opened = await readStudioFile(encodeStudioFile(doc));
  assert.ok('doc' in opened); assert.equal(drawingRevisionPrint(opened.doc), stamp);
  assert.notEqual(drawingRevisionPrint({ ...doc, parameters: { ...doc.parameters, Depth: 45 } }), stamp);
  assert.notEqual(drawingRevisionPrint({ ...doc, parameters: { ...doc.parameters, Unused: 4 } }), stamp, 'all authored parameter values are covered; no usage inference');
});

test('an old node-only stamp on a parameterized part remains outdated until the user stamps it again', () => {
  const doc = parameterized(), legacy = modelPrint(doc.nodes), current = drawingRevisionPrint(doc);
  assert.notEqual(current, legacy);
  const stamped = { ...doc, drawing: { ...defaultDrawing(), revision: 'A', revisedModel: legacy } };
  assert.equal(stamped.drawing.revisedModel, legacy, 'reading the new dependency never auto-restamps a saved issue');
  assert.notEqual(stamped.drawing.revisedModel, drawingRevisionPrint(stamped));
  assert.equal(drawingRevisionPrint({ ...stamped, parameters: {} }), legacy, 'empty parameters use the exact old contract');
});

function staticAssembly(): StudioDoc {
  const doc = parameterized(), extrude = doc.nodes[1];
  assert.ok(extrude.kind === 'extrude'); extrude.height = 12;
  return { ...emptyDoc(), instances: [
    { id: 'inst1', name: 'Plate', doc, position: [0, 0, 0], rotation: [0, 0, 0], grounded: true, part: { id: 'part1', rev: 'B', source: './plate.bcad' } },
    { id: 'inst2', name: 'Plate copy', doc, position: [0, 0, 12], rotation: [0, 0, 0], part: { id: 'part1', rev: 'B', source: './plate.bcad' } },
  ], mates: [{ id: 'm1', kind: 'coincident', a: { part: 'inst1', face: 'n1.top' }, b: { part: 'inst2', face: 'n1.bottom' } }] };
}

function changesStamp(doc: StudioDoc, edit: (changed: StudioDoc) => void): void {
  const before = structuredClone(doc), changed = structuredClone(doc);
  edit(changed);
  assert.notEqual(drawingRevisionPrint(changed), drawingRevisionPrint(doc));
  assert.deepEqual(doc, before, 'fingerprint reads do not mutate accepted source');
}

test('an assembly pose changes its issue stamp with identical root nodes/parameters; part scopes stay local', () => {
  const doc = staticAssembly(), changed = structuredClone(doc);
  changed.instances![1].position[0] = 10;
  assert.deepEqual(changed.nodes, doc.nodes); assert.deepEqual(changed.parameters, doc.parameters);
  assert.deepEqual(changed.mates, doc.mates);
  assert.notEqual(drawingRevisionPrint(changed), drawingRevisionPrint(doc));
  const partScope = { ...defaultDrawing(), scope: { kind: 'part' as const, part: 'inst1' } };
  assert.equal(drawingRevisionPrint(drawingDocument(changed, partScope)), drawingRevisionPrint(drawingDocument(doc, partScope)));
  const emptyAssembly = { ...emptyDoc(), instances: [] };
  assert.notEqual(drawingRevisionPrint(emptyAssembly), modelPrint(emptyAssembly.nodes), 'an explicit empty assembly has the new dependency contract');
});

test('embedded and nested definition edits invalidate assemblies; canonical dictionary order does not', () => {
  const inner = staticAssembly(), doc = { ...emptyDoc(), instances: [{ id: 'sub', name: 'Sub', doc: inner, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }] };
  changesStamp(doc, d => { d.instances![0].doc.instances![1].doc.parameters.W = 70; });
  changesStamp(doc, d => { const node = d.instances![0].doc.instances![1].doc.nodes[1]; assert.ok(node.kind === 'extrude'); node.height = 14; });
  const a = staticAssembly(), b = structuredClone(a);
  a.instances![0].doc.parameters = { W: 60, spare: 4 };
  b.instances![0].doc.parameters = { spare: 4, W: 60 };
  assert.equal(drawingRevisionPrint(a), drawingRevisionPrint(b));
});

test('root/nested assembly cuts and occurrence joint/definition context remain issue inputs', () => {
  const doc = staticAssembly();
  changesStamp(doc, d => { d.assemblyCuts = [{ id: 'cut1', profile: { kind: 'circle', radius: 2 }, at: [20, 20, 0], dir: [0, 0, 1], depth: 'through', targets: ['inst1'] }]; });
  const cut = { ...doc, assemblyCuts: [{ id: 'cut1', profile: { kind: 'circle' as const, radius: 2 }, at: [20, 20, 0] as [number, number, number], dir: [0, 0, 1] as [number, number, number], depth: 'through' as const, targets: ['inst1'] }] };
  changesStamp(cut, d => { d.assemblyCuts![0].profile = { kind: 'circle', radius: 3 }; });
  const nested = { ...emptyDoc(), instances: [{ ...doc.instances![0], doc: cut }] };
  changesStamp(nested, d => { d.instances![0].doc.assemblyCuts![0].targets = ['inst2']; });
  changesStamp(doc, d => { d.instances![1].joints = { 'base~lid': 15 }; });
  changesStamp(doc, d => { d.instances![1].doc.robot = { version: 1, joints: { 'base~lid': { lower: 0, upper: 90 } } }; });
  changesStamp(doc, d => { d.instances![1].part!.rev = 'C'; });
});

test('outputs, row/frame context, mate records and occurrence visibility are retained conservatively', () => {
  const doc = staticAssembly();
  changesStamp(doc, d => { const part = d.instances![1].doc; part.outputs.copy = { ...part.outputs.b1 }; });
  changesStamp(doc, d => { d.fasteners = { version: 1, rows: [] }; });
  changesStamp(doc, d => { d.frames = { version: 1, kerf: 2, sections: [] }; });
  changesStamp(doc, d => { d.mates![0] = { ...d.mates![0], kind: 'distance', distance: 3 }; });
  changesStamp(doc, d => { d.instancePatterns = []; });
  changesStamp(doc, d => { d.instances![1].hidden = true; });
});

test('root and nested paper/render/workflow caches and unaccepted revisions do not restamp an assembly', () => {
  const doc = staticAssembly(), changed = structuredClone(doc), before = structuredClone(doc);
  const paper = { ...defaultDrawing(), revision: 'A', revisedModel: 'old issue', scale: 0.5, dimensions: [{
    id: 'd1', view: 'top' as const, kind: 'linear' as const, orient: 'horizontal' as const, place: [20, -10] as [number, number],
    a: { edge: 'n1.bottom|n1.side0', at: 'end' as const, near: [0, 0, 0] as [number, number, number], sig: { k: 'line' as const, p: [30, 0, 0] as [number, number, number], d: [1, 0, 0] as [number, number, number], s: 60 } },
    b: { edge: 'n1.bottom|n1.side0', at: 'end' as const, near: [60, 0, 0] as [number, number, number] },
  }] };
  for (const part of [changed, changed.instances![0].doc]) {
    part.drawing = paper;
    part.render = defaultRender();
    part.history = []; part.proposals = []; part.baselines = undefined; part.questions = undefined;
    part.assemblySteps = [{ id: 'step1', name: 'Instruction only', add: [], explode: 1 }];
    part.underlays = [];
    part.nextId = 100;
    part.direct = { sources: { ordinary: 'presentation only' }, objects: [] };
    part.pendingParts = { waiting: { doc: parameterized(), name: 'new-source.bcad', rev: 'C' } };
  }
  assert.equal(drawingRevisionPrint(changed), drawingRevisionPrint(doc));
  assert.deepEqual(doc, before);
  changesStamp(changed, d => { d.instances![0].doc.parameters.W = 70; });
});

test('known document channel exclusions do not erase similarly named fields inside authored records', () => {
  const doc = staticAssembly();
  const changed = structuredClone(doc);
  Object.assign(changed.instances![0].doc.nodes[0], { render: 'authored opaque record' });
  assert.notEqual(drawingRevisionPrint(changed), drawingRevisionPrint(doc), 'only actual Doc boundaries are sanitized');
});

test('route/direct inputs follow the evaluatedPart presence/schema/object-path condition recursively (fingerprints only)', () => {
  // These dependency probes do not compile/admit a route or qualify its geometry.
  const plain = staticAssembly(), ordinary = structuredClone(plain);
  ordinary.instances![0].doc.direct = { sources: { path: 'source one' }, objects: [] };
  assert.equal(drawingRevisionPrint(ordinary), drawingRevisionPrint(plain));
  const schema4 = structuredClone(ordinary); schema4.instances![0].doc.schema = 4;
  changesStamp(schema4, d => { d.instances![0].doc.direct!.sources.path = 'source two'; });
  const bundle = structuredClone(ordinary); bundle.instances![0].doc.routeBundles = [];
  changesStamp(bundle, d => { d.instances![0].doc.direct!.sources.path = 'source two'; });
  const ownUndefined = structuredClone(ordinary); ownUndefined.instances![0].doc.routeBundles = undefined;
  changesStamp(ownUndefined, d => { d.instances![0].doc.direct!.sources.path = 'source two'; });
  const path = structuredClone(ordinary);
  path.instances![0].doc.nodes.push({ kind: 'curve-feature-pattern', parent: { node: 1, side: 'solid' }, path: { objectId: 'path1' }, spacing: 8, count: 2 });
  changesStamp(path, d => { d.instances![0].doc.direct!.sources.path = 'source two'; });
  changesStamp(bundle, d => { delete d.instances![0].doc.routeBundles; });
  const nested = { ...emptyDoc(), instances: [{ ...plain.instances![0], doc: bundle }] };
  changesStamp(nested, d => { d.instances![0].doc.instances![0].doc.direct!.sources.path = 'source three'; });
});

test('assembly Save/Open preserves the issue key; old node-only marks remain outdated without auto-restamping', async () => {
  const doc = staticAssembly(), legacy = modelPrint(doc.nodes), stamp = drawingRevisionPrint(doc);
  doc.drawing = { ...defaultDrawing(), scope: { kind: 'assembly' }, revision: 'A', revisedModel: legacy };
  const before = structuredClone(doc), opened = await readStudioFile(encodeStudioFile(doc));
  assert.ok('doc' in opened);
  assert.equal(drawingRevisionPrint(opened.doc), stamp);
  assert.equal(opened.doc.drawing!.revisedModel, legacy);
  assert.notEqual(legacy, stamp);
  const current = { ...opened.doc, drawing: { ...opened.doc.drawing!, revision: 'B', revisedModel: stamp } };
  assert.equal(drawingRevisionPrint(current), stamp);
  assert.deepEqual(doc, before);
});
