import type { Vec3 } from '../types.js';
import type { CapsuleQuerySceneV1 } from '../capsule-query.js';
import type { CharacterCore, CharacterDiagnostics } from './types.js';
/** Private direct harness entry. The public facade uses this same core with capture disabled. */
export declare function createCharacterCore(scene: CapsuleQuerySceneV1, positionM: Vec3, diagnostic?: CharacterDiagnostics, options?: {
    capture?: boolean;
}): CharacterCore;
