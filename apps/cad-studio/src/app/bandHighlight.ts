import type { BodyRef } from '@barocss/cad-model/engine/doc';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';

/** What the Band surface command has picked so far (the model's bandPicksOf), as the viewport's selection: every display edge carrying one of the picked names, on the body that is the pick's parent. */
export interface BandPick { side: 'a' | 'b'; parent: BodyRef; names: string[] }
export interface BandHighlight { faces: never[]; edges: { body: number; edge: number }[]; bodies: never[] }

export function bandHighlight(bodies: readonly { ref?: BodyRef; mesh: Pick<DisplayMesh, 'edges'> }[], picks: readonly BandPick[]): BandHighlight | null {
  const edges: { body: number; edge: number }[] = [];
  for (const pick of picks) {
    const body = bodies.findIndex(b => b.ref !== undefined && b.ref.node === pick.parent.node && b.ref.side === pick.parent.side);
    if (body < 0) continue;
    bodies[body].mesh.edges.forEach((e, edge) => { if (e.names.some(n => pick.names.includes(n)) && !edges.some(x => x.body === body && x.edge === edge)) edges.push({ body, edge }); });
  }
  return edges.length ? { faces: [], edges, bodies: [] } : null;
}
