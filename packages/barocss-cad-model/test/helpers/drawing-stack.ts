import { rectanglePart, type StudioDoc } from '../../src/engine/doc';
import { defaultDrawing, type DrawingDimension, type Tolerance } from '../../src/drawing/types';

const stackDimension = (id: string, width: number, edge: string, y: number, z: number, tol?: Tolerance): DrawingDimension => ({
  id, kind: 'linear', view: 'top', orient: 'horizontal', place: [width / 2, y - 4],
  a: { edge, at: 'end', near: [0, y, z] }, b: { edge, at: 'end', near: [width, y, z] }, ...(tol ? { tol } : {}),
});
export const stackStock = (): StudioDoc => ({
  ...rectanglePart(30, 6, 4),
  instances: [{ id: 'p1', name: 'Insert', doc: rectanglePart(20, 12, 4), position: [0, 15, 0], rotation: [0, 0, 0] }],
  drawing: { ...defaultDrawing(), scope: { kind: 'assembly' }, views: ['front', 'top', 'right'], units: 'inch', dimensions: [
    stackDimension('set_material', 30, 'n1.side0|n1.top', 0, 4, { kind: 'deviation', lower: -0.1, upper: 0.2 }),
    stackDimension('insert', 20, 'p1/n1.side0|n1.top', 15, 4, { kind: 'symmetric', value: 0.05 }),
  ] },
});
export const stackTerms = [{ id: 'set_material', sign: 1 }, { id: 'insert', sign: -1 }];
