// R7 (cad-model's facade): the one part (@barocss/cad/api's Part) over the studio document, with its studio backend
// (./studio), and only the studio layer added: a material by its library id for mass. `.doc` is the StudioDoc the
// agent's tools, the studio, save/open and the fingerprints use. Assemblies, variants and rows come as the layer grows.
import { Part, refuse, type Density } from '@barocss/cad/api';
import type { StudioDoc } from '../engine/doc';
import { MATERIALS } from '../library/materials';
import type { MassResult } from './core';
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

/** A new, empty studio part. */
export function part(name = 'part'): StudioPart { return new StudioPart(studioBackend, name, studioBackend.empty()); }
