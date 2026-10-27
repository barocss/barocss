// A library part's values that equal a fastener size's (O7; tslot-20, the coordinator's option C). They are the part's own
// dimensions, as its supplier makes them — the nut's tapped hole, the extrusion's core bore, the cap's hole — so the
// person's fastener sizes never reshape them. When a loaded size row differs, the part's notes say so, naming both.
import type { CadLibraryOrigin } from '@barocss/cad';
import type { FastenerSizes } from '../app/fasteners';

type Link = { size: string; field: 'tap' | 'medium' };
/** By library, part and parameter: the fastener value it equals. */
const LINKS: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, Link>>>>>> = {
  'tslot-20': {
    profile: { bore: { size: 'M5', field: 'tap' } },
    'slot-nut-m5': { drill: { size: 'M5', field: 'tap' } },
    'end-cap': { hole: { size: 'M5', field: 'medium' } },
    'angle-bracket': { hole: { size: 'M5', field: 'medium' } },
  },
};
const WHAT = { tap: 'tap drill', medium: 'medium clearance hole' } as const;

/** Where a library part's own value differs from the loaded row of the size it equals (none loaded: nothing to say). */
export function fastenerLinkNotes(origin: CadLibraryOrigin, sizes: FastenerSizes): string[] {
  const links = LINKS[origin.library]?.[origin.part]; if (!links) return [];
  const out: string[] = [];
  for (const [param, link] of Object.entries(links)) {
    const own = origin.values[param], row = sizes[link.size];
    if (typeof own !== 'number' || !row) continue;
    const theirs = link.field === 'tap' ? row.tap : row.clearance[1];
    if (Math.abs(theirs - own) > 1e-9) out.push(`${param} Ø${own} is the library part's own; your fastener size ${link.size} gives a ${WHAT[link.field]} of Ø${theirs} — check which the part needs`);
  }
  return out;
}
