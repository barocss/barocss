// R7 (the facades): the one part implementation (api-conventions.md §11). A part is an immutable object over a
// document; every verb — named for the agent's v2 command, its options the command's values with units (§12) — becomes
// a spec once, here, and a backend writes it into its document. cad's backend (./kernel) writes CadPartDocument
// features; cad-model's part extends this class with its studio backend and adds only the studio layer. Results come
// from each backend's adapter onto its core, as plain data.
import { boxSpec, filletSpec, holeSpec, type BoxOptions, type FeatureSpec, type FilletOptions, type HoleOptions } from './spec.js';
import type { BodyQuery, EdgeQuery, FaceQuery } from './select.js';
import type { MassResult, MeshData } from './core.js';
import { refuse } from './refusal.js';

/** What a document kind provides the part: its empty document, how a spec is written into it, and its core's results. */
export interface PartBackend<D> {
  empty(): D;
  copy(doc: D): D;
  /** The spec written into the document (a new one; the old one unchanged), or the core's refusal. */
  apply(doc: D, spec: FeatureSpec): D;
  /** The part's one body's edges and faces. */
  select(doc: D): BodyQuery;
  /** The body's mass properties at a density (g/cm³), in MMGS. */
  mass(doc: D, densityGPerCm3: number): MassResult;
  step(doc: D, name: string): string;
  meshes(doc: D): MeshData[];
}

/** A density, the kernel's way of asking for mass (it keeps no material library; cad-model's part also takes a material id). */
export interface Density { densityGPerCm3: number }

export class Part<D> {
  readonly name: string;
  protected readonly backend: PartBackend<D>;
  readonly #doc: D;
  constructor(backend: PartBackend<D>, name: string, doc: D) { this.backend = backend; this.name = name; this.#doc = doc; }

  /** The plain document (a copy: changing it changes nothing here). */
  get doc(): D { return this.backend.copy(this.#doc); }

  /** A new part of this kind on another document (a subclass keeps its own kind). */
  protected next(doc: D): this { return new (this.constructor as new (backend: PartBackend<D>, name: string, doc: D) => this)(this.backend, this.name, doc); }
  protected get document(): D { return this.#doc; }

  /** `box`: a w × d × h block with its least corner at (x, y, z). */
  box(options: BoxOptions): this { return this.#apply(boxSpec(options)); }

  /** `hole`: a round hole into the one flat face a selector picks, at (x, y) on that face's plane; through unless blind. */
  hole(face: (body: BodyQuery) => FaceQuery, options: HoleOptions): this {
    const picked = face(this.select());
    if (picked.count !== 1) throw refuse('SELECTION_ONE', `a hole goes into one face; the selector picked ${picked.count}`);
    const [f] = picked.list();
    if (f.kind !== 'plane') throw refuse('FACE_NOT_FLAT', `a hole goes into a flat face; ${f.name} is curved`);
    return this.#apply(holeSpec(f.name, options));
  }

  /** `fillet`: rounds the edges a selector picks. */
  fillet(edges: (body: BodyQuery) => EdgeQuery, options: FilletOptions): this { return this.#apply(filletSpec(edges(this.select()).names(), options)); }

  /** The part's one body's edges and faces, to look at or to select from. */
  select(): BodyQuery { return this.backend.select(this.#doc); }

  /** The body's mass properties at a density, in MMGS. */
  mass(density: Density): MassResult { return this.backend.mass(this.#doc, density.densityGPerCm3); }

  /** The part as one STEP AP214 file, named after the part unless another name is given. */
  step(name: string = this.name): string { return this.backend.step(this.#doc, name); }

  /** Each body's display triangles, in the common mesh shape (§10.3) gpu's GeometryInput takes. */
  meshes(): MeshData[] { return this.backend.meshes(this.#doc); }

  #apply(spec: FeatureSpec): this { return this.next(this.backend.apply(this.#doc, spec)); }
}
