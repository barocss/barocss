// Independent nonprimitive reference port. No production modules or libraries.
export const PRECISIONS = [64, 128, 256, 512, 1024, 2048];
const MAX_BITS = 16384, MAX_OPS = 2000000;
const TEN24 = 1000000000000000000000000n, TEN25 = 10000000000000000000000000n;
const view = new DataView(new ArrayBuffer(8));
const bits = value => value === 0n ? 0 : (value < 0n ? -value : value).toString(2).length;
const sign = value => value > 0n ? 1 : value < 0n ? -1 : 0;
const abs = value => value < 0n ? -value : value;
const fail = message => { throw new Error(message); };

export class Meter {
  operations = 0; peakBits = 0; axes = 0; models = 0;
  tick() { if (++this.operations > MAX_OPS) fail('INTEGER_OPERATION_LIMIT'); }
  checked(value) {
    const count = bits(value); this.peakBits = Math.max(this.peakBits, count);
    if (count > MAX_BITS) fail('INTEGER_BIT_LIMIT');
    return value;
  }
  mul(a,b) {
    this.tick();
    if (a !== 0n && b !== 0n && bits(a) + bits(b) > MAX_BITS) fail('INTEGER_PRODUCT_PREBOUND');
    return this.checked(a*b);
  }
  add(a,b) {
    this.tick();
    if (Math.max(bits(a),bits(b)) + 1 > MAX_BITS) fail('INTEGER_SUM_PREBOUND');
    return this.checked(a+b);
  }
  sub(a,b) { return this.add(a,-b); }
  shift(a,power) {
    this.tick();
    if (!Number.isInteger(power) || power < 0 || bits(a)+power > MAX_BITS) fail('INTEGER_SHIFT_PREBOUND');
    return this.checked(a << BigInt(power));
  }
  div(a,b) {
    this.tick(); if (b <= 0n) fail('NONPOSITIVE_DIVISOR');
    let q = a/b;
    if (a < 0n && a%b !== 0n) q--;
    return this.checked(q);
  }
  compare(a,b) { this.tick(); return a > b ? 1 : a < b ? -1 : 0; }
  dot(a,b) { let total=0n; for(let i=0;i<a.length;i++) total=this.add(total,this.mul(a[i],b[i])); return total; }
  cross(a,b) { return [[1,2],[2,0],[0,1]].map(([i,j])=>this.sub(this.mul(a[i],b[j]),this.mul(a[j],b[i]))); }
  sqrtFloor(value) {
    if (value <= 0n) fail('NONPOSITIVE_RADICAND');
    let current=this.shift(1n,Math.floor((bits(value)+1)/2));
    for(let iteration=0;iteration<64;iteration++) {
      const next=this.div(this.add(current,this.div(value,current)),2n);
      if(this.compare(next,current)>=0) {
        if(this.compare(this.mul(current,current),value)>0) fail('SQRT_CERTIFICATE');
        const upper=this.add(current,1n);
        if(this.compare(this.mul(upper,upper),value)<=0) fail('SQRT_CERTIFICATE');
        return current;
      }
      current=next;
    }
    fail('SQRT_ITERATION_LIMIT');
  }
  stats() { return {integerOperations:this.operations,peakIntegerBits:this.peakBits,axisVisits:this.axes,conventionProblems:this.models}; }
}

function dyadic(value) {
  if(typeof value !== 'number' || !Number.isFinite(value)) fail('NONFINITE_INPUT');
  view.setFloat64(0,value,false);
  const word=view.getBigUint64(0,false), negative=(word>>63n)!==0n;
  const exponent=Number((word>>52n)&2047n), fraction=word&((1n<<52n)-1n);
  let numerator=exponent===0?fraction:fraction+(1n<<52n);
  let power=exponent===0?-1074:exponent-1023-52;
  if(numerator===0n) return [0n,0];
  // IEEE significand work is fixed to at most53 bits; not large-integer SAT work.
  while(power<0 && (numerator&1n)===0n) { numerator>>=1n; power++; }
  if(power>=0) return [negative?-(numerator<<BigInt(power)):numerator<<BigInt(power),0];
  return [negative?-numerator:numerator,-power];
}

function vector(values,bound,length=3) {
  if(!Array.isArray(values)||values.length!==length||values.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>bound)) fail('VECTOR_BOUND');
  return values.slice();
}

export function prepare(body,m) {
  if(!body||typeof body.id!=='string'||!body.id||!['dynamic','static','kinematic'].includes(body.kind)) fail('BODY_LAYOUT');
  if(body.shape?.kind!=='box') fail('BOX_REQUIRED');
  const center=vector(body.positionM,10000), extents=vector(body.shape.halfExtentsM,1000);
  if(extents.some(v=>v<.0001)) fail('EXTENT_BOUND');
  const quaternion=vector(body.orientation,1,4), words=quaternion.map(dyadic);
  const power=Math.max(...words.map(v=>v[1]));
  const q=words.map(([n,d])=>m.shift(n,power-d)), scale=m.shift(1n,power), scale2=m.mul(scale,scale), norm2=m.dot(q,q);
  const lower=m.mul(scale,999999999n), upper=m.mul(scale,1000000001n), scaled=m.mul(norm2,1000000000000000000n);
  if(norm2===0n||m.compare(scaled,m.mul(lower,lower))<0||m.compare(scaled,m.mul(upper,upper))>0) fail('QUATERNION_NORM_BOUND');
  const [x,y,z,w]=q, twice=(a,b)=>m.mul(2n,m.mul(a,b));
  const [xy,xz,xw,yz,yw,zw]=[[x,y],[x,z],[x,w],[y,z],[y,w],[z,w]].map(([a,b])=>twice(a,b));
  const [xx,yy,zz]=[x,y,z].map(v=>m.mul(v,v));
  function basis(denominator) {
    const diagonal=[[yy,zz],[xx,zz],[xx,yy]].map(([a,b])=>m.sub(denominator,m.mul(2n,m.add(a,b))));
    const rows=[[diagonal[0],m.sub(xy,zw),m.add(xz,yw)],[m.add(xy,zw),diagonal[1],m.sub(yz,xw)],[m.sub(xz,yw),m.add(yz,xw),diagonal[2]]];
    return {columns:[0,1,2].map(i=>rows.map(row=>row[i])),denominator};
  }
  return {id:body.id,kind:body.kind,center,extents,raw:basis(scale2),normalized:basis(norm2)};
}

function compareMargin(a,b,m) {
  const sa=sign(a.numerator), sb=sign(b.numerator);
  if(sa!==sb) return m.compare(BigInt(sa),BigInt(sb));
  if(sa===0) { m.tick(); return 0; }
  const left=m.mul(m.mul(m.mul(a.numerator,a.numerator),m.mul(b.denominator,b.denominator)),b.square);
  const right=m.mul(m.mul(m.mul(b.numerator,b.numerator),m.mul(a.denominator,a.denominator)),a.square);
  return sa*m.compare(left,right);
}

function support(extents,columns,axis,m) {
  let total=0n;
  for(let i=0;i<3;i++) total=m.add(total,m.mul(extents[i],abs(m.dot(columns[i],axis))));
  return total;
}

function solveModel(a,b,normalized,m) {
  m.models++;
  const ba=normalized?a.normalized:a.raw, bb=normalized?b.normalized:b.raw;
  const words=[...a.center,...b.center,...a.extents,...b.extents].map(dyadic), power=Math.max(...words.map(v=>v[1]));
  const lifted=words.map(([n,d])=>m.shift(n,power-d));
  const [ca,cb,ha,hb]=[0,3,6,9].map(i=>lifted.slice(i,i+3)), delta=ca.map((v,i)=>m.sub(cb[i],v));
  const crossDen=m.mul(ba.denominator,bb.denominator), denominator=m.mul(m.shift(1n,power),crossDen);
  const axes=[...ba.columns.map(u=>[u,ba.denominator]),...bb.columns.map(u=>[u,bb.denominator]),
    ...ba.columns.flatMap(u=>bb.columns.map(v=>[m.cross(u,v),crossDen]))];
  let minimum=null, ties=[];
  const classifications=[];
  for(let index=0;index<15;index++) {
    m.axes++;
    const [axis,axisDen]=axes[index], square=m.dot(axis,axis), zero=square===0n;
    const near=!zero && index>=6 && m.compare(m.mul(square,TEN24),m.mul(axisDen,axisDen))<0;
    if(zero) { classifications.push({axis:index,exactZero:true,nearParallel:false,marginSign:null}); continue; }
    const sa=support(ha,ba.columns,axis,m), sb=support(hb,bb.columns,axis,m), center=abs(m.dot(delta,axis));
    const numerator=m.sub(m.add(m.mul(sa,bb.denominator),m.mul(sb,ba.denominator)),m.mul(center,crossDen));
    const margin={numerator,denominator,square,axis:index};
    classifications.push({axis:index,exactZero:false,nearParallel:near,marginSign:sign(numerator)});
    const comparison=minimum===null?-1:compareMargin(margin,minimum,m);
    if(comparison<0) { minimum=margin; ties=[index]; } else if(comparison===0) ties.push(index);
  }
  if(minimum===null) fail('NO_NONZERO_AXIS');
  return [minimum,{firstExactMinimum:minimum.axis,exactTiedMinima:ties,axes:classifications}];
}

function interval(value,p,m) {
  if(value.numerator===0n) return [0n,0n,p];
  const root=m.sqrtFloor(m.shift(value.square,2*p)), numerator=m.shift(abs(value.numerator),2*p);
  const lowerDen=m.mul(value.denominator,m.add(root,1n)), upperDen=m.mul(value.denominator,root);
  const low=m.div(numerator,lowerDen), high=m.add(m.div(numerator,upperDen),1n);
  return value.numerator>0n?[low,high,p]:[-high,-low,p];
}

function word(value) {
  view.setFloat64(0,value,true);
  return [...new Uint8Array(view.buffer)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function dyadicWord(value,p,m) {
  if(value===0n) return '0000000000000000';
  const s=value<0n?-1:1, numerator=abs(value), exponent=bits(numerator)-1-p, unit=Math.max(-1074,exponent-52), shift=p+unit;
  let significand;
  if(shift<=0) significand=m.shift(numerator,-shift);
  else {
    const denominator=m.shift(1n,shift);
    significand=m.div(numerator,denominator);
    const remainder=m.sub(numerator,m.mul(significand,denominator)), comparison=m.compare(m.mul(2n,remainder),denominator);
    if(comparison>0||(comparison===0&&(significand&1n)!==0n)) significand=m.add(significand,1n);
  }
  const rounded=Number(significand)*Math.pow(2,unit)*s;
  if(!Number.isFinite(rounded)) fail('NONFINITE_OUTPUT');
  return word(rounded);
}

function fromWord(hex) {
  for(let i=0;i<8;i++) view.setUint8(i,Number.parseInt(hex.slice(2*i,2*i+2),16));
  return view.getFloat64(0,true);
}

function adjacent(value,towardPositive) {
  if(value===0) return towardPositive?Number.MIN_VALUE:-Number.MIN_VALUE;
  view.setFloat64(0,value,false); let raw=view.getBigUint64(0,false);
  raw += towardPositive===(value>0)?1n:-1n;
  view.setBigUint64(0,raw,false); return view.getFloat64(0,false);
}

function ownCell(low,high,p,hex,m) {
  const value=fromWord(hex), below=adjacent(value,false), above=adjacent(value,true);
  if(!Number.isFinite(below)||!Number.isFinite(above)) return false;
  function boundary(a,b) {
    const [an,ap]=dyadic(a), [bn,bp]=dyadic(b), power=Math.max(ap,bp);
    return [m.add(m.shift(an,power-ap),m.shift(bn,power-bp)),power+1];
  }
  const [ln,lp]=boundary(below,value), [hn,hp]=boundary(value,above), lc=Math.max(p,lp), hc=Math.max(p,hp);
  return m.compare(m.shift(low,lc-p),m.shift(ln,lc-lp))>0 && m.compare(m.shift(high,hc-p),m.shift(hn,hc-hp))<0;
}

function absoluteDifference(a,b,m) {
  const low=m.sub(a[0],b[1]), high=m.sub(a[1],b[0]);
  if(low<=0n&&high>=0n) return [0n,(-low>high?-low:high),a[2]];
  const x=abs(low),y=abs(high); return [x<y?x:y,x>y?x:y,a[2]];
}

function gateStatus(i,m) {
  const [n,p]=dyadic(1e-12), common=Math.max(i[2],p), boundary=m.shift(n,common-p);
  if(m.compare(m.shift(i[1],common-i[2]),boundary)<=0) return 'PASS';
  if(m.compare(m.shift(i[0],common-i[2]),boundary)>0) return 'VIOLATION';
  return 'UNRESOLVED';
}

function certify(raw,normalized,stage,m) {
  const equal=compareMargin(raw,normalized,m)===0;
  for(const p of PRECISIONS) {
    const ri=interval(raw,p,m), ni=interval(normalized,p,m);
    const rd=raw.numerator<=0n?[0n,0n,p]:[ri[0]>0n?ri[0]:0n,ri[1]>0n?ri[1]:0n,p];
    const nd=normalized.numerator<=0n?[0n,0n,p]:[ni[0]>0n?ni[0]:0n,ni[1]>0n?ni[1]:0n,p];
    const values={rawMarginM:ri,normalizedMarginM:ni,rawDepthM:rd,normalizedDepthM:nd,
      rawNormalizedMarginDifferenceM:equal?[0n,0n,p]:absoluteDifference(ri,ni,m),
      rawNormalizedDepthDifferenceM:equal?[0n,0n,p]:absoluteDifference(rd,nd,m)};
    const fields={}; let complete=true;
    for(const [name,[low,high,power]] of Object.entries(values)) {
      const hex=dyadicWord(low,power,m);
      if(hex!==dyadicWord(high,power,m)||!ownCell(low,high,power,hex,m)||m.compare(m.mul(m.sub(high,low),TEN25),m.shift(1n,power))>0) { complete=false; break; }
      fields[name]={word:hex,low:low.toString(),high:high.toString(),precision:power};
    }
    if(!complete) continue;
    const names=['rawNormalizedMarginDifferenceM','rawNormalizedDepthDifferenceM'];
    if(stage==='HYP') names.push('rawDepthM','normalizedDepthM');
    const gates=Object.fromEntries(names.map(name=>[name,gateStatus(values[name],m)]));
    if(Object.values(gates).includes('UNRESOLVED')) continue;
    return {fields,gates};
  }
  fail('V2_CERTIFICATE_UNRESOLVED');
}

export function evaluatePair(a,b,stage,m) {
  if(!['PRE','HYP'].includes(stage)) fail('STAGE');
  const [raw,rawReport]=solveModel(a,b,false,m), [normalized,normalizedReport]=solveModel(a,b,true,m);
  const result=certify(raw,normalized,stage,m);
  return {pairKey:a.id+'\0'+b.id,fields:result.fields,raw:rawReport,normalized:normalizedReport,physicalGates:result.gates};
}

export function explicitSize(value,depth=0,counter={nodes:0}) {
  if(++counter.nodes>50000||depth>24) fail('WORKER_DATA_SHAPE_LIMIT');
  if(typeof value==='bigint') return 32+Math.ceil(bits(value)/8);
  if(typeof value==='string') return 24+2*value.length;
  if(value===null||typeof value!=='object') return 16;
  let total=48+16*Object.keys(value).length;
  for(const item of Object.values(value)) total+=explicitSize(item,depth+1,counter);
  return total;
}
