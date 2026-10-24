// R7 (cad-model's facade): the one part (@barocss/cad/api's Part) over the studio document, with its studio backend
// (./studio), and only the studio layer added: a material by its library id for mass. `.doc` is the StudioDoc the
// agent's tools, the studio, save/open and the fingerprints use. Assemblies, variants and rows come as the layer grows.
import { Part, refuse, type Density } from '@barocss/cad/api';
import type { StudioDoc } from '../engine/doc';
import { MATERIALS } from '../library/materials';
import type { MassResult } from './core';
import { bodiesOf } from './core';
import { studioBackend } from './studio';

export class StudioPart extends Part<StudioDoc> {
  /** The body's mass properties in a library material (its id, e.g. 'al6061') or at a density, in MMGS. */
  override mass(material: string | Density): MassResult {
    if (typeof material !== 'string') return super.mass(material);
    const m = MATERIALS.find(x => x.id === material);
    if (!m) throw refuse('MATERIAL_UNKNOWN', `no material '${material}' in the library; the ids are ${MATERIALS.map(x => x.id).join(', ')}`);
    return super.mass({ densityGPerCm3: m.gPerCm3 });
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
