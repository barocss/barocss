import type { Selection } from '@barocss/cad-model/app/commands';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';

export function continuitySelection(selection: Selection, bodies: readonly BodyResult[]) {
  if (selection.faces.length || selection.vertices?.length || selection.sketches?.length || selection.profileRegions?.indices.length) return null;
  if (selection.edges.length === 1 && !selection.bodies.length) {
    const { body, edge } = selection.edges[0];
    const owner = bodies[body], picked = owner?.mesh.edges[edge];
    return picked ? { body: owner, edge, picked: picked.nativeJoint } : null;
  }
  if (selection.bodies.length === 1 && !selection.edges.length) {
    const owner = bodies[selection.bodies[0]];
    if (owner) return { body: owner, edge: undefined, picked: undefined };
  }
  return null;
}
