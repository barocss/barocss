import { buildBrep } from '../dist/brep/brep-core.js';
/** Multiplicity-two U knot controls retain matching derivatives; this is not a geometric kink. */
/** Native quadratic sheet with curved interior, exact boundary rows, and rational weights. */
export function normalSheet({ center = [0,0,0], c0 = false, wide = false } = {}) {
  const xs = c0 ? [0,.5,1,1.5,2] : wide==='positive' ? [1,500000,1e6] : wide ? [-1e6,0,1e6] : [0,1,2];
  const knotsU = c0 ? [0,0,0,.5,.5,1,1,1] : [0,0,0,1,1,1], knotsV = [0,0,0,1,1,1];
  const controlPoints = xs.map((x,i)=>[0,.5,1].map((y,j)=>[x+center[0],y+center[1],center[2]+(j===1 ? (c0 ? [0,.05,.1,.15,0][i] : i===1 ? .1 : 0) : 0)]));
  const weights = xs.map(()=>[1,8,1]);
  const surface = {kind:'surface',id:'normal_surface',degreeU:2,degreeV:2,knotsU,knotsV,controlPoints,weights};
  const n=xs.length-1, corners=[controlPoints[0][0],controlPoints[n][0],controlPoints[n][2],controlPoints[0][2]];
  const curves=[
    {degree:2,knots:knotsU,controlPoints:controlPoints.map(r=>r[0]),weights:weights.map(r=>r[0])},
    {degree:2,knots:knotsV,controlPoints:controlPoints[n],weights:weights[n]},
    {degree:2,knots:knotsU,controlPoints:controlPoints.map(r=>r[2]),weights:weights.map(r=>r[2])},
    {degree:2,knots:knotsV,controlPoints:controlPoints[0],weights:weights[0]},
  ];
  const edges=curves.map((c,i)=>({id:`e${i}`,curve:{kind:'curve',id:`c${i}`,...c},vertices:i<2?[`v${i}`,`v${i+1}`]:i===2?['v3','v2']:['v0','v3']}));
  return buildBrep({source:{family:'normal-translation-test',id:'sheet'},tolerance:1e-7,vertices:corners.map((point,i)=>({id:`v${i}`,point})),edges,bodies:[{id:'sheet',kind:'sheet',shells:[{id:'shell',closed:false,faces:[{id:'face',surface,sense:'forward',loops:[{kind:'outer',uses:edges.map((e,i)=>({edge:e.id,sense:i<2?'forward':'reversed'}))}]}]}]}]});
}
/** Independent rational quadratic Bernstein partials, evaluated after centering actual stored poles. */
export function oracleNormal(s,u,v) {
  const c0=s.controlPoints.length===5,start=c0&&u>=.5?2:0,t=c0?(u-start/4)*2:u;
  const B=x=>[(1-x)**2,2*x*(1-x),x*x],D=x=>[-2*(1-x),2-4*x,2*x],a=B(t),b=B(v),da=D(t),db=D(v),o=s.controlPoints[0][0];
  const p=[0,0,0],du=[0,0,0],dv=[0,0,0];let w=0,wu=0,wv=0;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const q=s.controlPoints[start+i][j],weight=s.weights[start+i][j],f=a[i]*b[j]*weight,fu=da[i]*b[j]*weight*(c0?2:1),fv=a[i]*db[j]*weight;
    w+=f;wu+=fu;wv+=fv;for(let k=0;k<3;k++){const x=q[k]-o[k];p[k]+=f*x;du[k]+=fu*x;dv[k]+=fv*x;}
  }
  for(let k=0;k<3;k++){du[k]=(du[k]-wu*p[k]/w)/w;dv[k]=(dv[k]-wv*p[k]/w)/w;}
  const n=[du[1]*dv[2]-du[2]*dv[1],du[2]*dv[0]-du[0]*dv[2],du[0]*dv[1]-du[1]*dv[0]],l=Math.hypot(...n);return n.map(x=>x/l);
}
