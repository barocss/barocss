/** Authored frozen inputs. Loading is forbidden until root's actual source freeze. */
const row=(aId,bId,normal=[1,0,0],boundM=0)=>({aId,bId,normal:[...normal],boundM});
const ids=['a','b','c','d','e','f','g','h','i'];
const M9=()=>ids.map((id,i)=>({id,inverseMass:i===0?0:1}));
const D3=()=>['a','b','c'].map(id=>({id,inverseMass:1}));
const S2=()=>['a','b'].map(id=>({id,inverseMass:0}));
const zero36=()=>ids.flatMap((a,i)=>ids.slice(i+1).map(b=>row(a,b)));
export const simple=()=>({bodies:[{id:'a',inverseMass:1},{id:'b',inverseMass:1}],rows:[row('a','b',[1,0,0],.1)]});
export function kernelCases(){
 const inconsistent=zero36();inconsistent[0].boundM=1;inconsistent[1]=row('a','c',[-1,0,0],1);inconsistent.find(x=>x.aId==='b'&&x.bId==='c').boundM=1;
 return [
 {id:'L01-zero',problem:{bodies:[{id:'a',inverseMass:0},{id:'b',inverseMass:1}],rows:[]},status:'SOLVED'},
 {id:'L02-eight',problem:{bodies:M9(),rows:ids.slice(1).map(id=>row('a',id))},status:'SOLVED'},
 {id:'L04-thirty-six',problem:{bodies:M9(),rows:zero36()},status:'SOLVED'},
 {id:'L05-thirty-six-inconsistent',problem:{bodies:M9(),rows:inconsistent},status:'INFEASIBLE'},
 {id:'L06-dependent-coherent',problem:{bodies:D3(),rows:[row('a','b',[1,0,0],1),row('b','c',[1,0,0],1),row('a','c',[1,0,0],2)]},status:'SOLVED'},
 ...[0,-1,1].map(boundM=>({id:'L07-08-static-'+boundM,problem:{bodies:S2(),rows:[row('a','b',[1,0,0],boundM)]},status:boundM>0?'INFEASIBLE':'SOLVED'})),
 {id:'L09-near-zero-feasible',problem:{bodies:D3(),rows:[row('a','b'),row('a','c'),row('b','c',[1,1e-13,0])]},status:'SOLVED'},
 {id:'L09-near-independent-unsafe',problem:{bodies:simple().bodies,rows:[row('a','b',[1,0,0],.1),row('a','b',[1,1e-8,0],.100000001)]},status:'NUMERIC_UNSAFE'},
 {id:'L10-mass-endpoints',problem:{bodies:[{id:'a',inverseMass:1e-6},{id:'b',inverseMass:1e6}],rows:[row('a','b',[1,0,0],1)]},status:'SOLVED'},
 ...[0,-0,-1e-13].map((boundM,i)=>({id:'L11-unclamped-'+i,problem:{bodies:M9(),rows:ids.slice(1).map((id,j)=>row('a',id,[1,0,0],j===0?boundM:0))},status:'SOLVED'})),
 ...[-10,10].map(boundM=>({id:'L12-range-endpoint-'+boundM,problem:{bodies:[{id:'a',inverseMass:0},{id:'b',inverseMass:1}],rows:[row('a','b',[1,0,0],boundM)]},status:'SOLVED'})),
 ];
}
export function eligiblePairs(bodies){const pairs=[];for(let a=0;a<bodies.length;a++)for(let b=a+1;b<bodies.length;b++)if(bodies[a].inverseMass!==0||bodies[b].inverseMass!==0)pairs.push(bodies[a].id<bodies[b].id?[a,b]:[b,a]);return pairs.sort((x,y)=>{const a=bodies[x[0]].id+'\0'+bodies[x[1]].id,b=bodies[y[0]].id+'\0'+bodies[y[1]].id;return a<b?-1:a>b?1:0;});}
