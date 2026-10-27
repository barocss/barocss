export interface HomogeneousBernsteinEquation {
  bernstein: number[]; power: number[]; degree: 'quadratic'|'linear'|'constant'|'zero';
  discriminant: number|null; uncertainty: number; exclusionPolicy?: 'strict-Bernstein-sign-control-hull-exclusion';
}
export interface HomogeneousBernsteinRoot { t: number; bracket: [number,number]; iterations: number; touch: boolean }
export interface HomogeneousBernsteinRootOptions { parameterWidthTarget?: number; label?: string }
const DEFAULT_LABEL='Own homogeneous Bernstein root';
function requireRoot(condition:boolean,message:string,label:string):asserts condition {if(!condition)throw new Error((label+': '+message).slice(0,1024));}
function finiteRoot(value:number,label:string):number {requireRoot(Number.isFinite(value),'finite native root/coefficient arithmetic required',label);return value;}
function midpoint(a:number,b:number):number{return a+(b-a)/2;}
/** Original homogeneous coefficients, without changing native Curve coefficients. */
export function createHomogeneousBernsteinEquation(values:number[],label=DEFAULT_LABEL):HomogeneousBernsteinEquation {
  requireRoot((values.length===2||values.length===3)&&values.every(Number.isFinite),'degree1/2 finite Bernstein coefficients required',label);
  const finite=(value:number)=>finiteRoot(value,label),[f0,f1,f2]=values;
  const a=values.length===3?finite(f0-2*f1+f2):0,b=values.length===3?finite(2*(f1-f0)):finite(f1-f0),c=f0;
  const degree=values.every(x=>x===0)?'zero':a!==0?'quadratic':b!==0?'linear':'constant';
  const bb=finite(b*b),ac=finite(4*a*c),discriminant=degree==='quadratic'?finite(bb-ac):null,uncertainty=finite(32*Number.EPSILON*(Math.abs(bb)+Math.abs(ac)));
  return{bernstein:values,power:[a,b,c],degree,discriminant,uncertainty};
}
function bernstein(e:HomogeneousBernsteinEquation,t:number,label:string):number {
  const finite=(value:number)=>finiteRoot(value,label),[a,b,c]=e.bernstein,s=1-t;
  return e.bernstein.length===2?finite(finite(a*s)+finite(b*t)):finite(finite(a*s*s)+finite(2*b*s*t)+finite(c*t*t));
}
/** Bounded normalized-span roots; callers retain original-domain mapping evidence. */
export function solveHomogeneousBernsteinEquation(e:HomogeneousBernsteinEquation,options:HomogeneousBernsteinRootOptions={}):HomogeneousBernsteinRoot[] {
  const label=options.label??DEFAULT_LABEL,WIDTH=options.parameterWidthTarget??1e-12,check=(condition:boolean,message:string)=>requireRoot(condition,message,label),finite=(value:number)=>finiteRoot(value,label);
  check(Number.isFinite(WIDTH)&&WIDTH>0&&WIDTH<1,'finite positive subspan root-width target required');
  const measure=(t:number)=>bernstein(e,t,label);
  // Keep the original638 quadratic arithmetic and ordering policy.
  if(e.bernstein.every(x=>x>0)||e.bernstein.every(x=>x<0)){e.exclusionPolicy='strict-Bernstein-sign-control-hull-exclusion';return[];}
  if(e.degree==='zero'||e.degree==='constant')return[];
  // Bracket-based isolation (no closed-form estimate is filtered, so a root that rounds just past 0 or 1
  // cannot vanish): split [0,1] at the quadratic's vertex, where f is monotone on each piece, and refine
  // every piece whose end values change sign. Endpoint zeros are exact roots of the coefficients.
  const [a,b]=e.power,f0=e.bernstein[0],fN=e.bernstein.at(-1)!,quadratic=e.degree==='quadratic';
  if(quadratic&&f0!==0&&fN!==0){const d=e.discriminant!;if(d < -e.uncertainty)return[];check(d>e.uncertainty,'unresolved interior tangent/discriminant ambiguity');}
  const vertex=quadratic?finite(-b/(2*a)):Number.NaN,cuts=[0,...(vertex>0&&vertex<1?[vertex]:[]),1];
  const endpoint=(t:0|1):HomogeneousBernsteinRoot=>({t,bracket:[t,t],iterations:0,touch:e.bernstein.length===3&&e.bernstein[1]===0});
  const roots:HomogeneousBernsteinRoot[]=[];if(f0===0)roots.push(endpoint(0));
  for(let k=0;k+1<cuts.length;k++){
    let lo=cuts[k],hi=cuts[k+1],fl=lo===0?f0:measure(lo),fh=hi===1?fN:measure(hi);
    check(!(lo===vertex&&lo>0&&fl===0)&&!(hi===vertex&&hi<1&&fh===0),'unresolved interior tangent/discriminant ambiguity');
    if(fl===0||fh===0||Math.sign(fl)===Math.sign(fh))continue;
    const sign=Math.sign(fl);let iterations=0;
    while(hi-lo>WIDTH&&iterations<64){const mid=midpoint(lo,hi);check(mid>lo&&mid<hi,'root midpoint not representable');const fm=measure(mid);if(fm===0){const left=midpoint(lo,mid),right=midpoint(mid,hi);check(left>lo&&left<mid&&right>mid&&right<hi,'zero-root bracket not representable');const l=measure(left),r=measure(right);check((l===0||Math.sign(l)===sign)&&(r===0||Math.sign(r)!==sign),'zero-root bracket order unresolved');lo=left;hi=right;fl=l;fh=r;}else if(Math.sign(fm)===sign){lo=mid;fl=fm;}else{hi=mid;fh=fm;}iterations++;}
    const t=midpoint(lo,hi);check(hi-lo<=WIDTH&&lo>=0&&hi<=1&&t>0&&t<1,'root bracket width/quarter ordering unresolved');roots.push({t,bracket:[lo,hi],iterations,touch:false});
  }
  if(fN===0)roots.push(endpoint(1));
  check(roots.length<=2,'quadratic root count');return roots;
}
