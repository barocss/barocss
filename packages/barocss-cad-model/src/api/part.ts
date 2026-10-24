// R7 (cad-model's facade): the one part (@barocss/cad/api's Part) over the studio document, with its studio backend
// (./studio), and only the studio layer added: a material by its library id for mass. `.doc` is the StudioDoc the
// agent's tools, the studio, save/open and the fingerprints use. Assemblies, variants and rows come as the layer grows.
import { Part, refuse, type Density } from '@barocss/cad/api';
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
