import { intersectConvexPolygons, type PolygonContour, type PolygonBooleanResult } from '../../packages/barocss-canvas2d/src/index.js';
import { intersectConvexPolygons as emitted, type PolygonContour as CompiledContour, type PolygonBooleanResult as CompiledResult } from '../../packages/barocss-canvas2d/dist/index.js';
const left:PolygonContour={id:'Left',points:[{x:0,y:0},{x:4,y:0},{x:0,y:4}]};
const right:CompiledContour={id:'Right',points:[{x:1,y:1},{x:5,y:1},{x:1,y:5}]};
const a:PolygonBooleanResult=intersectConvexPolygons(left,right);
const b:CompiledResult=emitted(left,right);
void [a,b];
// @ts-expect-error both operands are required
intersectConvexPolygons(left);
// @ts-expect-error no operation argument on the separate intersection API
emitted(left,right,'union');
// @ts-expect-error ids are strings
intersectConvexPolygons({id:1,points:left.points},right);
