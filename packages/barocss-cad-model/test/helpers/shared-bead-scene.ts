import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '../../src/engine/doc';
export const section = { kind: 'rect-tube' as const, width: 40, height: 40, wall: 3, outerRadius: 0 };
export const policy = { version: 1 as const, policy: 'equal-length' as const };
export const joints = [4, 5, 6, 7].flatMap(k => ['start', 'end'].map(end => `b0_part${k}.${end}`));
export function table(): StudioDoc {
  const doc = withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [400, 0, 0], [400, 300, 0], [0, 300, 0], [0, 0, 300], [400, 0, 300], [400, 300, 300], [0, 300, 300]],
    segments: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]], section: { kind: 'library', id: 'R40' }, corners: { multi: 'order' } } as ModelNode);
  return { ...doc, frames: { version: 1, sections: [{ id: 'R40', section, source: 'test dimensions' }], beadOwnership: policy,
    welds: joints.map(joint => ({ joint, kind: 'fillet', size: 3 })) } };
}
