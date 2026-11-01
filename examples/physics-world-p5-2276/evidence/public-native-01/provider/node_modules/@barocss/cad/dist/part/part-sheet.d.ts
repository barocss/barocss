import { type BendTable, type BendTableUse, type SheetReport } from '../frame-sheet/sheet-metal.js';
import { type Point } from '../types.js';
import { type Brep } from '../brep/brep-core.js';
import type { Result, CadPartFeature, Tools, PartHelpers, Part } from './part-model.js';
/** A sheet-metal feature's evaluation (part-model.ts's operation() for these kinds). */
export declare function sheetOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result;
/** A bend's K: the sheet's, or its table's for T, R and the angle (R12.4, D120); a bend outside the table refused by name. */
export declare function bendK(rules: {
    readonly kFactor?: number;
    readonly bendTable?: BendTable;
}, T: number, R: number, angle: number, what: string, fail: Tools['fail']): {
    kFactor: number;
    use?: BendTableUse;
};
/**
 * An edge flange on a sheet (R12.3, D118; see the feature): its edge's frame (x out across the edge, y up from the picked
 * skin, z along the edge), the plate trimmed and relieved, the flange's section extruded and united; refused where it
 * meets the sheet anywhere but its root.
 */
export declare function sheetFlange(o: {
    part: Part;
    sheet: SheetReport;
    at: string;
    edge: string;
    T: number;
    K: {
        kFactor: number;
        use?: BendTableUse;
    };
    R: number;
    th: number;
    trim: number;
    straight: number;
    off: [number, number];
    relief: {
        kind: 'rectangular' | 'obround';
        width: number;
        depth: number;
    } | null | undefined;
    fail: Tools['fail'];
}): Result;
/** An edge of a B-rep by its name, else by its faces' names without their piece numbers (one such edge). */
export declare function edgeNamed(brep: Brep, name: string, fail: Tools['fail']): Brep['edges'][number];
/**
 * A corner relief on a sheet (R12.3b, D119; see the feature): the corner's frame (x and y into the plate along its two
 * edges, z along the thickness), the square or the quarter disc cut through it; refused unless exactly the plate's corner
 * goes (s² T or π s² T / 4) and the sheet stays one piece.
 */
export declare function sheetCornerRelief(part: Part, sheet: SheetReport, at: string, corner: string, shape: 'square' | 'round', s: number, fail: Tools['fail']): Result;
/** Whether a face has a straight edge along u at T below the plane through A (normal n), overlapping [A, A + Le·u]. */
export declare function hasEdgeBelow(brep: Brep, face: string, A: Point, u: Point, Le: number, n: Point, T: number): boolean;
/** A sheet feature's result: its one part carrying the sheet's report. */
export declare const withSheet: (r: Result, sheet: SheetReport) => Result;
