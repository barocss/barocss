export interface ArithmeticLimits {bits:number;rationals:number;integerOps:number;gcdSteps:number;subdivisions:number;exponent:number;initialExponent:number}
export const PRODUCTION_LIMITS:Readonly<ArithmeticLimits> = Object.freeze({ bits: 16384, rationals: 4096, integerOps: 262144,
  gcdSteps: 262144, subdivisions: 256, exponent: 128, initialExponent: 64 });
