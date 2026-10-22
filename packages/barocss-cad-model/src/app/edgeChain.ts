// Edge chains, as CAD tools pick them on a double-click: from one edge, on through every edge that meets
// it end to end and carries on in the same direction (tangent at the joint, within 10°) — the rim of a
// rounded rectangle, a filleted outline. Stops at corners.
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { sub, unit, dot } from '../engine/vec3';


/** Each edge's polyline, in order from its `a` to its `b` end. */
function polylines(mesh: DisplayMesh): Map<number, Vec3[]> {
  const segs = new Map<number, [Vec3, Vec3][]>(), L = mesh.edgeLines;
  for (let s = 0; s * 6 < L.length; s++) {
    const e = mesh.edgeOfSegment[2 * s], list = segs.get(e) ?? [];
    list.push([[L[6 * s], L[6 * s + 1], L[6 * s + 2]], [L[6 * s + 3], L[6 * s + 4], L[6 * s + 5]]]); segs.set(e, list);
  }
  const out = new Map<number, Vec3[]>();
  for (const e of mesh.edges) {
    const list = [...(segs.get(e.index) ?? [])]; if (!list.length) continue;
    // Chain the segments from the end nearest `a`.
    const near = (p: Vec3, q: Vec3) => Math.hypot(...sub(p, q)) < 1e-6;
    let start = list.findIndex(([p, q]) => near(p, e.a as Vec3) || near(q, e.a as Vec3)); if (start < 0) start = 0;
    let [p, q] = list.splice(start, 1)[0]; if (!near(p, e.a as Vec3) && near(q, e.a as Vec3)) [p, q] = [q, p];
    const pts: Vec3[] = [p, q];
    while (list.length) {
      const tail = pts[pts.length - 1], k = list.findIndex(([x, y]) => near(x, tail) || near(y, tail)); if (k < 0) break;
      const [x, y] = list.splice(k, 1)[0]; pts.push(near(x, tail) ? y : x);
    }
    out.set(e.index, pts);
  }
  return out;
}

/** The edges chained to `edge` (it included), in no particular order. */
export function edgeChain(mesh: DisplayMesh, edge: number, maxTurnDeg = 10): number[] {
  const lines = polylines(mesh), cos = Math.cos(maxTurnDeg * Math.PI / 180), tol = 1e-4 * Math.max(1, ...mesh.bounds.max.map(Math.abs), ...mesh.bounds.min.map(Math.abs));
  // Ends: the point and the direction going out of the edge there.
  const ends = (e: number): { at: Vec3; out: Vec3 }[] => {
    const p = lines.get(e); if (!p || p.length < 2) return [];
    if (Math.hypot(...sub(p[0], p[p.length - 1])) < tol) return []; // a closed loop: a chain of its own
    return [{ at: p[0], out: unit(sub(p[0], p[1])) }, { at: p[p.length - 1], out: unit(sub(p[p.length - 1], p[p.length - 2])) }];
  };
  const seen = new Set([edge]), queue = [edge];
  while (queue.length) {
    const e = queue.pop()!;
    for (const end of ends(e)) for (const other of mesh.edges) {
      if (seen.has(other.index)) continue;
      for (const o of ends(other.index)) {
        // Meeting there and carrying on: the other edge leaves the joint the opposite way to how this one arrives.
        if (Math.hypot(...sub(o.at, end.at)) < tol && dot(o.out, end.out) < -cos) { seen.add(other.index); queue.push(other.index); break; }
      }
    }
  }
  return [...seen];
}
