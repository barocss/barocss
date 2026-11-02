import { type MassProperties } from './solid-mass.js';
type Vector3 = readonly [number, number, number];
/** A line in the same XYZ coordinates as the mass properties. The point is in mm. */
export interface MassInertiaAxis {
    readonly point: Vector3;
    /** A finite nonzero direction; its magnitude does not change the queried line. */
    readonly direction: Vector3;
}
/**
 * Moment about the line through axis.point, in g*mm^2. The input inertia is the full
 * COM tensor in g*mm^2; mass is in g, and centroid/point are in mm in the same XYZ frame.
 * The direction is normalized. The query uses u^T I_COM u + mass*|(centroid-point) cross u|^2.
 * Volume and method are not used. No frame rotation or material/density conversion is applied.
 * This is a numerical MMGS query, not native SI provenance or physical validation of the tensor.
 * It does not certify symmetry, positive definiteness, manufacturing tolerance or numerical error.
 */
export declare function momentOfInertiaAboutAxis(props: MassProperties, axis: MassInertiaAxis): number;
export {};
