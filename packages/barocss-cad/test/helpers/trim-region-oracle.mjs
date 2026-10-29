// Test-only exact slab oracle. No CAD predicate, arrangement or rational helper imports.
const zero={n:0n,d:1n};
function q(n,d=1n){if(!d)throw Error('oracle zero denominator');if(d<0n){n=-n;d=-d;}let a=n<0n?-n:n,b=d;while(b){[a,b]=[b,a%b];}return {n:n/a,d:d/a};}
function number(v){const bytes=new DataView(new ArrayBuffer(8));bytes.setFloat64(0,v);const bits=bytes.getBigUint64(0),exp=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n),m=exp===0?fraction:(1n<<52n)|fraction,sign=bits>>63n?-1n:1n,p=exp===0?-1074:exp-1075;return p>=0?q(sign*(m<<BigInt(p))):q(sign*m,1n<<BigInt(-p));}
const add=(a,b)=>q(a.n*b.d+b.n*a.d,a.d*b.d),sub=(a,b)=>q(a.n*b.d-b.n*a.d,a.d*b.d),mul=(a,b)=>q(a.n*b.n,a.d*b.d),div=(a,b)=>q(a.n*b.d,a.d*b.n);
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const min=(a,b)=>cmp(a,b)<=0?a:b,max=(a,b)=>cmp(a,b)>=0?a:b;
const at=(line,t)=>add(mul(line.s,t),line.o),value=x=>Number(x.n)/Number(x.d);
export function exactlyAffinePoles(points){for(let k=0;k<3;k++){const residual=add(sub(sub(number(points[1][1][k]),number(points[1][0][k])),number(points[0][1][k])),number(points[0][0][k]));if(residual.n!==0n)return false;}return true;}
function integral(lo,hi,c){let sum=zero,l=q(1n),h=q(1n);for(let i=0;i<c.length;i++){l=mul(l,lo);h=mul(h,hi);sum=add(sum,div(mul(c[i],sub(h,l)),q(BigInt(i+1))));}return sum;}
export function regionOracle(uv,domain,crop,keep){
  const points=uv.map(([u,v])=>[number(v),number(u)]),td=crop.v.map(number),od=domain.u.map(number),co=crop.u.map(number),unique=new Map();
  const put=t=>{if(cmp(t,td[0])>=0&&cmp(t,td[1])<=0)unique.set(`${t.n}/${t.d}`,t);};
  for(const p of points)put(p[0]);for(const t of td)put(t);
  // Crossings with perpendicular crop borders are formula-switch levels, not only polygon vertices.
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(cmp(a[0],b[0])===0||cmp(a[1],b[1])===0)continue;
    const s=div(sub(b[1],a[1]),sub(b[0],a[0])),o=sub(a[1],mul(s,a[0]));
    for(const border of co){const t=div(sub(border,o),s);if(cmp(t,min(a[0],b[0]))>=0&&cmp(t,max(a[0],b[0]))<=0)put(t);}
  }
  const levels=[...unique.values()].sort(cmp),nodes=[],parents=[];let previous=[];
  const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  for(let k=0;k+1<levels.length;k++){
    const lo=levels[k],hi=levels[k+1],mid=div(add(lo,hi),q(2n)),crossing=[];
    for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(cmp(min(a[0],b[0]),mid)<0&&cmp(mid,max(a[0],b[0]))<0){const s=div(sub(b[1],a[1]),sub(b[0],a[0]));crossing.push({s,o:sub(a[1],mul(s,a[0]))});}}
    crossing.sort((a,b)=>cmp(at(a,mid),at(b,mid)));if(crossing.length%2)throw Error('oracle odd crossing count');
    const intervals=[];if(keep==='inside'){for(let i=0;i<crossing.length;i+=2)intervals.push([crossing[i],crossing[i+1]]);}
    else{let left={s:zero,o:od[0]};for(let i=0;i<crossing.length;i+=2){intervals.push([left,crossing[i]]);left=crossing[i+1];}intervals.push([left,{s:zero,o:od[1]}]);}
    const current=[];
    for(let [left,right] of intervals){
      if(cmp(at(left,mid),co[0])<0)left={s:zero,o:co[0]};if(cmp(at(right,mid),co[1])>0)right={s:zero,o:co[1]};if(cmp(at(right,mid),at(left,mid))<=0)continue;
      const ds=sub(right.s,left.s),doff=sub(right.o,left.o),a=integral(lo,hi,[doff,ds]),mt=integral(lo,hi,[zero,doff,ds]);
      const mo=integral(lo,hi,[div(sub(mul(right.o,right.o),mul(left.o,left.o)),q(2n)),sub(mul(right.s,right.o),mul(left.s,left.o)),div(sub(mul(right.s,right.s),mul(left.s,left.s)),q(2n))]);
      const i=nodes.length;nodes.push({a,mt,mo});parents.push(i);
      for(const old of previous)if(cmp(old.hi,lo)===0&&cmp(sub(min(at(right,lo),at(old.right,lo)),max(at(left,lo),at(old.left,lo))),zero)>0)parents[root(i)]=root(old.i);
      current.push({i,left,right,hi});
    }
    previous=current;
  }
  const sums=new Map();for(let i=0;i<nodes.length;i++){const key=root(i),old=sums.get(key),n=nodes[i];sums.set(key,old?{a:add(old.a,n.a),mt:add(old.mt,n.mt),mo:add(old.mo,n.mo)}:n);}
  const out=[];for(const n of sums.values()){const u=div(n.mo,n.a),v=div(n.mt,n.a);out.push({areaUV:value(n.a),area:25*value(n.a),centroid:[20+5*value(u),-11+5*value(v),3]});}return out;
}
