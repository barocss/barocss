import { orient2dExactBinary64V1 } from './exact-binary64-orientation-v1.js';
import { classifyExactSegmentCrossingV1 } from './exact-segment-crossing-v1.js';
import type { Binary64PointV1 } from './exact-binary64-orientation-v1.js';

export type NativePlanarLoopQualificationV1 =
  | { readonly status: 'qualified'; readonly winding: 'counterclockwise' | 'clockwise'; readonly vertexCount: number; readonly method: 'exact-binary64-orientation-and-bigint-area' }
  | { readonly status: 'refused'; readonly reason: 'invalid-loop' | 'repeated-vertex' | 'zero-edge' | 'zero-area' | 'self-intersection' | 'non-simple-boundary' }
  | { readonly status: 'unsupported'; readonly reason: string };

/** Snapshot only validated own data descriptors; never read an admitted caller point. */
const snapshot = (v: unknown): Binary64PointV1 | null => {
  if (!v || typeof v !== 'object') return null;
  try {
    if (Array.isArray(v)) return null;
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return null;
    const d = Object.getOwnPropertyDescriptors(v);
    if (Reflect.ownKeys(d).length !== 2 ||
        !['x', 'y'].every(k => Object.hasOwn(d, k) && 'value' in d[k] &&
          d[k].enumerable && typeof d[k].value === 'number')) return null;
    return { x: d.x.value as number, y: d.y.value as number };
  } catch {
    return null;
  }
};
const view = new DataView(new ArrayBuffer(8));
function parts(n: number): { m: bigint; e: number } {
  view.setFloat64(0,n,false);
  const b=view.getBigUint64(0,false), exponent=Number((b>>52n)&2047n);
  const fraction=b&((1n<<52n)-1n);
  return { m: (b>>63n)===0n ? (exponent===0?fraction:fraction|(1n<<52n)) :
    -(exponent===0?fraction:fraction|(1n<<52n)), e:exponent===0?-1074:exponent-1075 };
}
/** A bounded *simple straight polygon boundary* only, not a face or material model. */
export function qualifyNativePlanarLoopV1(input: unknown): NativePlanarLoopQualificationV1 {
  if (!Array.isArray(input) || input.length < 3 || input.length > 16)
    return { status:'refused', reason:'invalid-loop' };
  const captured: Binary64PointV1[] = [];
  try {
    // Array elements may be accessor-backed: snapshot the bounded vertex list as well.
    const descriptors = Object.getOwnPropertyDescriptors(input);
    for (let i = 0; i < input.length; i++) {
      const entry = descriptors[String(i)];
      if (!entry || !('value' in entry)) return { status:'refused', reason:'invalid-loop' };
      const point = snapshot(entry.value);
      if (!point) return { status:'refused', reason:'invalid-loop' };
      captured.push(point);
    }
  } catch {
    return { status:'refused', reason:'invalid-loop' };
  }
  const points = captured;
  if (points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>10000||Math.abs(p.y)>10000))
    return { status:'unsupported', reason:'non-finite-or-out-of-range' };
  const keys=points.map(p=>String(Object.is(p.x,-0)?0:p.x)+','+String(Object.is(p.y,-0)?0:p.y));
  if (new Set(keys).size!==points.length) return {status:'refused',reason:'repeated-vertex'};
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const next=points[(i+2)%points.length];
    const turn=orient2dExactBinary64V1(a,b,next);
    if(turn.status!=='exact') return {status:'unsupported',reason:'orientation-refused'};
    // Adjacent collinear edges may backtrack over each other even with all vertices distinct.
    // Compare coordinate order, not a potentially underflowing floating-point dot product.
    if(turn.sign==='zero') {
      const axis=a.x!==b.x?'x':'y';
      if((b[axis]>a[axis]) !== (next[axis]>b[axis]))
        return {status:'refused',reason:'non-simple-boundary'};
    }
    if(a.x===b.x&&a.y===b.y) return {status:'refused',reason:'zero-edge'};
    for(let j=i+1;j<points.length;j++){
      if(j===i+1||(i===0&&j===points.length-1))continue;
      const c=points[j],d=points[(j+1)%points.length];
      const x=classifyExactSegmentCrossingV1(a,b,c,d);
      if(x.status!=='classified')return {status:'unsupported',reason:'segment-classification'};
      if(x.relation==='proper-interior-crossing')return {status:'refused',reason:'self-intersection'};
      if(x.relation==='boundary-or-collinear') {
        // The segment predicate deliberately groups collinear *disjoint* pairs
        // with boundary contacts. Separated coordinate intervals prove that
        // these finite segments cannot meet; all remaining ambiguous cases
        // continue to fail closed.
        const separated =
          Math.max(a.x,b.x)<Math.min(c.x,d.x) ||
          Math.max(c.x,d.x)<Math.min(a.x,b.x) ||
          Math.max(a.y,b.y)<Math.min(c.y,d.y) ||
          Math.max(c.y,d.y)<Math.min(a.y,b.y);
        if(!separated)return {status:'refused',reason:'non-simple-boundary'};
      }
    }
  }
  const values=points.flatMap(p=>[parts(p.x),parts(p.y)]);
  const low=Math.min(...values.map(x=>x.e));
  const integers=values.map(x=>x.m<<BigInt(x.e-low));
  let area=0n;
  for(let i=0;i<points.length;i++){
    const j=(i+1)%points.length;
    area+=integers[2*i]*integers[2*j+1]-integers[2*i+1]*integers[2*j];
  }
  if(area===0n)return {status:'refused',reason:'zero-area'};
  return {status:'qualified',winding:area>0n?'counterclockwise':'clockwise',vertexCount:points.length,
    method:'exact-binary64-orientation-and-bigint-area'};
}
