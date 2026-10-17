/** Coordinates are in millimetres. Parameter values and weights have no unit. */
export type Point = [number, number, number];

export interface Curve {
  kind: 'curve';
  id: string;
  degree: number;
  knots: number[];
  controlPoints: Point[];
  weights: number[];
}

/** The first grid index is U; the second grid index is V. */
export interface Surface {
  kind: 'surface';
  id: string;
  degreeU: number;
  degreeV: number;
  knotsU: number[];
  knotsV: number[];
  controlPoints: Point[][];
  weights: number[][];
}

/**
 * A facet face's geometry (F0): a region of a triangle mesh, kept as typed arrays — not a surface a parameter
 * maps. `positions` x, y, z per vertex (the region's own); `indices` three per triangle, wound so the right-hand
 * normal points out of the solid when the face's sense is forward. `bounds` [x0, y0, z0, x1, y1, z1].
 * Never frozen, never JSON-copied: a B-rep holding one stays out of the admitted document.
 */
export interface FacetPatch {
  readonly kind: 'facets';
  readonly id: string;
  readonly positions: Float64Array;
  readonly indices: Uint32Array;
  readonly bounds: Float64Array;
}

export interface Model {
  name: string;
  version: 0;
  lengthUnit: 'mm';
  objects: (Curve | Surface)[];
}

export interface CurveSample {
  parameter: number;
  point: Point;
}

export interface SurfaceSample {
  u: number;
  v: number;
  point: Point;
}
