import type { Vec3 } from '../types.js';
import type { CharacterState } from './types.js';
import type { QueryContext } from './query.js';
export declare function snap(position: Vec3, candidate: CharacterState, context: QueryContext): Vec3;
