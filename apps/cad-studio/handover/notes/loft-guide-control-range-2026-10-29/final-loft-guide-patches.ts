// Keep the native Surface axis bound when a polynomial loft guide has more than sixteen controls.
// Existing curvePiece inserts knots in homogeneous coordinates and retains the original parameter interval.
import { BrepError, type BrepBuildInput, type BrepFaceInput } from '../brep/brep-core.js';
import { curvePiece } from '../nurbs/curves/curve-segment.js';
import type { Curve, Surface } from '../types.js';

type Vertex = BrepBuildInput['vertices'][number];
type Edge = BrepBuildInput['edges'][number];
interface Ruling { curves: Curve[]; vertices: string[]; edges: Edge[] }
interface PatchState {
  vertices: Vertex[]; originals: Map<string, Edge>; rulings: Map<string, Ruling>;
  replaced: Set<string>; affected: Set<string>; added: Edge[];
}

/** Sequential cuts share the same inserted boundary coefficients; no independent two-ended restrictions. */
function pieces(source: Curve, cuts?: readonly number[]): Curve[] {
  const out: Curve[] = [];
  let rest = source, next = 0;
  while (cuts ? next < cuts.length : rest.controlPoints.length > 16) {
    const a = rest.knots[rest.degree], b = rest.knots[rest.controlPoints.length];
    let cut = cuts?.[next];
    if (cut === undefined) {
      // The first index of a degree-multiplicity cut is the lower child's control count.
      for (let i = rest.degree + 1; i <= 16 && i < rest.knots.length - rest.degree - 1; i++) {
        const knot = rest.knots[i]; if (knot > a && knot < b) cut = knot;
      }
    }
    if (cut === undefined || !(cut > a && cut < b)) throw new BrepError('GEOMETRY', 'loft: no native guide patch boundary');
    out.push(curvePiece(rest, a, cut, `${source.id}_p${next}`));
    rest = curvePiece(rest, cut, b, `${source.id}_rest`); next++;
  }
  out.push({ ...rest, id: `${source.id}_p${next}` });
  return out;
}

function ruling(state: PatchState, id: string, cuts?: readonly number[]): Ruling {
  const kept = state.rulings.get(id); if (kept) return kept;
  const edge = state.originals.get(id)!;
  const curves = pieces(edge.curve, cuts), ids = [edge.vertices[0]];
  for (let i = 1; i < curves.length; i++) {
    const id = `${edge.id}_v${i}`, lower = curves[i - 1];
    state.vertices.push({ id, point: lower.controlPoints[lower.controlPoints.length - 1] }); ids.push(id);
  }
  ids.push(edge.vertices[1]);
  const segments: Edge[] = [];
  for (let i = 0; i < curves.length; i++) {
    const curve = curves[i], segment: Edge = { id: curve.id, curve, vertices: [ids[i], ids[i + 1]] };
    segments.push(segment); state.added.push(segment); state.affected.add(segment.id);
  }
  const result = { curves, vertices: ids, edges: segments }; state.rulings.set(id, result); state.replaced.add(id);
  return result;
}

function patchSide(state: PatchState, face: BrepFaceInput, source: Surface, patched: BrepFaceInput[]): void {
  const uses = face.loops[0].uses, left = ruling(state, uses[3].edge), cuts: number[] = [];
  for (let i = 0; i + 1 < left.curves.length; i++) { const curve = left.curves[i]; cuts.push(curve.knots[curve.controlPoints.length]); }
  const right = ruling(state, uses[1].edge, cuts), rows: Curve[][] = [left.curves];
  // A row has one constant U weight. Split its polynomial V coefficients with unit weights, retaining
  // that U weight separately rather than introducing unnecessary homogeneous weight rounding.
  for (let i = 1; i + 1 < source.controlPoints.length; i++) rows.push(pieces({ kind: 'curve', id: `${source.id}_row${i}`, degree: source.degreeV,
    knots: source.knotsV, controlPoints: source.controlPoints[i], weights: Array(source.controlPoints[i].length).fill(1) }, cuts));
  rows.push(right.curves);
  const rings = [uses[0].edge];
  for (let i = 1; i < left.curves.length; i++) {
    const id = `${face.id}_r${i}`, controlPoints: Curve['controlPoints'] = [], weights: number[] = [];
    for (let r = 0; r < rows.length; r++) { controlPoints.push(rows[r][i].controlPoints[0]); weights.push(source.weights[r][0]); }
    const curve: Curve = { kind: 'curve', id, degree: source.degreeU, knots: [...source.knotsU], controlPoints, weights };
    state.added.push({ id, curve, vertices: [left.vertices[i], right.vertices[i]] }); state.affected.add(id); rings.push(id);
  }
  rings.push(uses[2].edge); state.affected.add(uses[0].edge); state.affected.add(uses[2].edge);
  for (let i = 0; i < left.curves.length; i++) {
    const id = `${face.id}_p${i}`, columns: Surface['controlPoints'] = [], weights: number[][] = [];
    for (let r = 0; r < rows.length; r++) { const column = rows[r][i].controlPoints; columns.push(column); weights.push(Array(column.length).fill(source.weights[r][0])); }
    const surface: Surface = { ...source, id, knotsU: [...source.knotsU], knotsV: [...left.curves[i].knots], controlPoints: columns, weights };
    patched.push({ ...face, id, surface, ...(face.name === undefined ? {} : { name: `${face.name}#${i + 1}` }), loops: [{ kind: 'outer', uses: [
      { edge: rings[i], sense: 'forward' }, { edge: right.edges[i].id, sense: 'forward' },
      { edge: rings[i + 1], sense: 'reversed' }, { edge: left.edges[i].id, sense: 'reversed' },
    ] }] });
  }
}

function affectedNames(faces: readonly BrepFaceInput[], affected: ReadonlySet<string>): Map<string, string[]> {
  const names = new Map<string, string[]>();
  for (const face of faces) for (const loop of face.loops) for (const use of loop.uses) {
    if (!affected.has(use.edge) || face.name === undefined) continue;
    let list = names.get(use.edge); if (!list) { list = []; names.set(use.edge, list); } list.push(face.name);
  }
  return names;
}

/** Only oversized guided sides enter here. Caps and the original section rings remain intact. */
export function patchLoftGuideSides(vertices: Vertex[], edges: Edge[], faces: BrepFaceInput[]): void {
  let needed = false;
  for (const face of faces) if (face.surface.kind === 'surface' && face.surface.controlPoints[0].length > 16) { needed = true; break; }
  if (!needed) return;
  const originals = new Map<string, Edge>(); for (const edge of edges) originals.set(edge.id, edge);
  const state: PatchState = { vertices, originals, rulings: new Map(), replaced: new Set(), affected: new Set(), added: [] }, patched: BrepFaceInput[] = [];
  for (const face of faces) {
    if (face.surface.kind !== 'surface' || face.surface.controlPoints[0].length <= 16) patched.push(face);
    else patchSide(state, face, face.surface, patched);
  }
  const names = affectedNames(patched, state.affected), retained: Edge[] = [];
  for (const edge of edges) if (!state.replaced.has(edge.id)) retained.push(edge);
  edges.length = 0;
  for (const edge of retained) edges.push(state.affected.has(edge.id) ? { ...edge, name: names.get(edge.id)!.sort().join('|') } : edge);
  for (const edge of state.added) edges.push({ ...edge, name: names.get(edge.id)!.sort().join('|') });
  faces.length = 0; for (const face of patched) faces.push(face);
}
