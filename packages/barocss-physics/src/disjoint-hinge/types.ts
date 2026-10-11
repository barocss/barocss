import type { Body, Joint, Vec3 } from '../types.js';

/** Package-internal, already parsed input. A/B are directed local indices 0/1. */
export type PairBodies = [Body, Body];
export interface ParsedPair {
  readonly joint: Joint;
  readonly originM: readonly [number, number, number];
  readonly bodyIndices: readonly [number, number];
  readonly jointInputIndex: number;
}
export interface PairInput {
  readonly pair: ParsedPair;
  readonly bodies: PairBodies;
  readonly sourceStepIndex: number;
  readonly sourceTimeSeconds: number;
}
export interface BodyCorrection { bodyId: string; linearImpulseNs: Vec3; angularImpulseNms: Vec3 }
export interface HingeMotorJointReport {
  id: string; kind: 'hinge'; aId: string; bId: string; angleRad: number;
  linearImpulseNs: Vec3; angularImpulseNms: Vec3; motorImpulseNms: number;
}
export interface ReportCap { angularReactionNormNms: number; maxReactionNms: number; exceedsCap: boolean }
export type StopKind='none'|'upper'|'lower';
export interface LinearProblem {a:number[][];b:number[];h:number[];y0:number[];stopKind:StopKind;stopRow:number[]}
export interface Certificate {primal:number;stationarity:number;negativeMu:number;complementarity:number;objective:number}
export interface Phase {rowIds:number[];rowCount:number;pivots:number[];inverse:number[][];normInf:number;conditionInf:number;lambda:number[];y:number[];residuals:{linear:number;inverse:number}}
export interface LinearResult {y:number[];lambda:number[];activeStop:boolean;identity:boolean;solveAttempts:number;phases:Phase[];objectiveDimensionless:number;certificate:Certificate}
