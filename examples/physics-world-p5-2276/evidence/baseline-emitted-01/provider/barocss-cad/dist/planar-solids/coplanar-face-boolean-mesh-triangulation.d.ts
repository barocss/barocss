import type { CoplanarFaceBooleanResult } from './coplanar-face-boolean.js';
import type { CoplanarFaceBooleanMeshOptions, CoplanarFaceBooleanMeshVertex, CoplanarFaceBooleanMeshTriangulation, CoplanarFaceBooleanMeshDiagnosticCode } from './coplanar-face-boolean-mesh.js';
type Check = (condition: boolean, code: CoplanarFaceBooleanMeshDiagnosticCode, detail: string) => void;
type Native = <T>(action: () => T, detail: string, code?: CoplanarFaceBooleanMeshDiagnosticCode) => T;
export interface CoplanarMaterialGraphWork {
    candidatePairCount: number;
    predicateTestCount: number;
    triangleTestCount: number;
    vertexTripleTestCount: number;
    trianglePairTestCount: number;
}
/** INTERNAL: native vertices only; temporary numeric probes never become mesh or Surface-query vertices. */
export declare function triangulateCoplanarMaterial(region: CoplanarFaceBooleanResult, vertices: CoplanarFaceBooleanMeshVertex[], options: CoplanarFaceBooleanMeshOptions, role: (suffix: string) => string, check: Check, native: Native): {
    triangulation: CoplanarFaceBooleanMeshTriangulation;
    work: CoplanarMaterialGraphWork;
};
export {};
