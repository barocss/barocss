import { type Brep, type BrepFace } from '../brep/brep-core.js';
import { type KernelError } from '../core/barocss-error.js';
import type { Part } from '../part/part-model.js';
import type { Curve, Surface } from '../types.js';
import { type CylindricalWrapMap, type CylindricalWrapCarrierCertificate } from './cylindrical-wrap-map.js';
import { type PrismaticSolid } from './prismatic-solid.js';
export type CylindricalWrapSourceCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'SOURCE';
export type CylindricalWrapSourceError = KernelError & {
    readonly code: CylindricalWrapSourceCode;
};
export interface CylindricalWrapSourceOptions {
    readonly id: string;
    readonly mapTolerance: number;
}
export interface CylindricalWrapUVSourceOptions {
    readonly id: string;
}
interface CylindricalWrapSourceData {
    /** Independent copies of the actual cached source, never the comparison reconstruction. */
    readonly brep: Brep;
    readonly prismatic: PrismaticSolid;
    readonly face: BrepFace;
    readonly quarter: Surface;
    readonly boundary: Curve;
    readonly radius: number;
    readonly z: readonly [number, number];
    readonly proof: {
        readonly authority: 'native-prismatic-source-and-full-stored-brep-consistency';
        readonly comparison: 'all-own-fields-with-binary64-bits-and-array-order';
        readonly sourceId: string;
        readonly sourceBody: string;
        readonly sourceShell: string;
        readonly nativeSourceConsistency: true;
        /** The internal Part representation has no nominal producer-history brand. */
        readonly historicalProducerProvenance: false;
        readonly strictSourceValid: true;
        readonly fullNativeExterior: true;
        readonly extraction: 'direct-copy';
        readonly insertedKnots: 0;
        readonly originalDomain: readonly [0, 0.5];
        readonly wrappedSolid: false;
    };
}
export interface CylindricalWrapSource extends CylindricalWrapSourceData {
    readonly map: CylindricalWrapMap;
}
/** Native UV source only; no chart tolerance, arclength nodes or inverse is requested or returned. */
export interface CylindricalWrapUVSource extends CylindricalWrapSourceData {
    readonly carrier: CylindricalWrapCarrierCertificate;
}
export declare function isCylindricalWrapSourceError(error: unknown): error is CylindricalWrapSourceError;
/** Private full-map admission. Existing inverse-map support, tolerance and budget rules remain unchanged. */
export declare function buildCylindricalWrapSource(input: Part, options: CylindricalWrapSourceOptions): CylindricalWrapSource;
/** Private native-UV admission. Coefficient certification does not satisfy an inverse-map request. */
export declare function buildCylindricalWrapUVSource(input: Part, options: CylindricalWrapUVSourceOptions): CylindricalWrapUVSource;
export {};
