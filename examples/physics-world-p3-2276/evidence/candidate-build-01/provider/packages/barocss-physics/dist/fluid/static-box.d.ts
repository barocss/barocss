export interface FluidStaticBox {
    low: [number, number, number];
    high: [number, number, number];
}
export declare function inflatedBoxBounds(centerM: readonly [number, number, number], halfExtentsM: readonly [number, number, number]): FluidStaticBox;
export declare function confineStaticBox(positions: Float64Array, velocities: Float64Array, index: number, box: FluidStaticBox): number;
export declare function stopIntoStaticBox(positions: Float64Array, velocities: Float64Array, index: number, box: FluidStaticBox): void;
export declare function insideStaticBox(positions: Float64Array, box: FluidStaticBox): boolean;
