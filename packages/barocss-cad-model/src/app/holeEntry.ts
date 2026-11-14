import { faceGeometry } from '@barocss/cad';
import { prefixDoc, type StudioDoc } from '../engine/doc';
import { partBreps } from '../engine/evaluate';
import { bodyKeyFor } from '../engine/ids';

interface HoleEntry { side: 'min' | 'max'; coordinate: number }
const entries = new WeakMap<StudioDoc, Map<number, HoleEntry | undefined>>();

/** Resolve a named entry on the original stock, before the hole consumed it. */
export function namedHoleEntry(doc: StudioDoc, index: number): HoleEntry | undefined {
  const hole = doc.nodes[index];
  if (hole?.kind !== 'hole' || !hole.face) return;
  const cache = entries.get(doc) ?? new Map<number, HoleEntry | undefined>();
  if (cache.has(index)) return cache.get(index);
  let entry: HoleEntry | undefined;
  try {
    const key = bodyKeyFor(doc.nodes, hole.parent.node, hole.parent.side);
    const source = partBreps(prefixDoc(doc, index)).find(body => body.key === key);
    const faces = source?.brep.faces.filter(face => face.name === hole.face || face.name?.split('#')[0] === hole.face);
    if (faces?.length === 1) {
      const geometry = faceGeometry(faces[0]), axis = 'xyz'.indexOf(hole.axis ?? 'z');
      if (geometry.kind === 'plane' && Math.abs(Math.abs(geometry.n[axis]) - 1) <= 1e-9)
        entry = { side: geometry.n[axis] < 0 ? 'min' : 'max', coordinate: geometry.o[axis] };
    }
  } catch { /* The historical stock is unavailable. */ }
  cache.set(index, entry);
  entries.set(doc, cache);
  return entry;
}
