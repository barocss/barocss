import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../../src/engine/doc';
import { evaluatePart } from '../../src/engine/evaluate';
import { weldList } from '../../src/frames/welds';

/** Explicit test geometry and user weld sizes, with no catalogue or supplier claims. */
export function manufacturingDocument(): StudioDoc {
  const frame = withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 200, 0]], segments: [[0, 1], [1, 2]], section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } });
  const evaluated = evaluatePart(frame, 1);
  if (!evaluated.ok) throw Error(evaluated.error.detail);
  const joints = weldList(frame, evaluated.bodies).joints;
  if (!joints.length) throw Error('Expected a real frame joint in this fixture.');
  return { ...frame, frames: { version: 1, welds: joints.map(j => ({ joint: j.id, kind: 'fillet', size: 2, allRound: true, notes: 'User test weld, size 2 mm' })) }, instances: [{ id: 'plate', name: 'Mount plate', doc: rectanglePart(80, 60, 8), position: [80, 60, 0], rotation: [0, 0, 0] }] };
}

export const manufacturingOptions = {
  sheet: 'A3', title: 'Frame manufacturing', weldSymbols: true, balloons: true,
  sections: [{ id: 'A', view: 'front', at: 0 }, { id: 'B', view: 'top', at: 0 }],
  tables: [{ id: 'bom', from: 'bom' }, { id: 'cut-list', from: 'cut-list' }, { id: 'weld-list', from: 'weld-list' }],
};
