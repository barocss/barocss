// R7.5 (cad-model's facade): an immutable assembly over the studio document — the base part (fixed at the origin) and
// parts placed beside it, mated by their faces, with the assembly's inputs and variants (O11) and its robot frames
// (O12). Its verbs carry the agent's v2 assembly actions' names (api-conventions §12): addPart, place, addMate, inputs,
// variants, frames. `.doc` is the StudioDoc the agent's tools, the studio and save/open use; every change is the one the
// tool writes (./assemblyCore), the assembly solved again after it. Results are plain data.
import { Location, refuse, type BodyQuery, type FaceQuery, type Vec3 } from '@barocss/cad/api';
import type { StudioDoc } from '../engine/doc';
import type { MateKind } from '../assembly/mates';
import type { FrameSettings } from '../robot/frames';
import type { MeshData } from './core';
import { meshSelection } from './select';
import { bodiesOf } from './core';
import { addMateDoc, addPartDoc, lockDoc, assemblyMeshes, BASE, emptyDoc, framePosesOf, framesDoc, placePartDoc, problemsOf, variabilityDoc, variantDoc } from './assemblyCore';
import { part as studioPart, StudioPart } from './part';
import { Robot } from './robot';
import { drawingDoc, drawingOf, outputOf } from './outputs';
import type { DrawingSettingsInput } from './part';

// (Document fields are mutable tuples; what the facade hands back is §10.2's readonly Vec3.)
type XYZ = [number, number, number];

/** A face a mate holds: on the base part (`'base'`) or a placed part (by the name it was added with), by a selector or its name. */
export interface MateEnd { part: string; face: string | ((body: BodyQuery) => FaceQuery); body?: string }
/** A mate's values: a distance's mm, an angle's degrees, `flip` as the studio's (api: assembly.add_mate). */
export interface MateOptions { distance?: number; angle?: number; flip?: boolean }
/** A tool or sensor frame (O12) on a link — the base part or a placed part, by name — at a Location in that part's own coordinates. */
export interface FrameOptions { link: string; at?: Location; kind?: 'tool' | 'sensor' }

const toVec = (v: readonly number[]): XYZ => [v[0], v[1], v[2]];

export class Assembly {
  readonly name: string;
  readonly #doc: StudioDoc;
  constructor(name: string, doc: StudioDoc) { this.name = name; this.#doc = structuredClone(doc); }

  /** The plain document (a copy). */
  get doc(): StudioDoc { return structuredClone(this.#doc); }

  /** The base part and the placed parts: their ids (`base`, `p1` …) and names. */
  parts(): { id: string; name: string }[] { return [{ id: BASE, name: BASE }, ...(this.#doc.instances ?? []).map(i => ({ id: i.id, name: i.name }))]; }

  /** A part's id by the name it was added with (`base` is the base part). */
  idOf(name: string): string {
    if (name === BASE) return BASE;
    const found = (this.#doc.instances ?? []).find(i => i.name === name);
    if (!found) throw refuse('PART_UNKNOWN', `no part ${name} in the assembly; its parts are ${this.parts().map(p => p.name).join(', ')}`);
    return found.id;
  }

  /** `assembly.add_part`: a part placed beside the base part, at a Location (its own origin there), grounded or free. */
  addPart(name: string, part: StudioPart, options: { at?: Location; grounded?: boolean } = {}): Assembly {
    if (typeof name !== 'string' || !name.trim() || name.trim() !== name) throw refuse('VALUE', 'a part\'s name is a non-empty string without surrounding spaces');
    if (name === BASE || (this.#doc.instances ?? []).some(i => i.name === name)) throw refuse('NAME_TAKEN', `the assembly already has a part named ${name}`);
    if (!(part instanceof StudioPart)) throw refuse('VALUE', 'addPart takes a studio part (part() from @barocss/cad-model/api)');
    const at = options.at ?? Location.IDENTITY;
    if (!(at instanceof Location)) throw refuse('VALUE', 'a part is placed at a Location');
    return new Assembly(this.name, addPartDoc(this.#doc, name, part.doc, toVec(at.position), toVec(at.rotation), options.grounded === true).doc);
  }

  /** `assembly.place`: a placed part moved to a Location, or grounded (true) or freed (false). Mates still place it where they fix it. */
  place(name: string, o: { at?: Location; grounded?: boolean }): Assembly {
    const id = this.idOf(name);
    if (id === BASE) throw refuse('VALUE', 'the base part stays at the origin');
    if (o.at !== undefined && !(o.at instanceof Location)) throw refuse('VALUE', 'a part is placed at a Location');
    return new Assembly(this.name, placePartDoc(this.#doc, id, { ...(o.at ? { position: toVec(o.at.position), rotation: toVec(o.at.rotation) } : {}), ...(o.grounded !== undefined ? { grounded: o.grounded } : {}) }));
  }

  /**
   * `assembly.add_mate`: a mate between a face of each of two parts — coincident, concentric, distance, angle or
   * tangent. The second part moves (a fixed second and a free first swap, as in the studio), solved exactly.
   */
  addMate(kind: Exclude<MateKind, 'lock'>, a: MateEnd, b: MateEnd, options: MateOptions = {}): Assembly {
    if (kind === 'distance' && !Number.isFinite(options.distance)) throw refuse('VALUE', 'a distance mate needs distance');
    if (kind === 'angle' && !Number.isFinite(options.angle)) throw refuse('VALUE', 'an angle mate needs angle (degrees)');
    const ea = this.#end(a), eb = this.#end(b);
    return new Assembly(this.name, addMateDoc(this.#doc, kind, ea, eb, { distance: options.distance, angle: options.angle, flip: options.flip }).doc);
  }

  /** A placed part locked where it stands to another (the base part unless named) — the studio's Lock: they move as one. */
  lock(name: string, to = BASE): Assembly {
    const id = this.idOf(name), other = this.idOf(to);
    if (id === BASE) throw refuse('VALUE', 'the base part stays at the origin; lock another part to it');
    if (id === other) throw refuse('VALUE', `${name} can't be locked to itself`);
    return new Assembly(this.name, lockDoc(this.#doc, id, other).doc);
  }

  /** `set_drawing` on the assembly: its drawing's settings — scope { kind: 'assembly' }, the BOM table, balloons, sheet, views … */
  drawingSettings(o: DrawingSettingsInput): Assembly { return new Assembly(this.name, drawingDoc(this.#doc, 'set_drawing', o)); }
  /** The assembly's drawing: drawing_issues' reply and its files (SVG, DXF, PDF), as a part's. */
  drawing() { return drawingOf(this.#doc); }

  /** output_bom's reply: the BOM (each part's line, the bought elements', the totals) and bom.json. Async: the tool's own. */
  bom() { return outputOf(this.#doc, 'output_bom'); }
  /** output_purchase_csv's reply: the purchase list (bought lines; with the made ones too when `withMade`) and purchase.csv. */
  purchaseCsv(withMade = false) { return outputOf(this.#doc, 'output_purchase_csv', withMade ? { withMade } : {}); }

  /** `assembly.inputs` (O11): inputs added or replaced by name, null removing one — the core's input shape, bindings by part and mate id. */
  inputs(inputs: Record<string, Record<string, unknown> | null>): Assembly { return new Assembly(this.name, variabilityDoc(this.#doc, 'set_inputs', { inputs })); }

  /** `assembly.variants` (O11): named sets of input values (null deletes one), and which is active (null: the master). */
  variants(variants: Record<string, Record<string, number | boolean | string> | null>, active?: string | null): Assembly {
    return new Assembly(this.name, variabilityDoc(this.#doc, 'set_variants', { variants, ...(active !== undefined ? { active } : {}) }));
  }

  /** `assembly.frames` (O12): tool and sensor frames on links, added or replaced by name, null removing one. */
  frames(frames: Record<string, FrameOptions | null>): Assembly {
    const out: Record<string, FrameSettings | null> = {};
    for (const [name, f] of Object.entries(frames)) {
      if (f === null) { out[name] = null; continue; }
      if (f.at !== undefined && !(f.at instanceof Location)) throw refuse('VALUE', `frame ${name}: at is a Location`);
      out[name] = { link: this.idOf(f.link), ...(f.at ? { position: [...f.at.position], rotation: [...f.at.rotation] } : {}), ...(f.kind ? { kind: f.kind } : {}) };
    }
    return new Assembly(this.name, framesDoc(this.#doc, out));
  }

  /** A variant (O11): the assembly regenerated with these input values; the master (this one) unchanged. */
  variant(values: Record<string, number | boolean | string>): Assembly { return new Assembly(this.name, variantDoc(this.#doc, values)); }

  /** A part of the assembly as a studio part, in its own coordinates (the base part's document is the assembly's own). */
  part(name: string): StudioPart {
    const id = this.idOf(name), d = id === BASE ? this.#doc : this.#doc.instances!.find(i => i.id === id)!.doc;
    return studioPart(name, { ...d, instances: undefined, mates: undefined } as StudioDoc);
  }

  /** Where each placed part stands: its id, name, position (mm) and rotation (degrees about X, then Y, then Z). */
  placements(): { part: string; name: string; position: Vec3; rotation: Vec3; grounded?: true }[] {
    return (this.#doc.instances ?? []).map(i => ({ part: i.id, name: i.name, position: toVec(i.position), rotation: toVec(i.rotation), ...(i.grounded ? { grounded: true as const } : {}) }));
  }

  /** The mates the solver cannot meet, with its reasons (none: every mate is met). */
  problems(): { mate: string; reason: string }[] { return problemsOf(this.#doc); }

  /** Each frame's world pose at the solved pose (O12). */
  framePoses(): { name: string; link: string; kind?: 'tool' | 'sensor'; position: Vec3; rotation: Vec3 }[] { return framePosesOf(this.#doc); }

  /** The assembly read as a robot (RS5): its joints, poses, paths, inertia and exports. */
  robot(): Robot { return new Robot(this.#doc); }

  /**
   * Every part's display triangles where it stands (`base/<body>`, `<part id>/<body>`), in the common mesh shape —
   * `explode` (the studio's Explode factor: 0.5, 1, 2) pushing each placed part out from the middle, for display only.
   */
  meshes(o: { explode?: number } = {}): MeshData[] {
    if (o.explode !== undefined && !(typeof o.explode === 'number' && Number.isFinite(o.explode) && o.explode >= 0)) throw refuse('VALUE', `explode is a factor, 0 or more: ${String(o.explode)}`);
    return assemblyMeshes(this.#doc, o.explode ?? 0);
  }

  /** output_clearance's reply: every pair of bodies within `near` (mm, default 1) — touching, near or designed — with its least gap and where. Async: the tool's own. */
  clearance(o: { near?: number } = {}) { return outputOf(this.#doc, 'output_clearance', o.near === undefined ? {} : { near: o.near }); }

  // (A mate's end: the part's id, and the face's name as the face tables key it — a selector's one face, its `#k` and
  // the display's merged `a+b` taken back to the first name the part's table has.)
  #end(end: MateEnd): { part: string; face: string } {
    const id = this.idOf(end.part);
    if (typeof end.face === 'string') return { part: id, face: end.face };
    const d = id === BASE ? this.#doc : this.#doc.instances!.find(i => i.id === id)!.doc;
    const bodies = d.nodes.length ? bodiesOf(d) : [];
    const body = end.body === undefined ? (bodies.length === 1 ? bodies[0] : null) : bodies.find(b => b.key === end.body);
    if (!body) throw refuse(bodies.length ? 'BODY_AMBIGUOUS' : 'NO_BODY', bodies.length ? `${end.part} has ${bodies.length} bodies (${bodies.map(b => b.key).join(', ')}): give the end's body` : `${end.part} has no body`);
    const picked = end.face(meshSelection(body.mesh));
    if (picked.count !== 1) throw refuse('SELECTION_ONE', `a mate holds one face of ${end.part}; the selector picked ${picked.count}`);
    return { part: id, face: picked.names()[0].split('+')[0].replace(/#\d+$/, '') };
  }
}

/** A new assembly: its base part (fixed at the origin) the given studio part, or none yet. */
export function assembly(name = 'assembly', base?: StudioPart): Assembly {
  if (base !== undefined && !(base instanceof StudioPart)) throw refuse('VALUE', 'an assembly\'s base is a studio part');
  return new Assembly(name, base ? base.doc : emptyDoc());
}
