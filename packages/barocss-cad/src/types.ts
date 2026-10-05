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
