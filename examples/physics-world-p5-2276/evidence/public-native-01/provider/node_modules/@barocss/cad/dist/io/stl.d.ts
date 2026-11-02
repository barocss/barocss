/** Binary STL of triangles `indices` (three per triangle) into `positions` (x, y, z per vertex, mm). */
export declare function encodeBinaryStl(positions: ArrayLike<number>, indices: ArrayLike<number>, header?: string): Uint8Array;
