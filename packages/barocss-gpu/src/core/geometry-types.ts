// The geometry primitives' one shape across the three packages (api-conventions.md §10.2, R7.3c), by structure rather
// than through a shared package: cad and cad-model declare the same tuples.

/** A point or direction: x, y, z. In the studio's and CAD's data, millimetres and Z up (§10.1). */
export type Vec3 = readonly [number, number, number];
/** A rotation: 9 numbers, row-major, whose columns are the frame's axes, so its Z axis is [R[2], R[5], R[8]]. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
/** A transform: 16 numbers, column-major (element (row r, column c) at c * 4 + r), used only inside computation. */
export type Mat4 = Float64Array;
