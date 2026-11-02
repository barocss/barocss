import type { FailureCode } from './types.js';
import type { Vec3 } from './internal-types.js';
export declare function proxyError(code: FailureCode, message: string): never;
export declare function proxyRecord(value: unknown): Record<string, unknown>;
export declare function proxyFields(value: Record<string, unknown>, allowed: string[]): void;
export declare function proxyFinite(value: unknown, min: number, max: number, label: string): number;
export declare function proxyVector(value: unknown, min: number, max: number, label: string): Vec3;
