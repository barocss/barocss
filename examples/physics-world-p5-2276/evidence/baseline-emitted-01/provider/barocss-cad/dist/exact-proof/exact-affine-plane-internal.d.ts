import { SectionRationalContext } from '../section-rational-internal.js';
import type { Point, Surface } from '../types.js';
/** Private exact admission of an already shape-validated original affine support.
 * No normalization, projection, surface mutation, or representability fallback. */
export declare class ExactAffinePlane {
    private readonly surface;
    private readonly label;
    readonly rational: SectionRationalContext;
    private readonly origin;
    private readonly u;
    private readonly v;
    private readonly normal;
    private readonly uu;
    private readonly uv;
    private readonly vv;
    private readonly determinant;
    private points;
    constructor(surface: Surface, label: string);
    private fail;
    private vector;
    private subtract;
    private dot;
    private displacement;
    coplanar(point: Point): void;
    /** Exact rational UV rounded once to the nearest binary64: exact whenever the UV is representable. */
    pointToNearestUV(point: Point): Point;
    /** Strict producer construction check, separate from approximate query projection. */
    pointToUV(point: Point): Point;
}
