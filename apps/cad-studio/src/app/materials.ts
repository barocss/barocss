// The materials a body can be made of (a body's look names one; the part has a default): from the material library
// (R6b.7, src/library/builtin/materials.json), here by density for mass.
import { MATERIALS_DATA } from '../library/materials';

export const MATERIALS = MATERIALS_DATA.materials.map(m => ({ id: m.id, label: m.label, gPerCm3: m.densityGPerCm3 }));
/** A material by id (the first, aluminium, for none or an unknown one). */
export const materialOf = (id: string | undefined) => MATERIALS.find(m => m.id === id) ?? MATERIALS[0];
