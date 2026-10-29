// R7 (the facades): the one part implementation (api-conventions.md §11). A part is an immutable object over a
// document; every verb — named for the agent's v2 command, its options the command's values with units (§12) — becomes
// a spec once, here, and a backend writes it into its document. cad's backend (./kernel) writes CadPartDocument
// features; cad-model's part extends this class with its studio backend and adds only the studio layer. Results come
// from each backend's adapter onto its core, as plain data.
//
// A part of several bodies (a second box, a split, a tool for a Boolean) acts on the one `body(name)` chose; with one
// body that body is meant. The choice is the facade's view of the document, never written into it: `.doc` is the same
// with or without it. It follows the body through the verbs that replace it (a fillet's result is the filleted body).
import {
  booleanSpec, cylindricalWrapSpec, boxSpec, chamferSpec, circularPatternSpec, curveFeaturePatternSpec, cylinderSpec, extrudeSpec, filletSpec, holeSpec, linearFeaturePatternSpec, rectangularFeaturePatternSpec, linearPatternSpec, mirrorSpec, moveSpec, revolveSpec, rotateSpec, scaleSpec, shellSpec, splitSpec,
  type BooleanCommand, type CylindricalWrapOptions, type BoxOptions, type ChamferOptions, type CircularPatternOptions, type CylinderOptions, type ExtrudeOptions, type FeatureSpec, type FilletOptions,
  type HoleOptions, type RectangularFeaturePatternOptions, type CurveFeaturePatternOptions, type LinearPatternOptions, type MirrorOptions, type RevolveOptions, type ScaleOptions, type ShellOptions, type SplitOptions,
  type Bound, type Resolved, isParam,
} from './spec.js';
import type { BodyQuery, EdgeQuery, FaceQuery } from './select.js';
import { Location, type Sketch } from './sketch.js';
import type { MassResult, MeshData } from './core.js';
import { refuse } from './refusal.js';

/** What a document kind provides the part: its empty document, how a spec is written into it, and its core's results. */
export interface PartBackend<D> {
  empty(): D;
  copy(doc: D): D;
  /** The document's bodies by name, in the core's order (the studio's keys `b1` …, the kernel's output ids). */
  bodies(doc: D): string[];
  /** The spec written into the document (a new one; the old one unchanged), acting on `body` (null: a verb that makes one), or the core's refusal. */
  apply(doc: D, spec: FeatureSpec, body: string | null): D;
  /** A body's edges and faces. */
  select(doc: D, body: string): BodyQuery;
  /** A body's mass properties at a density (g/cm³), in MMGS. */
  mass(doc: D, body: string, density: number): MassResult;
  /** Every body of the part as one STEP AP214 file. */
  step(doc: D, name: string): string;
  meshes(doc: D): MeshData[];
  /** The document's parameters (R7.4d), and the document with them replaced, evaluated (its refusal, typed). */
  parameters(doc: D): Readonly<Record<string, number>>;
  withParameters(doc: D, parameters: Record<string, number>): D;
  /** Its features by stable id, in order. */
  features(doc: D): FeatureInfo[];
  /** The feature suppressed or not (the studio's History toggle), evaluated; refused where the document can't hold it. */
  suppress(doc: D, id: string, suppressed: boolean): D;
}

/** A feature as `features()` lists it: its stable id, kind and the studio's label for it. */
export interface FeatureInfo { readonly id: string; readonly kind: string; readonly label: string }

/** A parameter's name, as the studio's Parameters panel takes one: a letter, then letters, digits and _, up to 32. */
const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

/**
 * `withParameters(doc, edits) → doc` (R7.4d, api-conventions §4): a document's parameters given new values — each must
 * be one it has, each value a finite number — as the Parameters panel writes a value (the order kept). Pure; the
 * document is evaluated by whoever uses it.
 */
export function withParameters<D extends { readonly parameters: Readonly<Record<string, number>> }>(doc: D, edits: Readonly<Record<string, number>>): D {
  const unknown = Object.keys(edits).filter(k => !Object.prototype.hasOwnProperty.call(doc.parameters, k));
  if (unknown.length) throw refuse('PARAMETER_UNKNOWN', `no parameter ${unknown.join(', ')}; the parameters are ${Object.keys(doc.parameters).join(', ') || 'none'}`);
  for (const [k, v] of Object.entries(edits)) if (typeof v !== 'number' || !Number.isFinite(v)) throw refuse('VALUE', `${k} takes a number, not ${String(v)}`);
  return { ...doc, parameters: { ...doc.parameters, ...edits } };
}

/**
 * A density in g/cm³, the way materials are quoted (api-conventions §2) — the kernel's way of asking for mass (it keeps
 * no material library; cad-model's part also takes a material id).
 */
export interface Density { density: number }

/** A Boolean's tool: a body of the part by name, or a callback that adds the tool body to the part (`p => p.cylinder(…)`). */
export type Tool<P> = string | ((part: P) => P);

const AXES = ['x', 'y', 'z'] as const;
// (A Boolean's tool callback builds in the part's own document: there, the body a verb makes is chosen, so the verbs
// after it — a pattern, a fillet — act on the tool being built, not on the part's other bodies. No body is named so.)
const TOOL = '\u0000tool';

export class Part<D> {
  readonly name: string;
  protected readonly backend: PartBackend<D>;
  readonly #doc: D;
  readonly #focus: string | null;
  constructor(backend: PartBackend<D>, name: string, doc: D, focus: string | null = null) { this.backend = backend; this.name = name; this.#doc = backend.copy(doc); this.#focus = focus; }

  /** The plain document (a copy: changing it changes nothing here). */
  get doc(): D { return this.backend.copy(this.#doc); }

  /** A new part of this kind on another document (a subclass keeps its own kind). */
  protected next(doc: D, focus: string | null = null): this {
    return new (this.constructor as new (backend: PartBackend<D>, name: string, doc: D, focus: string | null) => this)(this.backend, this.name, doc, focus);
  }
  protected get document(): D { return this.#doc; }
  /** The body chosen with body(name), or null. */
  protected get focus(): string | null { return this.#focus; }

  /** The part's bodies by name, in the core's order. */
  bodies(): string[] { return this.backend.bodies(this.#doc); }

  /** The same part, its verbs acting on the body of that name (see `bodies()`). */
  body(name: string): this {
    const all = this.bodies();
    if (!all.includes(name)) throw refuse('BODY_UNKNOWN', `no body ${name} in the part; its bodies are ${all.join(', ') || 'none'}`);
    return this.next(this.#doc, name);
  }

  /** `parameter`: a named value the part's dimensions can take (`param(name)`), added or set — the Parameters panel's. */
  parameter(name: string, value: number): this {
    if (typeof name !== 'string' || !PARAMETER_NAME.test(name)) throw refuse('PARAMETER_NAME', `a parameter's name starts with a letter and has letters, digits and _ (up to 32), not ${JSON.stringify(name)}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw refuse('VALUE', `${name} takes a number, not ${String(value)}`);
    return this.next(this.backend.withParameters(this.#doc, { ...this.backend.parameters(this.#doc), [name]: value }), this.#focus);
  }

  /** The part's parameters and their values. */
  parameters(): Record<string, number> { return { ...this.backend.parameters(this.#doc) }; }

  /** The same part with parameters given new values (see the `withParameters` function), evaluated again. */
  withParameters(edits: Readonly<Record<string, number>>): this {
    return this.next(this.backend.withParameters(this.#doc, withParameters({ parameters: this.backend.parameters(this.#doc) }, edits).parameters), this.#focus);
  }

  /** The part's features by stable id (`n3`, `fillet1` …), in order: the last is the one a verb just added. */
  features(): FeatureInfo[] { return this.backend.features(this.#doc); }

  /** A feature suppressed (left out of the model, kept in its history) or not, by its id — the History panel's toggle. */
  suppressed(id: string, suppressed = true): this {
    if (!this.features().some(f => f.id === id)) throw refuse('FEATURE_UNKNOWN', `no feature ${id}; the features are ${this.features().map(f => f.id).join(', ') || 'none'}`);
    return this.next(this.backend.suppress(this.#doc, id, suppressed), null);
  }

  /** The body a verb acts on: the chosen one, else the part's one body. */
  protected target(): string {
    if (this.#focus === TOOL) throw refuse('NO_BODY', 'a Boolean\'s tool callback acts on the tool it makes: start it with box(), cylinder(), extrude() or revolve()');
    if (this.#focus !== null) return this.#focus;
    const all = this.bodies();
    if (all.length === 0) throw refuse('NO_BODY', 'the part has no body yet: start it with box(), cylinder(), extrude() or revolve()');
    if (all.length > 1) throw refuse('BODY_AMBIGUOUS', `the part has ${all.length} bodies (${all.join(', ')}): choose one with body(name)`);
    return all[0];
  }

  /** `box`: a w × d × h block with its least corner at (x, y, z), a body of its own. */
  box(options: BoxOptions): this { return this.#make(this.#spec(options, o => boxSpec(o))); }

  /** `cylinder`: a round bar of radius r and height h standing on z about (x, y), a body of its own. */
  cylinder(options: CylinderOptions): this { return this.#make(this.#spec(options, o => cylinderSpec(o))); }

  /** `extrude`: a finished sketch pulled along its plane's normal, a body of its own. */
  extrude(profile: Sketch, options: ExtrudeOptions): this { return this.#make(this.#spec(options, o => extrudeSpec(profile, o))); }

  /** `revolve`: a finished sketch turned about its plane's Y axis (or X), a body of its own. */
  revolve(profile: Sketch, options?: RevolveOptions): this { return this.#make(this.#spec(options ?? {}, o => revolveSpec(profile, o))); }

  /** `hole`: a round hole into the one flat face a selector picks, at (x, y) on that face's plane; through unless blind. */
  hole(face: (body: BodyQuery) => FaceQuery, options: HoleOptions): this {
    const picked = face(this.select());
    if (picked.count !== 1) throw refuse('SELECTION_ONE', `a hole goes into one face; the selector picked ${picked.count}`);
    const [f] = picked.list();
    if (f.kind !== 'plane') throw refuse('FACE_NOT_FLAT', `a hole goes into a flat face; ${f.name} is curved`);
    return this.#act(this.#spec(options, o => holeSpec(f.name, o)));
  }

  /** `fillet`: rounds the edges a selector picks. */
  fillet(edges: (body: BodyQuery) => EdgeQuery, options: FilletOptions): this {
    return this.#act(this.#spec(options, o => {
      const picked = edges(this.select()), spec = filletSpec(picked.names(), o, picked.list());
      if (o.endRadius !== undefined && (isParam(options.radius) || (o.endRadius === o.radius && isParam(options.endRadius)))) throw refuse('PARAMETER_UNBINDABLE', 'an explicit fillet endRadius can bind only while varying; its start radius must be numeric');
      return spec;
    }));
  }

  /** Add a tolerance-qualified closed-reference pad over one strict original-UV rectangle. */
  cylindricalWrap(faces: (body: BodyQuery) => FaceQuery, options: CylindricalWrapOptions): this {
    return this.#act(this.#spec(options, o => {
      const picked = faces(this.select());
      if (picked.count !== 1) throw refuse('SELECTION_ONE', 'cylindrical wrap needs exactly one original positive-Y cylinder wall');
      return cylindricalWrapSpec(picked.names()[0], o);
    }));
  }

  /** `chamfer`: cuts the edges a selector picks at 45°. */
  chamfer(edges: (body: BodyQuery) => EdgeQuery, options: ChamferOptions): this { return this.#act(this.#spec(options, o => chamferSpec(edges(this.select()).names(), o))); }

  /** `shell`: hollows the body to walls t thick, leaving the faces a selector picks open — or, given no selector, closed. */
  shell(options: ShellOptions): this;
  shell(open: (body: BodyQuery) => FaceQuery, options: ShellOptions): this;
  shell(a: ShellOptions | ((body: BodyQuery) => FaceQuery), b?: ShellOptions): this {
    if (typeof a !== 'function') return this.#act(this.#spec(a, o => shellSpec([], o)));
    const open = a(this.select());
    if (!open.count) throw refuse('SELECTION_EMPTY', 'the selector picked no face to leave open (a closed hollow takes no selector)');
    return this.#act(this.#spec(b!, o => shellSpec(open.names(), o)));
  }

  /** `union`: the body joined with a tool body. */
  union(tool: Tool<this>): this { return this.#combine('union', tool); }
  /** `difference` (the palette's Subtract): the tool body cut out of the body. */
  subtract(tool: Tool<this>): this { return this.#combine('difference', tool); }
  /** `intersect`: only where the body and the tool body overlap. */
  intersect(tool: Tool<this>): this { return this.#combine('intersect', tool); }

  /** `linear-pattern`: copies of the body in a row along an axis, joined into one body. */
  linearPattern(options: LinearPatternOptions): this { return this.#act(this.#spec(options, o => linearPatternSpec(o))); }
  /** Repeat the current difference's cut along an axis, including the original cut. */
  linearFeaturePattern(options: LinearPatternOptions): this { return this.#act(this.#spec(options, o => linearFeaturePatternSpec(o))); }
  /** Repeat the current difference's cut on two distinct global axes. */
  rectangularFeaturePattern(options: RectangularFeaturePatternOptions): this { return this.#act(this.#spec(options, o => rectangularFeaturePatternSpec(o))); }
  /** Repeat a difference's cut along an open polyline without rotating its tool. */
  curveFeaturePattern(options: CurveFeaturePatternOptions): this { return this.#act(this.#spec(options, o => curveFeaturePatternSpec(o))); }
  /** `circular-pattern`: copies of the body round an axis, joined into one body. */
  circularPattern(options: CircularPatternOptions): this { return this.#act(this.#spec(options, o => circularPatternSpec(o))); }

  /** `mirror`: the body joined with its mirror image across a coordinate plane (through `at` on its axis). */
  mirror(options: MirrorOptions): this { return this.#act(this.#spec(options, o => mirrorSpec(o))); }
  /** `scale`: the body scaled uniformly about a pivot, the origin unless given. */
  scale(options: ScaleOptions): this { return this.#act(this.#spec(options, o => scaleSpec(o))); }
  /** `split`: the body cut in two by a plane, each side a body of its own (choose one with body(name)). */
  split(options: SplitOptions): this { return this.#act(this.#spec(options, o => splitSpec(o))); }

  /**
   * The body placed by a Location: `rotate` about X, then Y, then Z through the origin, then `move` — the two commands,
   * one node each for every part of the placement that isn't zero.
   */
  moved(location: Location): this {
    if (!(location instanceof Location)) throw refuse('VALUE', 'moved() takes a Location (Location.of({ position, rotation }), Location.at(…))');
    const r = location.rotation, p = location.position;
    let out = this.next(this.#doc, this.#focus);
    for (const k of [0, 1, 2] as const) if (r[k] !== 0) out = out.#act(rotateSpec(AXES[k], r[k]));
    if (p[0] !== 0 || p[1] !== 0 || p[2] !== 0) out = out.#act(moveSpec([p[0], p[1], p[2]]));
    return out;
  }

  /** The body's edges and faces, to look at or to select from. */
  select(): BodyQuery { return this.backend.select(this.#doc, this.target()); }

  /** The body's mass properties at a density, in MMGS. */
  mass(density: Density): MassResult { return this.backend.mass(this.#doc, this.target(), density.density); }

  /** The part (every body) as one STEP AP214 file, named after the part unless another name is given. */
  step(name: string = this.name): string { return this.backend.step(this.#doc, name); }

  /** Each body's display triangles, in the common mesh shape (§10.3) gpu's GeometryInput takes. */
  meshes(): MeshData[] { return this.backend.meshes(this.#doc); }

  // (A verb's options with each parameter read as its number, so the spec is checked as a number is; the options given
  // as parameters ride on the spec, and the backend binds them where its document holds the reference.)
  #spec<O extends object>(options: O, build: (resolved: Resolved<O>) => FeatureSpec): FeatureSpec {
    const params = this.backend.parameters(this.#doc), out = { ...options } as Record<string, unknown>, bound: { option: string; parameter: string }[] = [];
    for (const [k, v] of Object.entries(options)) {
      if (!isParam(v)) continue;
      if (!Object.prototype.hasOwnProperty.call(params, v.parameter)) throw refuse('PARAMETER_UNKNOWN', `no parameter ${v.parameter}; add it with parameter(name, value) (the parameters are ${Object.keys(params).join(', ') || 'none'})`);
      out[k] = params[v.parameter]; bound.push({ option: k, parameter: v.parameter });
    }
    const spec = build(out as Resolved<O>);
    return bound.length ? { ...spec, bound: bound as Bound } : spec;
  }

  /** For a part kind's own verbs (cad-model's studio commands): a spec that makes a body, and one that acts on the chosen one. */
  protected makes(spec: FeatureSpec): this { return this.#make(spec); }
  protected acts(spec: FeatureSpec): this { return this.#act(spec); }

  // (A verb that makes a body of its own: the choice stays as it was.)
  #make(spec: FeatureSpec): this {
    if (this.#focus !== TOOL) return this.next(this.backend.apply(this.#doc, spec, null), this.#focus);
    const before = this.bodies(), doc = this.backend.apply(this.#doc, spec, null), made = this.backend.bodies(doc).filter(b => !before.includes(b));
    return this.next(doc, made.length === 1 ? made[0] : null);
  }

  // (A verb acting on the body: the choice follows it to the body that replaces it — the one new body, when the chosen
  // one is gone — and is dropped when no single body does.)
  #act(spec: FeatureSpec): this {
    const body = this.target(), before = this.bodies(), doc = this.backend.apply(this.#doc, spec, body);
    if (this.#focus === null) return this.next(doc, null);
    const after = this.backend.bodies(doc), made = after.filter(b => !before.includes(b));
    return this.next(doc, after.includes(this.#focus) ? this.#focus : made.length === 1 ? made[0] : null);
  }

  #combine(command: BooleanCommand, tool: Tool<this>): this {
    const body = this.target();
    if (typeof tool === 'string') {
      if (tool === body) throw refuse('VALUE', `a Boolean takes two bodies; ${tool} is the body itself`);
      if (!this.bodies().includes(tool)) throw refuse('BODY_UNKNOWN', `no body ${tool} in the part; its bodies are ${this.bodies().join(', ')}`);
      return this.#act(booleanSpec(command, tool));
    }
    if (typeof tool !== 'function') throw refuse('VALUE', 'a Boolean\'s tool is a body\'s name or a callback adding it (p => p.cylinder(…))');
    // (The tool built in this part's own document, so its nodes take the next ids, as the studio makes a second body
    // before combining the two: exactly one new body, the chosen one still there.)
    const before = this.bodies(), built = tool(this.next(this.#doc, TOOL));
    if (!(built instanceof Part)) throw refuse('VALUE', 'a Boolean\'s tool callback returns the part with the tool body added');
    const after = built.bodies(), made = after.filter(b => !before.includes(b));
    if (!after.includes(body)) throw refuse('VALUE', `the tool callback changed the body ${body} itself; it only adds the tool`);
    if (made.length !== 1) throw refuse('SELECTION_ONE', `a Boolean's tool callback adds one body; it added ${made.length}`);
    return built.next(built.#doc, body).#act(booleanSpec(command, made[0])).#refocus(this.#focus);
  }

  // (After a Boolean built on a chosen body: keep the choice only if there was one.)
  #refocus(was: string | null): this { return was === null ? this.next(this.#doc, null) : this; }
}
