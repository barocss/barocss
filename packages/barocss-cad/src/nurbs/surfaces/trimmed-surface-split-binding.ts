import { SectionRationalContext } from '../../section-rational-internal.js';
import type { SectionRational, SectionFraction } from '../../section-rational-internal.js';
import type { Surface } from '../../types.js';
import { splitCheck, TrimmedSurfaceParameterSplitError } from './trimmed-surface-split-common.js';

type Q = SectionRational;
type V = [Q, Q, Q];
type Poly = Q[];
export interface SplitAffineFrame { origin: V; u: V; v: V; normal: V; domainU: [Q,Q]; domainV: [Q,Q]; scaleU: Q; scaleV: Q }
export interface SplitChildBindingProof {
  used: true; regularityCertified: true;
  projection: 'original-u-v-dot-products';
  jacobianDegree: readonly [2,2]; jacobianBernstein: SectionFraction[]; minimumJacobianBernstein: SectionFraction;
  projectedCornerTurns: SectionFraction[];
  coefficientPositionBound: SectionFraction; maximumWorldPositionBound: number;
  wholeModel: 'positive-weight-rational-bilinear';
  globalBinary64EvaluatorErrorCertified: false;
}
export function splitRational(): SectionRationalContext {
  return new SectionRationalContext((kind, detail) => { throw new TrimmedSurfaceParameterSplitError(kind, detail); });
}
function vector(q: SectionRationalContext, point: readonly number[]): V { return [q.from(point[0]),q.from(point[1]),q.from(point[2])]; }
function sub(q: SectionRationalContext, a: V, b: V): V { return [q.sub(a[0],b[0]),q.sub(a[1],b[1]),q.sub(a[2],b[2])]; }
function dot(q: SectionRationalContext, a: V, b: V): Q { return q.add(q.add(q.mul(a[0],b[0]),q.mul(a[1],b[1])),q.mul(a[2],b[2])); }
function cross(q: SectionRationalContext, a: V, b: V): V {
  return [q.sub(q.mul(a[1],b[2]),q.mul(a[2],b[1])),q.sub(q.mul(a[2],b[0]),q.mul(a[0],b[2])),q.sub(q.mul(a[0],b[1]),q.mul(a[1],b[0]))];
}
export function splitAffineFrame(surface: Surface, q: SectionRationalContext): SplitAffineFrame {
  splitCheck(surface.degreeU === 1 && surface.degreeV === 1 && surface.controlPoints.length === 2
    && surface.controlPoints[0].length === 2 && surface.controlPoints[1].length === 2, 'SUPPORT', 'degree1x1 four-pole original support required');
  const weight = surface.weights[0][0];
  for (const row of surface.weights) for (const value of row) splitCheck(value === weight && value > 0, 'SUPPORT', 'equal positive original weights required');
  const origin = vector(q,surface.controlPoints[0][0]), u = sub(q,vector(q,surface.controlPoints[1][0]),origin), v = sub(q,vector(q,surface.controlPoints[0][1]),origin);
  const end = vector(q,surface.controlPoints[1][1]);
  for (let k=0;k<3;k++) splitCheck(q.compare(end[k],q.add(q.add(origin[k],u[k]),v[k])) === 0, 'SUPPORT', 'original stored support must be exactly affine');
  const normal = cross(q,u,v); splitCheck(normal.some(value => value.n !== 0n), 'SUPPORT', 'original support must have rank two');
  const domainU: [Q,Q] = [q.from(surface.knotsU[1]),q.from(surface.knotsU[2])], domainV: [Q,Q] = [q.from(surface.knotsV[1]),q.from(surface.knotsV[2])];
  let reachU=q.rat(0n),reachV=q.rat(0n);
  for(let k=0;k<3;k++){reachU=q.add(reachU,q.abs(u[k]));reachV=q.add(reachV,q.abs(v[k]));}
  return {origin,u,v,normal,domainU,domainV,scaleU:q.div(reachU,q.sub(domainU[1],domainU[0])),scaleV:q.div(reachV,q.sub(domainV[1],domainV[0]))};
}
function zero(q: SectionRationalContext): Poly { const out: Poly=[];for(let i=0;i<9;i++)out.push(q.rat(0n));return out; }
function bilinear(q: SectionRationalContext, values: Q[]): Poly {
  const out=zero(q);out[0]=values[0];out[1]=q.sub(values[1],values[0]);out[3]=q.sub(values[2],values[0]);out[4]=q.add(q.sub(q.sub(values[3],values[2]),values[1]),values[0]);return out;
}
function minus(q: SectionRationalContext,a: Poly,b: Poly): Poly {const out: Poly=[];for(let i=0;i<9;i++)out.push(q.sub(a[i],b[i]));return out;}
function multiply(q: SectionRationalContext,a: Poly,b: Poly): Poly {
  const out=zero(q);
  for(let i=0;i<9;i++)if(a[i].n!==0n)for(let j=0;j<9;j++)if(b[j].n!==0n){
    const u=Math.floor(i/3)+Math.floor(j/3),v=i%3+j%3;
    splitCheck(u<=2&&v<=2,'BINDING','bilinear certificate polynomial exceeds fixed degree2x2');
    out[3*u+v]=q.add(out[3*u+v],q.mul(a[i],b[j]));
  }
  return out;
}
function derivative(q: SectionRationalContext,p: Poly,axis: 0|1): Poly {
  const out=zero(q);for(let i=0;i<9;i++){const u=Math.floor(i/3),v=i%3,n=axis===0?u:v;if(n)out[i-(axis===0?3:1)]=q.mul(q.integer(n),p[i]);}return out;
}
function bernstein(q: SectionRationalContext,p: Poly): Q[] {
  const out: Q[]=[], choose=[[1,0,0],[1,1,0],[1,2,1]],den=[1,2,1];
  for(let k=0;k<3;k++)for(let l=0;l<3;l++){
    let value=q.rat(0n);
    for(let i=0;i<=k;i++)for(let j=0;j<=l;j++)if(p[3*i+j].n!==0n){
      const factor=q.rat(BigInt(choose[k][i]*choose[l][j]),BigInt(den[i]*den[j]));
      value=q.add(value,q.mul(p[3*i+j],factor));
    }
    out.push(value);
  }
  return out;
}
function projectedTurn(q: SectionRationalContext,a: [Q,Q],b: [Q,Q],c: [Q,Q]): Q {
  return q.sub(q.mul(q.sub(b[0],a[0]),q.sub(c[1],b[1])),q.mul(q.sub(b[1],a[1]),q.sub(c[0],b[0])));
}
/** A fixed rational-bilinear proof. It does not replace or normalize native child geometry. */
export function splitChildBinding(child: Surface, frame: SplitAffineFrame, q: SectionRationalContext): {proof: SplitChildBindingProof; bound: Q} {
  splitCheck(child.degreeU===1&&child.degreeV===1&&child.controlPoints.length===2&&child.controlPoints[0].length===2&&child.controlPoints[1].length===2,'BINDING','actual native child must retain its bilinear grid');
  const points: V[]=[],weights: Q[]=[];
  for(let i=0;i<2;i++)for(let j=0;j<2;j++){
    points.push(vector(q,child.controlPoints[i][j]));const w=q.from(child.weights[i][j]);splitCheck(w.n>0n,'BINDING','actual child weights must be positive');weights.push(w);
  }
  const W=bilinear(q,weights),H: Poly[]=[],A: Poly[]=[],B: Poly[]=[];
  for(let k=0;k<3;k++){
    const values: Q[]=[];for(let i=0;i<4;i++)values.push(q.mul(weights[i],points[i][k]));
    const h=bilinear(q,values);H.push(h);
    A.push(minus(q,multiply(q,W,derivative(q,h,0)),multiply(q,h,derivative(q,W,0))));
    B.push(minus(q,multiply(q,W,derivative(q,h,1)),multiply(q,h,derivative(q,W,1))));
  }
  for(const p of A)for(let i=3;i<9;i++)splitCheck(p[i].n===0n,'BINDING','U derivative numerator must have degree0x2');
  for(const p of B)for(let i=0;i<9;i++)if(i%3!==0)splitCheck(p[i].n===0n,'BINDING','V derivative numerator must have degree2x0');
  const C=[minus(q,multiply(q,A[1],B[2]),multiply(q,A[2],B[1])),minus(q,multiply(q,A[2],B[0]),multiply(q,A[0],B[2])),minus(q,multiply(q,A[0],B[1]),multiply(q,A[1],B[0]))];
  const J=zero(q);
  for(let i=0;i<9;i++)for(let k=0;k<3;k++)J[i]=q.add(J[i],q.mul(frame.normal[k],C[k][i]));
  const coefficients=bernstein(q,J);let minimum=coefficients[0];
  for(const value of coefficients){splitCheck(value.n>0n,'BINDING','used native child has no strictly positive projected Jacobian certificate');if(q.compare(value,minimum)<0)minimum=value;}
  const order=[0,2,3,1],corners: [Q,Q][]=[],turns: Q[]=[];
  for(const i of order){const d=sub(q,points[i],frame.origin);corners.push([dot(q,frame.u,d),dot(q,frame.v,d)]);}
  for(let i=0;i<4;i++){const turn=projectedTurn(q,corners[i],corners[(i+1)%4],corners[(i+2)%4]);splitCheck(turn.n>0n,'BINDING','used child projected boundary must be strictly convex and positively oriented');turns.push(turn);}
  const cu=[q.from(child.knotsU[1]),q.from(child.knotsU[2])],cv=[q.from(child.knotsV[1]),q.from(child.knotsV[2])],ideal: V[]=[];
  for(let i=0;i<2;i++)for(let j=0;j<2;j++){
    const su=q.div(q.sub(cu[i],frame.domainU[0]),q.sub(frame.domainU[1],frame.domainU[0])),sv=q.div(q.sub(cv[j],frame.domainV[0]),q.sub(frame.domainV[1],frame.domainV[0]));
    const p: V=[q.rat(0n),q.rat(0n),q.rat(0n)];for(let k=0;k<3;k++)p[k]=q.add(frame.origin[k],q.add(q.mul(frame.u[k],su),q.mul(frame.v[k],sv)));ideal.push(p);
  }
  const residual: Q[][]=[];
  for(let k=0;k<3;k++){const values: Q[]=[];for(let i=0;i<4;i++)values.push(ideal[i][k]);residual.push(bernstein(q,minus(q,H[k],multiply(q,W,bilinear(q,values)))));}
  let bound=q.rat(0n),minWeight=weights[0];
  for(const w of weights)if(q.compare(w,minWeight)<0)minWeight=w;
  for(let i=0;i<9;i++){let sum=q.rat(0n);for(let k=0;k<3;k++)sum=q.add(sum,q.abs(residual[k][i]));bound=q.max(bound,sum);}
  bound=q.div(bound,minWeight);
  const text: SectionFraction[]=[],cornerText: SectionFraction[]=[];for(const value of coefficients)text.push(q.text(value));for(const value of turns)cornerText.push(q.text(value));
  return {bound,proof:{used:true,regularityCertified:true,projection:'original-u-v-dot-products',jacobianDegree:[2,2],jacobianBernstein:text,minimumJacobianBernstein:q.text(minimum),projectedCornerTurns:cornerText,coefficientPositionBound:q.text(bound),maximumWorldPositionBound:q.upward(bound),wholeModel:'positive-weight-rational-bilinear',globalBinary64EvaluatorErrorCertified:false}};
}
