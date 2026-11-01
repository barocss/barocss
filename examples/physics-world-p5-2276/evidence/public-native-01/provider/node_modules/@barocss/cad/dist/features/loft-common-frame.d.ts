import type { loftSolid } from './loft.js';
import type { Point } from '../types.js';
export interface LoftFrameBasis {
    readonly origin: Point;
    readonly u: Point;
    readonly v: Point;
}
export interface LoftCommonFrame extends LoftFrameBasis {
    readonly n: Point;
}
export interface LoftFrameOffset {
    readonly shift: [number, number];
    readonly height: number;
}
type Fail = (detail: string) => never;
type BuiltLoft = ReturnType<typeof loftSolid>;
export declare function admitLoftCommonFrame(frames: readonly LoftFrameBasis[], fail: Fail): LoftCommonFrame;
export declare function loftFrameOffset(frame: LoftCommonFrame, origin: Point, fail: Fail, separationDetail: string): LoftFrameOffset;
export declare function loftFramePoint(frame: LoftCommonFrame, p: Point): Point;
export declare function loftFrameVector(frame: LoftCommonFrame, p: Point): Point;
export declare function loftFrameLocal(frame: LoftCommonFrame, p: Point): Point;
/** One world transform; preserve the original local mass method and existing transformed SI refusal. */
export declare function placeLoftInFrame(local: BuiltLoft, frame: LoftCommonFrame, fail: Fail): BuiltLoft;
export {};
