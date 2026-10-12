import {
  intersectConvexPolygons, Canvas2DError,
  type PolygonContour, type PolygonBooleanResult,
} from '@barocss/canvas2d';

// Ordinary records and dense arrays in one caller-chosen coordinate frame.
const left: PolygonContour = {
  id: 'LeftOperand',
  points: [{ x: 40, y: 80 }, { x: 80, y: 40 },
    { x: 120, y: 80 }, { x: 80, y: 120 }],
};
const right: PolygonContour = {
  id: 'RightOperand',
  points: [{ x: 65, y: 51 }, { x: 155, y: 57 }, { x: 65, y: 141 }],
};
const original = JSON.stringify([left, right]);
const result: PolygonBooleanResult = intersectConvexPolygons(left, right);
const disjoint = intersectConvexPolygons(left, {
  id: 'Far',
  points: [{ x: 400, y: 300 }, { x: 500, y: 300 }, { x: 400, y: 400 }],
});
let contactCode: string | undefined;
try {
  intersectConvexPolygons(left, {
    id: 'Touch',
    points: [{ x: 80, y: 40 }, { x: 155, y: 57 }, { x: 65, y: 141 }],
  });
} catch (error) {
  if (!(error instanceof Canvas2DError)) throw error;
  contactCode = error.code;
}
const inputsUnchanged = JSON.stringify([left, right]) === original;
// Later caller edits cannot rewrite this already-computed result.
left.points[0].x = 41;
export { result, disjoint, contactCode, inputsUnchanged };
