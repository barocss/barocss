import type { CadPartErrorCode, Part } from '../part/part-model.js';
import type { FormalPadRectangle } from './cylindrical-wrap-formal-mass.js';
/** A bounded reference feature. The stored surfaces approximate this closed reference. */
export interface CylindricalWrapReport {
    readonly authority: 'closed-original-radial-reference';
    readonly coordinates: 'original-native-uv-first-positive-y-quarter';
    readonly sourceFace: string;
    readonly rectangle: FormalPadRectangle;
    readonly height: number;
    readonly factor: 2;
    readonly tolerance: number;
    readonly closedReferenceCertified: true;
    readonly nativeFaceAssociationCertified: true;
    readonly literalStoredBrepClosureCertified: false;
    readonly literalStoredBrepMass: false;
    readonly nativeSIAccuracy: false;
    readonly massRequiresLiveProvider: true;
}
type Fail = (code: CadPartErrorCode, detail: string) => never;
/** Only this fresh evaluation owns a provider. A serialized report supplies no mass authority. */
export declare function cylindricalWrapFeature(source: Part, face: string, rectangle: FormalPadRectangle, height: number, id: string, fail: Fail): Part;
export {};
