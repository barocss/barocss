import type {StaticInput,StaticResult,StaticCertificate,Counts as StaticCounts,Vec} from '../physics-coupled-contact-2276/candidate.js';
export type {Counts as StaticCounts,Vec} from '../physics-coupled-contact-2276/candidate.js';

export interface CoupledInput extends StaticInput {
  muDynamicA: number;
  muDynamicB: number;
  /** Actual represented query normal. Never used for exact branch/root selection. */
  reportedNormal: Vec;
}
export interface DynamicCounts {
  rationalOps: number; integerOps: number; gcdSteps: number; peakBits: number;
  subdivisions: number; maxDyadicExponent: number;
}
export interface RootCertificate {
  lower: string; upper: string; openRootCount: number; exactRationalRoot: boolean;
  hRange: [string, string]; disposition: 'ADMISSIBLE' | 'NEGATIVE_NORMAL';
}
export interface DynamicCertificate {
  staticPriority: StaticCertificate;
  nativeUnitNormal: string[]; nativeTangentAxes: string[][];
  effectiveDynamicCoefficient: string; dynamicCoefficientSquared: string;
  k: string; c: string[]; dBlock: string[][]; schurA: string[][]; schurB: string[];
  polynomialAscending: string[]; sturmAscending: string[][]; roots: RootCertificate[];
  selectedRoot: number; idealParameter: [string, string];
  idealNormalNs: [string, string]; idealTangentNs: [string, string][];
  idealWorldImpulseNs: [string, string][]; idealSlipMps: [string, string][];
  worldPresentationErrorNs: [string, string][];
  cacheNormalPresentationErrorNs: [string, string]; cacheTangentPresentationErrorNs: [string, string][];
  representedNormalNs: string; representedTangentNs: string[];
  representedContactVelocityMps: string[];
  residualBounds: Record<string, [string, string]>;
  staticCounts: StaticCounts; dynamicCounts: DynamicCounts;
  cumulativeRationalOps: number; cumulativeGcdSteps: number;
}
type StaticTerminal = Extract<StaticResult, { status: 'UNRESOLVED' }>
  | (Extract<StaticResult, { status: 'STATIC_TARGET' }> & {
      dynamicAdmissionCounts: DynamicCounts; cumulativeRationalOps: number; cumulativeGcdSteps: number });
export type CoupledResult = StaticTerminal
  | { status: 'DYNAMIC_TARGET'; worldImpulseNs: Vec; normalNs: number; tangentNs: Vec;
      certificate: DynamicCertificate }
  | { status: 'UNRESOLVED'; reason: string; stage: 'dynamic'; staticCounts: StaticCounts;
      dynamicCounts: DynamicCounts };

export interface Q { n: bigint; d: bigint }
export type V = [Q, Q, Q];
export type P = Q[];
export type IP = bigint[];
export type Chain = ReadonlyArray<ReadonlyArray<bigint>>;
export type Interval = [Q, Q];
export interface Point { readonly n: bigint; readonly e: number }
export interface Root { lo: Point; hi: Point; exact: boolean }
