import { type Brep } from '../brep/brep-core.js';
import type { CadPartFeature, Result, Tools, PartHelpers, Part } from './part-model.js';
/** A shell or thicken feature's evaluation (part-model.ts's operation() for these kinds). */
export declare function shellOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result;
/**
 * An upright body of one section, hollowed: the section eroded by the thickness (exact for lines and
 * arcs), extruded from the thickness above the bottom to below the top (or through an open top or
 * bottom), and taken away; open side walls let the hollow run through them.
 */
/** The shell of a part, by how it was made (its mass exact when that can be). */
export declare function shellOf(part: Part, t: number, open: string[], at: string, fail: Tools['fail']): Part;
/** Each body of a B-rep on its own: its shells, faces, loops, coedges, edges and vertices. */
export declare function brepBodies(b: Brep): Brep[];
