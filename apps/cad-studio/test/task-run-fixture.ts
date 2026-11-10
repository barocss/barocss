import { emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
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
