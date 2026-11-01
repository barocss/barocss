import { PhysicsError } from '../capsule-query-error.js';
import { admitScene, admitSweep } from './admission.js';
import { TIE_FRACTION } from './profile.js';
import { sweepBox } from './sweep.js';
import type { CapsuleQueryBoxV1, CapsuleQuerySceneV1, CapsuleSweepHitV1, UprightCapsuleQuery } from './types.js';

function copyBox(box: CapsuleQueryBoxV1): CapsuleQueryBoxV1 {
  return { id: box.id, centerM: [...box.centerM], halfExtentsM: [...box.halfExtentsM], orientationXYZW: [...box.orientationXYZW] };
}
function geometryKey(box: CapsuleQueryBoxV1): string {
  const values = [...box.centerM, ...box.halfExtentsM, ...box.orientationXYZW];
  const bytes = new Uint8Array(80), view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat64(index * 8, value, true));
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
function groupBoxes(boxes: CapsuleQueryBoxV1[]) {
  const groups = new Map<string, { representative: CapsuleQueryBoxV1; ids: string[] }>();
  for (const box of boxes) {
    const key = geometryKey(box), group = groups.get(key);
    if (group) group.ids.push(box.id);
    else groups.set(key, { representative: copyBox(box), ids: [box.id] });
  }
  return Array.from(groups.values());
}
export function createUprightCapsuleQuery(input: CapsuleQuerySceneV1): UprightCapsuleQuery {
  const scene = admitScene(input), groups = groupBoxes(scene.boxes);
  let disposed = false;
  function live(): void { if (disposed) throw new PhysicsError('DISPOSED', 'Capsule query is disposed'); }
  return {
    sweep(input) {
      live();
      const query = admitSweep(input, scene), hits: CapsuleSweepHitV1[] = [];
      for (const group of groups) {
        let selectedId: string | null = null;
        for (const id of group.ids) if (id !== query.excludeId && (selectedId === null || id < selectedId)) selectedId = id;
        if (selectedId === null) continue;
        const hit = sweepBox(query.centerM, query.displacementM, group.representative);
        if (hit) hits.push({ ...hit, bodyId: selectedId });
      }
      if (!hits.length) return null;
      const minimum = Math.min(...hits.map(hit => hit.toiFraction));
      return hits.filter(hit => hit.toiFraction <= minimum + TIE_FRACTION)
        .sort((a, b) => a.bodyId < b.bodyId ? -1 : a.bodyId > b.bodyId ? 1 : 0)[0];
    },
    getSnapshot() { live(); return { version: 1, profile: scene.profile, revision: scene.revision, boxes: scene.boxes.map(copyBox) }; },
    dispose() { disposed = true; },
  };
}
