import type { PhysicsErrorCode } from './types.js';
export declare function replayError(code: PhysicsErrorCode, message: string): never;
export declare function copyReplayJson<T>(input: T, label: string): T;
export declare function exactFields(value: unknown, fields: string[], label: string): asserts value is Record<string, unknown>;
export declare function canonicalJson(value: unknown): string;
