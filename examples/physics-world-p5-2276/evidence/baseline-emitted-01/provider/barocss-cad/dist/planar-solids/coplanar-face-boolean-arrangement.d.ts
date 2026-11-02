import type { AffineConvexLineLoopAdmission } from '../intersect/own-affine-plane-loop-internal.js';
import type { ConvexPlanarFaceResult } from '../own-convex-planar-face.js';
import type { Curve, Surface } from '../types.js';
import type { CoplanarFaceBooleanOptions, CoplanarFaceBooleanContributor, CoplanarFaceBooleanEvent, CoplanarFaceBooleanResult, CoplanarFaceBooleanReport, CoplanarFaceBooleanDiagnosticCode } from './coplanar-face-boolean.js';
type Vertex = CoplanarFaceBooleanResult['vertices'][number];
type Check = (condition: boolean, code: CoplanarFaceBooleanDiagnosticCode, detail: string) => void;
type Native = <T>(action: () => T, detail: string, code?: CoplanarFaceBooleanDiagnosticCode) => T;
export interface BooleanFragmentPlan {
    arrangementIndex: number;
    selectedIndex: number;
    source: Curve;
    originalPcurve: Curve;
    contributor: CoplanarFaceBooleanContributor;
    interval: [number, number];
    sense: 'forward' | 'reverse';
    vertexIds: [string, string];
    selectionIndex: number;
}
export interface BooleanLoopPlan {
    vertexIds: string[];
    fragmentIndices: number[];
    signedAreaUV: number;
    areaUncertaintyUV: number;
    role: 'outer' | 'hole';
    componentIndex: number;
}
export interface BooleanArrangement {
    vertices: Vertex[];
    events: CoplanarFaceBooleanEvent[];
    fragments: BooleanFragmentPlan[];
    loops: BooleanLoopPlan[];
    components: {
        outerLoopIndex: number;
        holeLoopIndices: number[];
        areaUV: number;
    }[];
    branch: CoplanarFaceBooleanReport['branch'];
    pairTests: CoplanarFaceBooleanReport['pairTests'];
    selections: CoplanarFaceBooleanReport['selections'];
    coincidentCounterparts: CoplanarFaceBooleanReport['coincidentCounterparts'];
    arrangementVertexCount: number;
    arrangementFragmentCount: number;
}
/** Bounded UV arrangement only. All Curve geometry staging remains in the public native leaf. */
export declare function buildCoplanarArrangement(faceA: ConvexPlanarFaceResult, faceB: ConvexPlanarFaceResult, support: Surface, admissions: [AffineConvexLineLoopAdmission, AffineConvexLineLoopAdmission], options: CoplanarFaceBooleanOptions, role: (suffix: string) => string, check: Check, native: Native): BooleanArrangement;
export {};
