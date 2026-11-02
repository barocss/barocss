import type { FailureCode } from './types.js';
export declare function replayError(code: FailureCode, message: string): never;
export declare function copyReplayJson<T>(input: T, label: string): T;
export declare function exactFields(value: unknown, fields: string[], label: string): asserts value is Record<string, unknown>;
/** Exact input comparison preserves signed zero and record order independence. */
export declare function equivalentReplayIdentity(left: unknown, right: unknown): boolean;
export declare const MAX_RECORDING_BYTES: number;
export declare function encodeRecordingData(input: unknown): Uint8Array;
export declare function decodeRecordingData(input: Uint8Array): unknown;
