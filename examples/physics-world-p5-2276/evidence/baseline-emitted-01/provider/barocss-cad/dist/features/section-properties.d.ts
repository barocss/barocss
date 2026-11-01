export type Vector3 = [number, number, number];
/** A 3 × 3 matrix, row-major. */
export type Matrix3 = [number, number, number, number, number, number, number, number, number];
/** A plane section: its area, centroid, and second moments about the centroid (∫(y − cy)² dA, ∫(x − cx)² dA, ∫(x − cx)(y − cy) dA), with the principal ones. */
export interface SectionProperties {
    readonly area: number;
    readonly centroid: readonly [number, number];
    readonly Ixx: number;
    readonly Iyy: number;
    readonly Ixy: number;
    /** The principal second moments (I1 ≥ I2) and the angle (radians, from +x) of I1's axis. */
    readonly I1: number;
    readonly I2: number;
    readonly angle: number;
    readonly loops: number;
}
/**
 * A section of straight-edged loops (each a list of (x, y) corners, either orientation, closing on itself): a loop
 * inside an odd number of others is a hole. Area, centroid and second moments by Green's theorem; the principal moments
 * from the 2 × 2 tensor in closed form.
 */
export declare function polygonSectionProperties(loops: readonly (readonly (readonly [number, number])[])[]): SectionProperties;
/**
 * A symmetric 3 × 3 matrix's eigen decomposition in place, by cyclic Jacobi rotations: A's diagonal becomes the
 * eigenvalues (unordered), V's columns the unit eigenvectors (row-major 3 × 3). Up to 50 sweeps; done when the
 * off-diagonal's square is 1e-30 of the diagonal's.
 */
export declare function symmetricEigen3InPlace(A: Float64Array | number[], V: Float64Array | number[]): void;
/** A symmetric 3 × 3's eigenvalues (ascending) and unit eigenvectors (the columns of `vectors`, row-major, in the same order). */
export declare function symmetricEigen3(S: ArrayLike<number>): {
    readonly values: Vector3;
    readonly vectors: Matrix3;
};
/** A closed triangle mesh's signed volume (positive when its triangles face out): Σ a·(b × c) / 6. */
export declare function meshVolume(positions: ArrayLike<number>, indices: ArrayLike<number>): number;
