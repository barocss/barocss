import type { CadPartDocument } from '../part/part-model.js';
import { Part, type PartBackend } from './part.js';
export declare const kernelBackend: PartBackend<CadPartDocument>;
/** A kernel part: the one part over a CadPartDocument, with the kernel's STL besides. */
export declare class KernelPart extends Part<CadPartDocument> {
    /** The body as binary STL (its display tessellation). */
    stl(): Uint8Array;
}
/**
 * A new kernel part, empty — or continuing from a document of your own (a saved one, or another part's `.doc`): it is
 * evaluated once, and the part's verbs add to it.
 */
export declare function part(name?: string, doc?: CadPartDocument): KernelPart;
