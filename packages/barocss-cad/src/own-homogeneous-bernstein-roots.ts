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
  if(e.degree==='zero'||e.degree==='constant')return[];const [a,b,c]=e.power,estimated:number[]=[];
  if(e.bernstein[0]===0){estimated.push(0);if(a!==0)estimated.push(finite(-b/a));}
  else if(e.bernstein.at(-1)===0){estimated.push(1);if(a!==0)estimated.push(finite(c/a));}
  else if(e.degree==='linear')estimated.push(finite(-c/b));
  else {const d=e.discriminant!;if(d < -e.uncertainty)return[];check(d>e.uncertainty,'unresolved interior tangent/discriminant ambiguity');const q=finite(-.5*(b+(b>=0?1:-1)*Math.sqrt(d)));check(q!==0,'stable quadratic root denominator not representable');estimated.push(finite(q/a),finite(c/q));}
  for(const t of estimated)check(t!==0||e.bernstein[0]===0,'interior root rounded to quarter start');for(const t of estimated)check(t!==1||e.bernstein.at(-1)===0,'interior root rounded to quarter end');
  const ordered=[...new Set(estimated.filter(t=>t>=0&&t<=1))].sort((x,y)=>x-y);check(ordered.length<=2,'quadratic root count');
  return ordered.map((estimate,index)=>{if(estimate===0||estimate===1){const tangent=e.bernstein.length===3&&e.bernstein[1]===0;return{t:estimate,bracket:[estimate,estimate] as [number,number],iterations:0,touch:tangent};}
    let lo=index>0?midpoint(ordered[index-1],estimate):0,hi=index+1<ordered.length?midpoint(estimate,ordered[index+1]):1;
    check(lo<estimate&&estimate<hi,'distinct root ordering not representable');let fl=measure(lo),fh=measure(hi);check(fl!==0&&fh!==0&&Math.sign(fl)!==Math.sign(fh),'root bracket sign/order unresolved');const sign=Math.sign(fl);let iterations=0;
    while(hi-lo>WIDTH&&iterations<64){const mid=midpoint(lo,hi);check(mid>lo&&mid<hi,'root midpoint not representable');const fm=measure(mid);if(fm===0){const left=midpoint(lo,mid),right=midpoint(mid,hi);check(left>lo&&left<mid&&right>mid&&right<hi,'zero-root bracket not representable');const l=measure(left),r=measure(right);check((l===0||Math.sign(l)===sign)&&(r===0||Math.sign(r)!==sign),'zero-root bracket order unresolved');lo=left;hi=right;fl=l;fh=r;}else if(Math.sign(fm)===sign){lo=mid;fl=fm;}else{hi=mid;fh=fm;}iterations++;}
    check(hi-lo<=WIDTH&&lo>0&&hi<1,'root bracket width/quarter ordering unresolved');return{t:midpoint(lo,hi),bracket:[lo,hi] as [number,number],iterations,touch:false};});
}
