export interface MeshDistance {
    readonly max: number;
    readonly sumSq: number;
    readonly samples: number;
    readonly at: readonly [number, number, number] | null;
}
/** From mesh A's vertices and triangle centres to mesh B's surface: the largest distance (and where), the squares' sum. */
export declare function meshDistance(pa: ArrayLike<number>, ia: ArrayLike<number>, pb: ArrayLike<number>, ib: ArrayLike<number>): MeshDistance;
/** From mesh A's vertices and triangle centres to mesh B's surface: the least and the largest distance, and where (R11.3, D114). */
export declare function meshDistanceRange(pa: ArrayLike<number>, ia: ArrayLike<number>, pb: ArrayLike<number>, ib: ArrayLike<number>): {
    readonly minMM: number;
    readonly maxMM: number;
    readonly minAt: readonly [number, number, number] | null;
    readonly maxAt: readonly [number, number, number] | null;
};
