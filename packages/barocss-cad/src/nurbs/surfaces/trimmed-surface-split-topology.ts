import { exactOrient2, exactPoint2FromXY, exactSame2, type ExactPoint2 } from '../../brep/planar-arrangement.js';
import type { SectionRational, SectionRationalContext } from '../../section-rational-internal.js';
import { splitCheck } from './trimmed-surface-split-common.js';

export type SplitUV = [number,number];
export interface SplitTopologyWork { vertexPairs: number; edgePairs: number; orientations: number; containmentTests: number }
export function pointKey(p: ExactPoint2): string {return `${p.x}/${p.y}/${p.w}`;}
export function coordinateCompare(a: ExactPoint2,b: ExactPoint2,axis: 0|1): number {
  const x=(axis===0?a.x:a.y)*b.w,y=(axis===0?b.x:b.y)*a.w;return x<y?-1:x>y?1:0;
}
function orient(a: ExactPoint2,b: ExactPoint2,c: ExactPoint2,work: SplitTopologyWork): number {work.orientations++;return exactOrient2(a,b,c);}
function between(a: ExactPoint2,b: ExactPoint2,p: ExactPoint2): boolean {
  for(const axis of [0,1] as const){const ab=coordinateCompare(a,b,axis),ap=coordinateCompare(a,p,axis),bp=coordinateCompare(b,p,axis);if(ab<=0?(ap>0||bp<0):(ap<0||bp>0))return false;}return true;
}
/** Exact segment relation, including shared endpoints and positive collinear overlap. */
export function segmentRelation(a: ExactPoint2,b: ExactPoint2,c: ExactPoint2,d: ExactPoint2,work: SplitTopologyWork): number {
  work.edgePairs++;
  const o1=orient(a,b,c,work),o2=orient(a,b,d,work),o3=orient(c,d,a,work),o4=orient(c,d,b,work);
  if(o1*o2<0&&o3*o4<0)return 2;
  const ac=o1===0&&between(a,b,c),ad=o2===0&&between(a,b,d),ca=o3===0&&between(c,d,a),cb=o4===0&&between(c,d,b);
  if(!(ac||ad||ca||cb))return 0;
  if(o1===0&&o2===0&&o3===0&&o4===0){
    const axis=coordinateCompare(a,b,0)!==0?0:1;
    const loA=coordinateCompare(a,b,axis)<=0?a:b,hiA=loA===a?b:a,loB=coordinateCompare(c,d,axis)<=0?c:d,hiB=loB===c?d:c;
    const lo=coordinateCompare(loA,loB,axis)>=0?loA:loB,hi=coordinateCompare(hiA,hiB,axis)<=0?hiA:hiB;
    if(coordinateCompare(lo,hi,axis)<0)return 3;
  }
  return 1;
}
export function ringArea2(ring: readonly ExactPoint2[],q: SectionRationalContext): SectionRational {
  let sum=q.rat(0n);
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    sum=q.add(sum,q.rat(a.x*b.y-b.x*a.y,a.w*b.w));
  }
  return sum;
}
export function simpleRing(ring: readonly ExactPoint2[],work: SplitTopologyWork,maximumVertices: 326|484=326): void {
  splitCheck(ring.length>=3&&ring.length<=maximumVertices,'BUDGET',`strict simple material ring requires3..${maximumVertices} vertices`);
  for(let i=0;i<ring.length;i++){
    const b=(i+1)%ring.length,c=(i+2)%ring.length;
    for(let j=i+1;j<ring.length;j++){work.vertexPairs++;splitCheck(!exactSame2(ring[i],ring[j]),'TOPOLOGY','repeated material ring vertex refused');}
    if(orient(ring[i],ring[b],ring[c],work)===0)splitCheck(between(ring[i],ring[c],ring[b]),'TOPOLOGY','adjacent ring backtracking refused');
    for(let j=i+2;j<ring.length;j++){
      if(i===0&&j===ring.length-1)continue;
      splitCheck(segmentRelation(ring[i],ring[b],ring[j],ring[(j+1)%ring.length],work)===0,'TOPOLOGY','nonadjacent material boundary crossing, touch or overlap refused');
    }
  }
}
export function canonicalRing(input: readonly ExactPoint2[],positive: boolean,q: SectionRationalContext,work: SplitTopologyWork,maximumVertices: 326|484=326): ExactPoint2[] {
  const ring: ExactPoint2[]=[];for(const p of input)ring.push(p);
  simpleRing(ring,work,maximumVertices);
  const area=ringArea2(ring,q);splitCheck(area.n!==0n,'TOPOLOGY','zero-area material ring refused');
  if((area.n>0n)!==positive)ring.reverse();
  let first=0;
  for(let i=1;i<ring.length;i++)if(coordinateCompare(ring[i],ring[first],0)<0||(coordinateCompare(ring[i],ring[first],0)===0&&coordinateCompare(ring[i],ring[first],1)<0))first=i;
  const out: ExactPoint2[]=[];for(let i=0;i<ring.length;i++)out.push(ring[(first+i)%ring.length]);return out;
}
export function compareRings(a: readonly ExactPoint2[],b: readonly ExactPoint2[]): number {
  for(let i=0;i<Math.min(a.length,b.length);i++)for(const axis of [0,1] as const){const c=coordinateCompare(a[i],b[i],axis);if(c)return c;}
  return a.length-b.length;
}
/** -1 outside,0 boundary,+1 inside, on exact represented/rational coordinates. */
export function pointInRing(ring: readonly ExactPoint2[],point: ExactPoint2,work: SplitTopologyWork): number {
  work.containmentTests++;let inside=false;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],o=orient(a,b,point,work);
    if(o===0&&between(a,b,point))return 0;
    const ay=coordinateCompare(a,point,1)>0,by=coordinateCompare(b,point,1)>0;
    if(ay!==by&&(by?o>0:o<0))inside=!inside;
  }
  return inside?1:-1;
}
export function uvRing(points: readonly SplitUV[]): ExactPoint2[] {const out: ExactPoint2[]=[];for(const p of points)out.push(exactPoint2FromXY(p));return out;}
/** Compare all inter-ring contacts and containment after storage rounding. */
export function compareRingRelations(exact: readonly (readonly ExactPoint2[])[],rounded: readonly (readonly ExactPoint2[])[],work: SplitTopologyWork): void {
  splitCheck(exact.length===rounded.length,'BINDING','rounded material ring count differs');
  for(let i=0;i<exact.length;i++)for(let j=i+1;j<exact.length;j++){
    const a=exact[i],b=exact[j],ra=rounded[i],rb=rounded[j];
    for(let k=0;k<a.length;k++)for(let l=0;l<b.length;l++)
      splitCheck(segmentRelation(a[k],a[(k+1)%a.length],b[l],b[(l+1)%b.length],work)
        ===segmentRelation(ra[k],ra[(k+1)%ra.length],rb[l],rb[(l+1)%rb.length],work),'TOPOLOGY','rounded material boundaries change contact/incidence');
    for(let k=0;k<a.length;k++)splitCheck(pointInRing(b,a[k],work)===pointInRing(rb,ra[k],work),'TOPOLOGY','rounded material boundary nesting changes');
    for(let k=0;k<b.length;k++)splitCheck(pointInRing(a,b[k],work)===pointInRing(ra,rb[k],work),'TOPOLOGY','rounded material boundary nesting changes');
  }
}
