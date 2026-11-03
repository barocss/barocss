import type { FullPairCounters, FullPairLimits, FullPairProblem, FullPairResult } from './full-pair-types.js';

/** Explicit boundary for the source-preserved package-local JavaScript core. */
export const DEFAULT_LIMITS: Readonly<FullPairLimits>;
export const MESSAGES: Readonly<Record<'input' | 'limit' | 'empty' | 'ids' | 'mass' |
  'endpoints' | 'normal' | 'bound' | 'result' | 'workLimits', string>>;
export class FullPairPositionReferenceError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}
export function zeroFullPairCounters(): FullPairCounters;
export function validateFullPairProblem(problem: unknown): FullPairProblem;
export function validateFullPairResult(problem: unknown, result: unknown): FullPairResult;
export function runFullPairCore(problem: unknown, limits?: Readonly<FullPairLimits>): FullPairResult;
export function solveFullPairPosition(problem: FullPairProblem): FullPairResult;
