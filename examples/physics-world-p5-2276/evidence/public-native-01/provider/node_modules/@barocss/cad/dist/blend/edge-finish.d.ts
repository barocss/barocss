import { type Brep } from '../brep/brep-core.js';
import { type FilletReport, type RadiusAt, type SectionShape } from './rolling-ball.js';
import type { Point } from '../types.js';
export type EdgeFinishKind = 'fillet' | 'chamfer';
/**
 * Fillets (radius) or chamfers (distance) the named edges of `body` and the edges continuing them
 * tangentially. Tool faces are named `${id}.face` (the fillet or chamfer surface).
 */
export declare function finishBrepEdges(body: Brep, names: readonly string[], size: number, kind: EdgeFinishKind, id: string, options?: FinishOptions): Brep;
interface FinishOptions {
    readonly reports?: FilletReport[];
    readonly general?: boolean;
    readonly phased?: boolean;
    readonly squareAtCylinders?: boolean;
    readonly generalEdges?: readonly string[]; /** A variable radius (R10.5, D100): the radius at points of the edges, `size` their largest; the rolling ball's. */
    readonly radii?: readonly RadiusAt[]; /** The section's shape (R10.5b, D103); not circular: the rolling ball's. */
    readonly shape?: SectionShape;
}
/** A plane face's true reach across a straight edge, from it along w, for a finish that removes material or adds it (the wedge chamfer's). */
export declare function faceReach(body: Brep, faceId: string, edge: Brep['edges'][number], w: Point, removes?: boolean): number;
export {};
