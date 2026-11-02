import { type Brep } from '../brep/brep-core.js';
import { type ProfileSegmentInput } from './extruded-profile-solid.js';
import { type PrismaticSolid } from './prismatic-solid.js';
import type { Point } from '../types.js';
import type { CadPartErrorCode } from '../part/part-model.js';
/** Internal native geometry only. Font parsing and source text remain in cad-model. */
export interface ReliefSketch {
    readonly outer: readonly ProfileSegmentInput[];
    readonly holes?: readonly (readonly ProfileSegmentInput[])[];
    readonly regions?: readonly (readonly ProfileSegmentInput[])[];
    readonly frame?: {
        readonly m: readonly number[];
        readonly o: Point;
    };
}
type Fail = (code: CadPartErrorCode, detail: string) => never;
/** Bounded support on one selected cap. `requested` is additional clearance above native policy, default zero. */
export declare function profileRelief(source: PrismaticSolid, sourceBrep: Brep, face: string, sketches: readonly ReliefSketch[], depth: number, mode: 'emboss' | 'engrave', requested: number | undefined, id: string, fail: Fail): PrismaticSolid;
export {};
