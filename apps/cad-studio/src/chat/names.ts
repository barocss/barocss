// Names (as the chat and the kernel give them) to the viewport's mesh indices: small, so the app can use it
// without loading the chat's tools.
import type { Selection } from '../app/commands';
import type { BodyResult } from '../engine/evaluate';

export interface NameSelection { faces: string[]; edges: string[]; bodies: string[] }

/** Faces, edges and bodies by name → mesh indices; unknown names are returned. */
export function resolveNames(bodies: BodyResult[], names: Partial<NameSelection>): { selection: Selection; unknown: string[] } {
  const selection: Selection = { faces: [], edges: [], bodies: [] }, unknown: string[] = [];
  for (const name of names.faces ?? []) {
    const hit = bodies.flatMap((b, bi) => b.mesh.faces.flatMap(f => f.name.split('+').includes(name) || f.id === name ? [{ body: bi, face: f.index }] : []))[0];
    if (hit) { if (!selection.faces.some(f => f.body === hit.body && f.face === hit.face)) selection.faces.push(hit); } else unknown.push(name);
  }
  for (const name of names.edges ?? []) {
    const hit = bodies.flatMap((b, bi) => b.mesh.edges.flatMap(e => e.names.includes(name) ? [{ body: bi, edge: e.index }] : []))[0];
    if (hit) { if (!selection.edges.some(e => e.body === hit.body && e.edge === hit.edge)) selection.edges.push(hit); } else unknown.push(name);
  }
  for (const key of names.bodies ?? []) {
    const i = bodies.findIndex(b => b.key === key);
    if (i >= 0) { if (!selection.bodies.includes(i)) selection.bodies.push(i); } else unknown.push(key);
  }
  return { selection, unknown };
}
