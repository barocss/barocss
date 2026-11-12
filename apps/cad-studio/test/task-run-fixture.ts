import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { readInterfaces } from '@barocss/cad-model/team/interfaces';
import type { TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';

const field = <T,>(value: T) => ({ value, basis: 'stated' as const, source: 'Two independent local plates.' });
const plate = (w: number, d: number, h: number, goal: number): StudioDoc => ({
  ...rectanglePart(w, d, h), brief: { version: 1, material: field('al6061') },
  requirements: [{ id: 'height', source: 'Use the specified local height in mm.', hard: true, basis: 'stated',
    check: { query: { fn: 'bbox', axis: 'z' }, op: '==', value: goal, unit: 'mm', tol: 0.001 } }],
});
export const fixtureDoc = (): StudioDoc => ({
  ...emptyDoc(), brief: { version: 1, purpose: field('housing'), process: field('cnc-milling'), material: field('al6061') },
  instances: [
    { id: 'p1', name: 'Base', position: [0, 0, 0], rotation: [0, 0, 0], doc: plate(20, 10, 5, 6) },
    { id: 'p2', name: 'Lid', position: [45, 0, 0], rotation: [0, 0, 0], doc: plate(12, 8, 3, 4) },
  ],
});
export function footprintDoc(): StudioDoc {
  const doc = fixtureDoc(), base = doc.instances![0].doc, sketch = base.nodes[0];
  if (sketch.kind !== 'sketch' || sketch.profile !== 'rectangle') throw new Error('Expected the fixture rectangle.');
  sketch.min = [3, -3];
  sketch.max = [23, 7];
  sketch.sideTags = { outer: ['e1', 'e2', 'e3', 'e4'] };
  base.requirements = [
    { id: 'width', source: 'Width in the reviewed drawing.', hard: true, basis: 'stated',
      check: { query: { fn: 'bbox', axis: 'x' }, op: '==', value: 24, unit: 'mm', tol: 0.001 } },
    { id: 'depth', source: 'Depth in the reviewed drawing.', hard: true, basis: 'stated',
      check: { query: { fn: 'bbox', axis: 'y' }, op: '==', value: 14, unit: 'mm', tol: 0.002 } },
  ];
  return doc;
}

export function sharedHoleDoc(): StudioDoc {
  const doc = fixtureDoc();
  doc.instances![1].position = [0, 0, 20];
  for (const part of doc.instances!) {
    part.doc = withNode(part.doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [5, 5], radius: 2 });
  }
  doc.interfaces = { ...readInterfaces(undefined),
    holePatterns: [{ id: 'H1', axis: [0, 0, 1], diameter: 4, positions: [[5, 5, 0]], parts: ['p1', 'p2'] }] };
  return doc;
}
export function holeDiameterDocs() {
  const source = fixtureDoc(), [base, lid] = source.instances!;
  const bore = (doc: StudioDoc) => withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [12, 9], radius: 2 });
  base.doc = bore(plate(40, 30, 6, 6));
  base.doc.requirements = [{ id: 'bore', source: 'Use one Ø6 mm through-hole.', hard: true, basis: 'stated',
    check: { query: { fn: 'hole_diameter', face: { feature: 'n2', role: 'side0' } }, op: '==', value: 6, unit: 'mm', tol: 0.001 } }];
  lid.doc = plate(12, 8, 3, 3);
  const shared = structuredClone(source);
  shared.instances![1].position = [0, 0, 20];
  shared.instances![1].doc = bore(plate(40, 30, 6, 6));
  shared.interfaces = { ...readInterfaces(undefined),
    holePatterns: [{ id: 'H1', axis: [0, 0, 1], diameter: 4, positions: [[12, 9, 0]], parts: ['p1', 'p2'] }] };
  return { source, shared };
}
export function mixedDiameterDoc(): StudioDoc {
  const doc = fixtureDoc();
  doc.instances![1].doc = holeDiameterDocs().source.instances![0].doc;
  return doc;
}
export function inchDiameterDocs() {
  const { source, shared } = holeDiameterDocs();
  for (const doc of [source, shared]) {
    const [requirement] = doc.instances![0].doc.requirements!;
    requirement.source = 'Use one Ø0.25 in through-hole with ±0.001 in tolerance.';
    Object.assign(requirement.check, { value: 0.25, tol: 0.001, unit: 'in' });
  }
  const ambiguous = structuredClone(source), radius = structuredClone(source);
  delete ambiguous.instances![0].doc.requirements![0].check.unit;
  Object.assign(radius.instances![0].doc.requirements![0].check, {
    query: { fn: 'radius', face: { feature: 'n2', role: 'side0' } }, value: 0.125,
  });
  return { source, shared, ambiguous, radius };
}
export function threeOccurrenceDoc(): StudioDoc {
  const doc = fixtureDoc();
  doc.instances!.push({ id: 'p3', name: 'Back', position: [80, 0, 0], rotation: [0, 0, 0], doc: plate(12, 8, 3, 5) });
  return doc;
}
export function assemblyIdentityDoc(kind: 'single' | 'collision' | 'substitution' = 'single'): StudioDoc {
  const doc = fixtureDoc();
  const [base, lid] = doc.instances!;
  base.id = 'check_spec';
  base.name = 'Base check_spec';
  base.doc.requirements![0].id = 'set_requirements';
  if (kind === 'single') return doc;
  if (kind === 'substitution') {
    base.doc.requirements![0].check.value = 5;
    lid.doc.requirements![0].check.value = 3;
  }

  const literal = { ...base, id: 'requirements.check', name: 'Distinct literal', position: [80, 0, 0] as [number, number, number], doc: plate(8, 7, 2, 9) };
  literal.doc.requirements![0].id = 'get_assembly';
  const nested = { ...base, position: [0, 0, 0] as [number, number, number], doc: rectanglePart(20, 10, 5) };
  doc.instances!.push(literal, {
    id: 'sub', name: 'Subassembly', position: [45, 20, 0], rotation: [0, 0, 0],
    doc: { ...emptyDoc(), instances: [nested] },
  });
  doc.mates = [{ id: 'place_part', kind: 'coincident',
    a: { part: 'base', face: 'origin:xy' }, b: { part: 'sub/check_spec', face: 'n1.bottom' }, flip: true }];
  return doc;
}
export function singleRepairDoc(): StudioDoc {
  const doc = fixtureDoc();
  doc.instances![0].doc = plate(20, 10, 6, 6);
  doc.instances![1].doc = plate(12, 8, 4, 4);
  doc.instances!.push({ id: 'p3', name: 'Back', position: [80, 0, 0], rotation: [0, 0, 0], doc: plate(12, 8, 7, 5) });
  return doc;
}
export const fixturePlan: TaskPlanRequest = {
  identity: { projectId: 'worker-fixture', documentId: 'housing' }, policyRevision: 'user-v1', maxTasks: 2, throughSequence: 30,
  tasks: [
    { id: 'base', holder: 'base-worker', occurrence: 'p1', feature: 'n1', capability: 'extrusion-height', units: 'mm', frame: 'part-local-z' },
    { id: 'lid', holder: 'lid-worker', occurrence: 'p2', feature: 'n1', capability: 'extrusion-height', units: 'mm', frame: 'part-local-z' },
  ],
};
export const fixtureLimits = { concurrent: 2 as const, attemptsPerTask: 3, reservation: 2, leaseTicks: 5, timeoutMs: 10000 };
