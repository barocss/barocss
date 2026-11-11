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
export function threeOccurrenceDoc(): StudioDoc {
  const doc = fixtureDoc();
  doc.instances!.push({ id: 'p3', name: 'Back', position: [80, 0, 0], rotation: [0, 0, 0], doc: plate(12, 8, 3, 5) });
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
