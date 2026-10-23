// R7 (the facade): a part as an immutable object. Every method returns a new Part and leaves this one as it was; every
// modelling method appends feature nodes to the studio document through the core (engine/doc.ts) and computes no
// geometry of its own. `.doc` is always the plain JSON document — the one the agent's tools, the studio, save/open and
// the fingerprints use. Results (mass, STEP) come from the core through ./core, as plain data.
import { emptyDoc, leafBodies, rectanglePart, withNode, type BodyRef, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { MATERIALS } from '../library/materials';
import { bodiesOf, massOf, stepOf, type MassResult } from './core';
import { BodyQuery, type EdgeQuery } from './select';
import { refuse } from './refusal';

export interface HoleOptions {
  /** The hole's centre on the body's sketch plane (mm). */
  at: [number, number];
  diameterMM: number;
  /** A blind hole's depth (mm); left out, the hole goes through. */
  depthMM?: number;
}

export class Part {
  readonly name: string;
  readonly #doc: StudioDoc;
  constructor(name: string, doc: StudioDoc) { this.name = name; this.#doc = doc; }

  /** The plain JSON document (a copy: changing it changes nothing here). */
  get doc(): StudioDoc { return structuredClone(this.#doc); }

  /** A width × depth × height block (mm) with its corner at the origin — the first body of an empty part (more shapes come later). */
  box(widthMM: number, depthMM: number, heightMM: number): Part {
    if (this.#doc.nodes.length) throw refuse('BOX_NOT_FIRST', 'a box starts an empty part; this part has features already');
    return new Part(this.name, rectanglePart(widthMM, depthMM, heightMM));
  }

  /** A round hole into the body, through it unless a depth is given. */
  hole(options: HoleOptions): Part {
    const parent = this.#body();
    return this.#with({ kind: 'hole', parent, center: options.at, radius: options.diameterMM / 2, ...(options.depthMM !== undefined ? { depth: options.depthMM } : {}) });
  }

  /** Rounds the edges a selector picks on the current body. */
  fillet(select: (body: BodyQuery) => EdgeQuery, radiusMM: number): Part {
    const parent = this.#body(), edges = select(this.#query()).names();
    if (!edges.length) throw refuse('SELECTION_EMPTY', 'the selector picked no edge to fillet');
    return this.#with({ kind: 'fillet', parent, edges, radius: radiusMM });
  }

  /** The current body's edges and faces, to look at or to select from. */
  select(): BodyQuery { return this.#query(); }

  /** The body's mass properties in a material of the library (its id, e.g. 'al6061'), in MMGS. */
  mass(material: string): MassResult {
    const m = MATERIALS.find(x => x.id === material);
    if (!m) throw refuse('MATERIAL_UNKNOWN', `no material '${material}' in the library; the ids are ${MATERIALS.map(x => x.id).join(', ')}`);
    return massOf(this.#single(), m.gPerCm3);
  }

  /** The part as one STEP AP214 file (the core's exact solids), named after the part unless another name is given. */
  step(name: string = this.name): string { return stepOf(this.#doc, name); }

  #with(node: Parameters<typeof withNode>[1]): Part { return new Part(this.name, withNode(this.#doc, node)); }

  // (The body a feature acts on: the part's one leaf body. Several bodies need a body chooser, which comes later.)
  #body(): BodyRef {
    const leaves = leafBodies(this.#doc.nodes);
    if (leaves.length === 0) throw refuse('NO_BODY', 'the part has no body yet: start it with box()');
    if (leaves.length > 1) throw refuse('BODY_AMBIGUOUS', `the part has ${leaves.length} bodies; this slice acts on a part of one`);
    return leaves[0];
  }

  #single(): BodyResult {
    this.#body();
    return bodiesOf(this.#doc)[0];
  }

  #query(): BodyQuery { return new BodyQuery(this.#single().mesh); }
}

/** A new, empty part. */
export function part(name = 'part'): Part { return new Part(name, emptyDoc()); }
