export type NeighborVisitor = (other: number, rx: number, ry: number, rz: number, distanceSquared: number) => void;
export declare class NeighborGrid {
    private readonly head;
    private readonly tail;
    private next;
    private positions;
    private readonly radiusSquared;
    rebuild(positions: Float64Array): void;
    each(index: number, visit: NeighborVisitor): void;
}
