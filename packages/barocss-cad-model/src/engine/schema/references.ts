// The document's references schema (R4 D4: the types engine/doc.ts stores, out of chat/references.ts unchanged).
import type { StudioDoc, DocPlane } from '../doc';
import { type EvalResult } from '../evaluate';
import { type Vec3 } from '../mesh';

export type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
export interface Placement { position: Vec3; rotation: Vec3 }
export type ReferenceSource = { step: string } | { mesh: { positions: number[]; indices: number[] } };
export interface Reference { id: string; name: string; source: ReferenceSource; at: Placement; /** Solids in a STEP file that holds several. */ solids?: number }
/** A datum in its reference's own coordinates (or the part's, given explicitly): moved with the reference. */
export interface Datum {
  id: string; name: string; kind: 'plane' | 'axis' | 'point';
  /** The face (or vertex) it was taken from; absent: given. */
  of?: { reference: string; face?: string; vertex?: Vec3 };
  origin: Vec3; normal?: Vec3; xAxis?: Vec3; direction?: Vec3; radius?: number;
  /** The largest distance of the face's vertices from the fitted plane or cylinder (mm). */
  residualMM?: number;
}
export type KeepoutShape = { kind: 'box'; size: Vec3 } | { kind: 'cylinder'; radius: number; height: number };
export interface Keepout {
  id: string; name: string;
  /** Its frame (the part's coordinates): a box from the origin along xAxis, normal × xAxis and normal; a cylinder about the normal. */
  frame: DocPlane; shape: KeepoutShape;
  /** Made from a reference's envelope grown by an offset (kept to say so). */
  around?: { reference: string; offset: number };
  /** The clearance the part must keep from it (mm, 0: not enter). */
  clearance: number;
}
export interface ReferenceSet { version: 1; references: Reference[]; datums: Datum[]; keepouts: Keepout[] }
export type ReferenceCode = 'REFERENCE_LOCKED' | 'BAD_REFERENCE' | 'NO_REFERENCE' | 'DATUM_FIT' | 'BAD_KEEPOUT' | 'NOT_READ';
export type Verdict = 'clear' | 'violated' | 'undecided';
export interface KeepoutResult { keepout: string; body: string; verdict: Verdict; overlapMM3: number; clearanceMM: number | null; requiredMM: number; chordMM: number; why: string }
