import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionRational } from './section-rational-internal.js';
import type { Point, Surface } from './types.js';

type Vector = [SectionRational, SectionRational, SectionRational];
/** Private exact admission of an already shape-validated original affine support.
 * No normalization, projection, surface mutation, or representability fallback. */
export class ExactAffinePlane {
  readonly rational: SectionRationalContext;
  private readonly origin: Vector;
  private readonly u: Vector;
  private readonly v: Vector;
  private readonly normal: Vector;
  private readonly uu: SectionRational;
  private readonly uv: SectionRational;
  private readonly vv: SectionRational;
  private readonly determinant: SectionRational;
  private points = 0;
  constructor(private readonly surface: Surface, private readonly label: string) {
    this.rational = new SectionRationalContext((kind, detail) => this.fail(kind + ': ' + detail));
    const q = this.rational;
    this.origin = this.vector(surface.controlPoints[0][0]);
    this.u = this.subtract(this.vector(surface.controlPoints[1][0]), this.origin);
    this.v = this.subtract(this.vector(surface.controlPoints[0][1]), this.origin);
    const corner = this.vector(surface.controlPoints[1][1]);
    if (!corner.every((value, i) => q.compare(value, q.add(q.add(this.origin[i], this.u[i]), this.v[i])) === 0)) this.fail('Original stored support is not exactly affine');
    const product = (a: number, b: number) => q.sub(q.mul(this.u[a], this.v[b]), q.mul(this.u[b], this.v[a]));
    this.normal = [product(1, 2), product(2, 0), product(0, 1)];
    if (this.normal.every(value => value.n === 0n)) this.fail('Original stored affine support has rank less than two');
    this.uu = this.dot(this.u, this.u); this.uv = this.dot(this.u, this.v); this.vv = this.dot(this.v, this.v);
    this.determinant = q.sub(q.mul(this.uu, this.vv), q.mul(this.uv, this.uv));
  }
  private fail(detail: string): never { throw new Error((this.label + ': ' + detail).slice(0, 1024)); }
  private vector(point: Point): Vector { return point.map(value => this.rational.from(value)) as Vector; }
  private subtract(a: Vector, b: Vector): Vector { return a.map((value, i) => this.rational.sub(value, b[i])) as Vector; }
  private dot(a: Vector, b: Vector): SectionRational { return this.rational.sum(a.map((value, i) => this.rational.mul(value, b[i]))); }
  private displacement(point: Point): Vector {
    if (++this.points > 64) this.fail('BUDGET: Exact affine point-admission ceiling exceeded');
    const d = this.subtract(this.vector(point), this.origin);
    if (this.dot(this.normal, d).n !== 0n) this.fail('Original homogeneous Line coplanarity is not proven exactly');
    return d;
  }
  coplanar(point: Point): void { this.displacement(point); }
  /** Exact rational UV rounded once to the nearest binary64: exact whenever the UV is representable. */
  pointToNearestUV(point: Point): Point {
    const q = this.rational, d = this.displacement(point), du = this.dot(d, this.u), dv = this.dot(d, this.v);
    const u = q.div(q.sub(q.mul(du, this.vv), q.mul(dv, this.uv)), this.determinant);
    const v = q.div(q.sub(q.mul(dv, this.uu), q.mul(du, this.uv)), this.determinant);
    const parameter = (knots: number[], fraction: SectionRational) => q.nearest(q.add(q.from(knots[1]), q.mul(q.sub(q.from(knots[2]), q.from(knots[1])), fraction)));
    return [parameter(this.surface.knotsU, u), parameter(this.surface.knotsV, v), 0];
  }
  /** Strict producer construction check, separate from approximate query projection. */
  pointToUV(point: Point): Point {
    const q = this.rational, d = this.displacement(point), du = this.dot(d, this.u), dv = this.dot(d, this.v);
    const u = q.div(q.sub(q.mul(du, this.vv), q.mul(dv, this.uv)), this.determinant);
    const v = q.div(q.sub(q.mul(dv, this.uu), q.mul(du, this.uv)), this.determinant);
    const parameter = (knots: number[], fraction: SectionRational) => q.exactFloat(q.add(q.from(knots[1]), q.mul(q.sub(q.from(knots[2]), q.from(knots[1])), fraction)));
    return [parameter(this.surface.knotsU, u), parameter(this.surface.knotsV, v), 0];
  }
}
