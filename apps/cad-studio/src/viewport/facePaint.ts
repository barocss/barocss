// Face colours of a body's surface (PERF3 B7). The vertices of each face are kept as runs, so a hover or a
// selection repaints only the faces whose state changed, one range each, instead of making, converting and
// sending the whole colour buffer again; a change of the colours themselves (theme, body or face colours,
// render settings) paints the whole body once.
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

/** What the painter writes to: the viewer's surface geometry. */
export interface ColorTarget {
  setColors(colors: ArrayLike<number>): void;
  fillColors(first: number, count: number, color: ArrayLike<number>): void;
}

/** A body's vertices as runs of one face: start and count pairs by face, in vertex order. */
export interface FaceRuns { readonly byFace: ReadonlyMap<number, readonly number[]>; readonly vertexCount: number }

export function faceRuns(faceOfVertex: ArrayLike<number>): FaceRuns {
  const byFace = new Map<number, number[]>(), n = faceOfVertex.length;
  for (let v = 0; v < n;) {
    const f = faceOfVertex[v];
    let e = v + 1;
    while (e < n && faceOfVertex[e] === f) e++;
    let list = byFace.get(f);
    if (!list) { list = []; byFace.set(f, list); }
    list.push(v, e - v);
    v = e;
  }
  return { byFace, vertexCount: n };
}

/** What a body was last painted with: the colours' key and each face's state (1 hovered, 2 selected). */
export interface Painted { readonly key: string; readonly shown: ReadonlyMap<number, number> }

/**
 * Paints a body's faces: `shade` (normal, hovered, selected) for every face, or the face's own from `shades`.
 * With the same `key` as `before` only the faces whose state changed are written; otherwise, or when they
 * cover more than half the vertices, the whole buffer once. Returns what is now shown. `vertices` counts the
 * vertices written (for the tests and the bench).
 */
export function paintFaces(target: ColorTarget, runs: FaceRuns, before: Painted | null, key: string, faceState: ReadonlyMap<number, number>,
  shade: readonly Vec3[], shades: ReadonlyMap<number, readonly Vec3[]>, count?: { vertices: number }): Painted {
  const shown = new Map(faceState);
  if (before && before.key === key) {
    const changed: number[] = [];
    let vertices = 0;
    for (const f of before.shown.keys()) if (!faceState.has(f)) vertices += mark(changed, runs, f);
    for (const [f, s] of faceState) if (before.shown.get(f) !== s) vertices += mark(changed, runs, f);
    if (2 * vertices <= runs.vertexCount) {
      for (const f of changed) {
        const list = runs.byFace.get(f)!, c = (shades.get(f) ?? shade)[faceState.get(f) ?? 0];
        for (let k = 0; k < list.length; k += 2) target.fillColors(list[k], list[k + 1], c);
      }
      if (count) count.vertices += vertices;
      return { key, shown };
    }
  }
  const colors = new Float32Array(runs.vertexCount * 3);
  for (const [f, list] of runs.byFace) {
    const c = (shades.get(f) ?? shade)[faceState.get(f) ?? 0];
    for (let k = 0; k < list.length; k += 2) for (let v = list[k], end = list[k] + list[k + 1]; v < end; v++) colors.set(c, 3 * v);
  }
  target.setColors(colors);
  if (count) count.vertices += runs.vertexCount;
  return { key, shown };
}
/** A face to write again (when it has vertices): its vertex count. */
function mark(changed: number[], runs: FaceRuns, f: number): number {
  const list = runs.byFace.get(f);
  if (!list) return 0;
  changed.push(f);
  let n = 0;
  for (let k = 1; k < list.length; k += 2) n += list[k];
  return n;
}
