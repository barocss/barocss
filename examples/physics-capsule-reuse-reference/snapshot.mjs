import { sceneInput, queryInput } from '../physics-capsule-sweep-reference/admission.mjs';
import { SweepRefusal, sweepBox } from '../physics-capsule-sweep-reference/sweep.mjs';
import { groupCopiedBoxes } from './groups.mjs';

export function createGroupedSnapshot(input) {
  const scene = sceneInput(input), groups = groupCopiedBoxes(scene.boxes);
  let disposed = false;
  const live = () => { if (disposed) throw new SweepRefusal('DISPOSED', 'Snapshot is disposed'); };
  const copyScene = () => ({ revision: scene.revision, boxes: scene.boxes.map(box => ({ id: box.id,
    centerM: box.centerM.slice(), halfExtentsM: box.halfExtentsM.slice(), orientationXYZW: box.orientationXYZW.slice() })) });
  return {
    getSnapshot() { live(); return copyScene(); },
    getDiagnostics() {
      live();
      return { sourceCount: scene.boxes.length, groupCount: groups.length,
        memberIDs: groups.map(group => group.memberIDs.slice()), keyByteCount: 80 * groups.length };
    },
    query(input, onSweep) {
      live();
      const query = queryInput(input, scene);
      if (onSweep !== undefined && typeof onSweep !== 'function') throw new SweepRefusal('INVALID_INPUT', 'Research sweep callback must be callable');
      const hits = [];
      for (const group of groups) {
        let selectedId = null;
        for (const id of group.memberIDs) if (id !== query.excludeId && (selectedId === null || id < selectedId)) selectedId = id;
        if (selectedId === null) continue;
        if (onSweep) onSweep({ key: group.key, memberIDs: group.memberIDs.slice(), selectedId });
        const hit = sweepBox(query.centerM, query.displacementM, group.representative);
        if (hit) hits.push({ ...hit, bodyId: selectedId });
      }
      if (!hits.length) return null;
      const minimum = Math.min(...hits.map(hit => hit.fraction));
      return hits.filter(hit => hit.fraction <= minimum + 1e-9)
        .sort((a, b) => a.bodyId < b.bodyId ? -1 : a.bodyId > b.bodyId ? 1 : 0)[0];
    },
    dispose() { disposed = true; },
  };
}

export const createSnapshot = createGroupedSnapshot;
