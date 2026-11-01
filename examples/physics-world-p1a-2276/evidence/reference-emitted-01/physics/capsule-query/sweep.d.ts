import type { Vec3 } from '../types.js';
import type { CapsuleQueryBoxV1, CapsuleSweepHitV1 } from './types.js';
export declare function sweepBox(center: Vec3, displacement: Vec3, box: CapsuleQueryBoxV1): CapsuleSweepHitV1 | null;
