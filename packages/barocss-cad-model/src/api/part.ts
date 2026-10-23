// R7 (the facade): a part as an immutable object. Every method returns a new Part and leaves this one as it was; every
// modelling method appends feature nodes to the studio document through the core (engine/doc.ts) and computes no
// geometry of its own. `.doc` is always the plain JSON document — the one the agent's tools, the studio, save/open and
// the fingerprints use. Results (mass, STEP) are the core's, as plain data.
import { emptyDoc, leafBodies, rectanglePart, withNode, type BodyRef, type StudioDoc } from '../engine/doc';
import { evaluateDoc, stepFor, type BodyResult } from '../engine/evaluate';
import { bodyMass } from '../app/mass';
import { MATERIALS } from '../library/materials';
import { BodyQuery, type EdgeQuery } from './select';
import { ApiRefusal, fromEvaluation, fromExport } from './refusal';

export type Vec3 = [number, number, number];

/** A body's mass properties in a material: the core's volume, and its mass, centre of mass and inertia (kg·mm², about the centre). */
export interface MassResult { volumeMM3: number; massG: number; centroid: Vec3; inertia: number[][] }

export interface HoleOptions {
  /** The hole's centre on the body's sketch plane (mm). */
  at: [number, number];
  diameter: number;
  /** A blind hole's depth (mm); left out, the hole goes through. */
  depth?: number;
}

// (The evaluation's revision tag: the facade keeps no revision history of its own; the core's evaluation memo keys on the document.)
const REVISION = 0;

function evaluated(doc: StudioDoc): BodyResult[] {
  const result = evaluateDoc(doc, REVISION);
  if (!result.ok) throw fromEvaluation(result.error);
  return result.bodies;
}

export class Part {
  readonly name: string;
  readonly #doc: StudioDoc;
  constructor(name: string, doc: StudioDoc) { this.name = name; this.#doc = doc; }

  /** The plain JSON document (a copy: changing it changes nothing here). */
  get doc(): StudioDoc { return structuredClone(this.#doc); }

  /** A width × depth × height block with its corner at the origin — the first body of an empty part (more shapes come later). */
  box(width: number, depth: number, height: number): Part {
    if (this.#doc.nodes.length) throw new ApiRefusal('BOX_NOT_FIRST', 'a box starts an empty part; this part has features already', 'facade');
    return new Part(this.name, rectanglePart(width, depth, height));
  }

  /** A round hole into the body, through it unless a depth is given. */
  hole(options: HoleOptions): Part {
    const parent = this.#body();
    return this.#with({ kind: 'hole', parent, center: options.at, radius: options.diameter / 2, ...(options.depth !== undefined ? { depth: options.depth } : {}) });
  }

  /** Rounds the edges a selector picks on the current body. */
  fillet(select: (body: BodyQuery) => EdgeQuery, radius: number): Part {
    const parent = this.#body(), edges = select(this.#query()).names();
    if (!edges.length) throw new ApiRefusal('SELECTION_EMPTY', 'the selector picked no edge to fillet', 'facade');
    return this.#with({ kind: 'fillet', parent, edges, radius });
  }

  /** The current body's edges and faces, to look at or to select from. */
  select(): BodyQuery { return this.#query(); }

  /** The body's mass properties in a material of the library (its id, e.g. 'al6061'). */
  mass(material: string): MassResult {
    const m = MATERIALS.find(x => x.id === material);
    if (!m) throw new ApiRefusal('MATERIAL_UNKNOWN', `no material '${material}' in the library; the ids are ${MATERIALS.map(x => x.id).join(', ')}`, 'facade');
    const body = this.#single(), props = bodyMass(body, m.gPerCm3);
    if (!props || body.volumeMM3 === null) throw new ApiRefusal('MASS_UNKNOWN', `the body ${body.key} has no volume the core could work out`, 'evaluate');
    return { volumeMM3: body.volumeMM3, massG: props.massG, centroid: props.centroid, inertia: props.inertia };
  }

  /** The part as one STEP AP214 file (the core's exact solids), named after the part unless another name is given. */
  step(name: string = this.name): string {
    const out = stepFor(this.#doc, name);
    if ('error' in out) throw fromExport(out.error);
    return out.text;
  }

  #with(node: Parameters<typeof withNode>[1]): Part { return new Part(this.name, withNode(this.#doc, node)); }

  // (The body a feature acts on: the part's one leaf body. Several bodies need a body chooser, which comes later.)
  #body(): BodyRef {
    const leaves = leafBodies(this.#doc.nodes);
    if (leaves.length === 0) throw new ApiRefusal('NO_BODY', 'the part has no body yet: start it with box()', 'facade');
    if (leaves.length > 1) throw new ApiRefusal('BODY_AMBIGUOUS', `the part has ${leaves.length} bodies; this slice acts on a part of one`, 'facade');
    return leaves[0];
  }

  #single(): BodyResult {
    this.#body();
    return evaluated(this.#doc)[0];
  }

  #query(): BodyQuery { return new BodyQuery(this.#single().mesh); }
}

/** A new, empty part. */
export function part(name = 'part'): Part { return new Part(name, emptyDoc()); }
