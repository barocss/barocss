import type { CompatibleRuledSurfaceResult } from '../nurbs/surfaces/compatible-ruled-surface.js';
import type { Curve, Surface, Point } from '../types.js';
import type { CoplanarFaceBooleanResult } from './coplanar-face-boolean.js';
import type { CoplanarFaceBooleanExtrusionOptions, CoplanarFaceBooleanExtrusionResult, CoplanarFaceBooleanExtrusionReport, CoplanarFaceBooleanExtrusionDiagnosticCode } from './coplanar-face-boolean-extrusion.js';
type Check = (condition: boolean, code: CoplanarFaceBooleanExtrusionDiagnosticCode, detail: string) => void;
type Native = <T>(action: () => T, detail: string, code?: CoplanarFaceBooleanExtrusionDiagnosticCode) => T;
export interface NativeCoplanarExtrusionGeometry {
    bottomSupport: Surface;
    topSupport: Surface;
    bottomCurves: Curve[];
    topCurves: Curve[];
    verticalCurves: Curve[];
    walls: CompatibleRuledSurfaceResult[];
    topVertexPoints: Point[];
    sources: CoplanarFaceBooleanExtrusionResult['sources'];
    pointers: Map<string, CoplanarFaceBooleanExtrusionResult['edges'][number]['source']>;
    translationEvidence: CoplanarFaceBooleanExtrusionReport['translationEvidence'];
}
/** INTERNAL admitted geometry only. No UV sidecar is ever sent to the world-mm source writer. */
export declare function buildCoplanarExtrusionGeometry(region: CoplanarFaceBooleanResult, options: CoplanarFaceBooleanExtrusionOptions, normal: Point, translation: Point, role: (suffix: string) => string, check: Check, native: Native): NativeCoplanarExtrusionGeometry;
export {};
