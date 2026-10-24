// R7 (cad-model's facade): the one part (@barocss/cad/api's Part) over the studio document, with its studio backend
// (./studio), and only the studio layer added: a material by its library id for mass. `.doc` is the StudioDoc the
// agent's tools, the studio, save/open and the fingerprints use. Assemblies, variants and rows come as the layer grows.
import { BarocssError, Part, bracketedCode, refuse, studioSpec, type Density } from '@barocss/cad/api';
import { sha256Hex } from '../util/digest';
import { loadPersonRows } from '../chat/rows';
import { receivePersonRowFiles } from '../engine/rowFiles';
import type { RowKind } from '../engine/rowDefinitions';
import type { StudioDoc } from '../engine/doc';
import { MATERIALS } from '../library/materials';
import type { MassResult } from './core';
import { bodiesOf, materialOf, withMaterial } from './core';
import { studioBackend } from './studio';

const libraryMaterial = (id: string) => {
  const m = MATERIALS.find(x => x.id === id);
  if (!m) throw refuse('MATERIAL_UNKNOWN', `no material '${id}' in the library; the ids are ${MATERIALS.map(x => x.id).join(', ')}`);
  return m;
};

export class StudioPart extends Part<StudioDoc> {
  /**
   * The body's mass properties in a library material (its id, e.g. 'al6061') or at a density, in MMGS — or, given
   * neither, in the material the body names (its own, else the brief's).
   */
  override mass(material?: string | Density): MassResult {
    if (material !== undefined && typeof material !== 'string') return super.mass(material);
    const id = material ?? materialOf(this.document, this.target());
    if (id === undefined) throw refuse('MATERIAL_UNKNOWN', `the body ${this.target()} names no material: give one (mass('al6061')), or set it with material(id)`);
    return super.mass({ density: libraryMaterial(id).gPerCm3 });
  }

  /**
   * A configuration (R7.4d): the parameters' values now, saved under a name — the Parameters panel's Save. Studio parts
   * only (the kernel document has none).
   */
  configuration(name: string): this {
    if (typeof name !== 'string' || !name.trim()) throw refuse('VALUE', 'a configuration has a name');
    const d = this.document;
    return this.next({ ...d, configurations: { ...d.configurations, [name.trim()]: { ...d.parameters } } }, this.focus);
  }

  /** The part with a configuration's values applied — the panel's Apply: the values of the parameters it still has. */
  withConfiguration(name: string): this {
    const d = this.document, c = d.configurations?.[name];
    if (!c) throw refuse('CONFIGURATION_UNKNOWN', `no configuration ${name}; the configurations are ${Object.keys(d.configurations ?? {}).join(', ') || 'none'}`);
    return this.withParameters(Object.fromEntries(Object.entries(c).filter(([k]) => k in d.parameters)));
  }

  /** The configurations: each name and its values. */
  configurations(): Record<string, Record<string, number>> { return structuredClone(this.document.configurations ?? {}); }

  /**
   * `gear` (P1): an involute spur or helical gear — module m, teeth, face width b; optionally its profile shift, helix
   * angle and hand, bore, and where it stands (x, y about its axis, on z) — a body of its own, as the studio's command makes it.
   */
  gear(o: { m: number; teeth: number; b: number; shift?: number; helix?: number; hand?: 'right' | 'left'; bore?: number; x?: number; y?: number; z?: number }): this { return this.makes(studioSpec('gear', o)); }

  /** `gear-mesh`: a gear meshing with the chosen one — its teeth, the direction to it (degrees from +X), its bore and shift. */
  gearMesh(o: { teeth: number; dir: number; bore?: number; shift?: number }): this { return this.acts(studioSpec('gear-mesh', o)); }

  /** `spring`: a coil spring of round wire, by the studio command's values (type, wire d, mean coil D, coils n, pitch p …). */
  spring(o: Readonly<Record<string, number | string>>): this { return this.makes(studioSpec('spring', o)); }

  /**
   * `fastener`: a bolt, screw, nut or washer from the document's fastener-size rows (none built in: load a person's file
   * with loadRows), standing on its seat at (x, y, z) — its kind, size, length and joint as the studio's command takes them.
   */
  fastener(o: { kind: string; size: string; length?: string; joint?: string; grip?: number; x?: number; y?: number; z?: number; model?: string }): this {
    return this.makes(studioSpec('fastener', { ...o, insert: 'part' }));
  }

  /**
   * Rows from a person's file (rows rule b: the facade writes no rows) — the sample rows shipped in
   * packages/barocss-cad-model/samples/rows, or your own — received as the studio's Library loads one: its receipt names
   * the file. The receipt's conversation is the file's own digest, so the same file loads the same bytes every time.
   */
  loadRows(kind: RowKind, file: { name: string; text: string }): this {
    const conversation = sha256Hex(new TextEncoder().encode(`${file.name}\n${file.text}`)).slice(0, 24);
    let r: ReturnType<typeof loadPersonRows>;
    try {
      const files = receivePersonRowFiles(conversation, [{ name: file.name, text: file.text, turn: 1 }], 1);
      r = loadPersonRows(this.document, kind, files.files[0].id, undefined, files);
    } catch (e) { const m = e instanceof Error ? e.message : String(e); throw new BarocssError(bracketedCode(m) ?? 'ROWS', m, 'evaluate'); }
    if ('error' in r) throw new BarocssError(bracketedCode(r.error) ?? 'ROWS', r.error, 'evaluate');
    return this.next(r.doc, this.focus);
  }

  /** `features.material` (set_material): the chosen body's material — or, with none chosen, every body's — by its library id. */
  material(id: string): this {
    libraryMaterial(id);
    return this.next(withMaterial(this.document, this.focus, id), this.focus);
  }
}

/**
 * A new studio part, empty — or continuing from a StudioDoc of your own (a saved one, or another part's `.doc`): it is
 * evaluated once, and the part's verbs add to it.
 */
export function part(name = 'part', doc?: StudioDoc): StudioPart {
  if (doc === undefined) return new StudioPart(studioBackend, name, studioBackend.empty());
  if (doc?.format !== 'barocss-cad-model') throw refuse('VALUE', 'a studio part continues from a StudioDoc (format barocss-cad-model)');
  const own = structuredClone(doc);
  if (own.nodes.length) bodiesOf(own);
  return new StudioPart(studioBackend, name, own);
}
