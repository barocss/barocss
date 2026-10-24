// R7 (cad's facade): a kernel part as an immutable object over a CadPartDocument. Every method returns a new Part and
// leaves this one as it was; every modelling method appends kernel features and computes no geometry of its own.
// `.doc` is always the plain CadPartDocument (format 'barocss-cad-part'). Results come from the kernel through ./core.
// The same verbs as cad-model's part (`box`, `hole`, `fillet`, `mass`, `step`, `meshes`), on the kernel's document.
import type { CadPartDocument, CadPartFeature, CadPartOutput } from '../part/part-model.js';
import { massOf, meshOf, outputsOf, selectionOf, stepOf, stlOf, type MassResult, type MeshData } from './core.js';
import type { BodyQuery, EdgeQuery } from './select.js';
import { refuse } from './refusal.js';

export interface HoleOptions {
  /** The hole's centre on the body's sketch plane (mm). */
  at: [number, number];
  diameterMM: number;
  /** A blind hole's depth (mm); left out, the hole goes through. */
  depthMM?: number;
}

const emptyDocument = (): CadPartDocument => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [] });

export class Part {
  readonly name: string;
  readonly #doc: CadPartDocument;
  constructor(name: string, doc: CadPartDocument) { this.name = name; this.#doc = doc; }

  /** The plain CadPartDocument (a copy: changing it changes nothing here). */
  get doc(): CadPartDocument { return structuredClone(this.#doc); }

  /** A width × depth × height block (mm) with its corner at the origin: a rectangle sketch and its extrude — the first body of an empty part. */
  box(widthMM: number, depthMM: number, heightMM: number): Part {
    if (this.#doc.features.length) throw refuse('BOX_NOT_FIRST', 'a box starts an empty part; this part has features already');
    const sketch = this.#id('sketch');
    return this.#with({ id: sketch, kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [widthMM, depthMM] })
      .#with({ id: `extrude${sketch.slice('sketch'.length)}`, kind: 'extrude', sketch, height: heightMM });
  }

  /** A round hole into the body, through it unless a depth is given. */
  hole(options: HoleOptions): Part {
    const target = this.#target();
    return this.#with({ id: this.#id('hole'), kind: 'hole', target, center: options.at, radius: options.diameterMM / 2, ...(options.depthMM !== undefined ? { depth: options.depthMM } : {}) });
  }

  /** Rounds the edges a selector picks on the current body. */
  fillet(select: (body: BodyQuery) => EdgeQuery, radiusMM: number): Part {
    const target = this.#target(), edges = select(selectionOf(this.#single())).names();
    if (!edges.length) throw refuse('SELECTION_EMPTY', 'the selector picked no edge to fillet');
    return this.#with({ id: this.#id('fillet'), kind: 'fillet', target, edges, radius: radiusMM });
  }

  /** The current body's edges and faces, to look at or to select from. */
  select(): BodyQuery { return selectionOf(this.#single()); }

  /** The body's mass properties at a density (g/cm³; the kernel keeps no material library), in MMGS. */
  mass(densityGPerCm3: number): MassResult { return massOf(this.#single(), densityGPerCm3); }

  /** The part as one STEP AP214 file, named after the part unless another name is given. */
  step(name: string = this.name): string { return stepOf(this.#single(), name); }

  /** The part as binary STL. */
  stl(): Uint8Array { return stlOf(this.#single()); }

  /** Each body's display triangles, in the shape gpu's GeometryInput takes. */
  meshes(): MeshData[] { return outputsOf(this.#doc).map(meshOf); }

  #with(feature: CadPartFeature): Part { return new Part(this.name, { ...this.#doc, features: [...this.#doc.features, feature] }); }

  // (A new feature's id: its kind and the next free number — sketch1, extrude1, hole1 …)
  #id(kind: string): string {
    const taken = new Set(this.#doc.features.map(f => f.id));
    let n = 1;
    while (taken.has(`${kind}${n}`)) n++;
    return `${kind}${n}`;
  }

  // (The output a feature acts on: the part's one output. Several bodies need a body chooser, which comes later.)
  #single(): CadPartOutput {
    if (!this.#doc.features.length) throw refuse('NO_BODY', 'the part has no body yet: start it with box()');
    const outputs = outputsOf(this.#doc);
    if (outputs.length === 0) throw refuse('NO_BODY', 'the part has no body yet: start it with box()');
    if (outputs.length > 1) throw refuse('BODY_AMBIGUOUS', `the part has ${outputs.length} bodies; this slice acts on a part of one`);
    return outputs[0];
  }

  #target(): string { return this.#single().id; }
}

/** A new, empty kernel part. */
export function part(name = 'part'): Part { return new Part(name, emptyDocument()); }
