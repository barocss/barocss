import type { Vec3 } from '../types.js';
import type { CharacterState, CharacterDiagnostics } from './types.js';
import type { QueryContext } from './query.js';
export declare function move(position: Vec3, delta: Vec3, candidate: CharacterState, context: QueryContext, diagnostic: CharacterDiagnostics): Vec3;
