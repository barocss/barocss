import type { Digest } from './types.js';
/** Copy only inert plain data. Preserve number bits and reject reflection hooks. */
export declare function copyData<T>(input: T): T;
/** Frozen P0 canonical typed encoding. Strings use UTF-8; numbers use binary64 LE. */
export declare function canonicalEncode(input: unknown): Uint8Array;
/** Synchronous SHA-256, with no platform crypto or runtime dependency. */
export declare function sha256(bytes: Uint8Array): Digest;
export declare function digest(value: unknown): Digest;
