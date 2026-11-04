// Authored inputs only. No candidate/package imports, reference or expected poses.
export const budget = Object.freeze({cases:19,positiveCases:12,refusals:7,
  maxWorlds:0,maxPrivateCalls:19,maxLineBytes:2*1024*1024,maxWordBytes:512*1024,
  maxGraphBytes:16*1024*1024,maxDepth:32,maxNodes:262144});

function rotation(values) {
  const norm = Math.hypot(...values);
  return values.map(value => value / norm);
}

function body({id='moving',half=[.25,.5,.75],mass=2,
  orientation=[0,0,0,1],position=[0,5,0]}={}) {
  const [x,y,z] = half;
  const principal = [mass/3*(y*y+z*z),mass/3*(x*x+z*z),mass/3*(x*x+y*y)];
  return {id,kind:'dynamic',shape:{kind:'box',halfExtentsM:[...half]},positionM:[...position],
    velocityMps:[.125,-.08175,-.0625],orientation:rotation(orientation),
    angularVelocityRadps:[.25,-.125,.375],inertiaDiagonalKgM2:principal,
    inverseInertiaLocal:principal.map(value=>1/value),inverseMass:1/mass,sensor:false,
    restitution:0,frictionStatic:0,frictionDynamic:0};
}

function fixed() {
  return {id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.5,2]},
    positionM:[0,-.5,0],velocityMps:[0,0,0],orientation:[0,0,0,1],
    angularVelocityRadps:[0,0,0],inverseInertiaLocal:[0,0,0],inverseMass:0,
    sensor:false,restitution:0,frictionStatic:0,frictionDynamic:0};
}

export function privateCases() {
  const natural = [.1,.2,.3,Math.sqrt(.86)];
  const solved = (caseId,value,pairs=[]) => ({caseId,freeBodies:Array.isArray(value)?value:[value],
    pairs,context:{jointCount:0},expect:'SOLVED'});
  const result = [
    solved('identity-anisotropic',body()),
    solved('natural-rotation',body({orientation:natural})),
    solved('signed-quaternion',body({orientation:natural.map(value=>-value)})),
    solved('cyclic-quaternion',body({orientation:[natural[1],natural[2],natural[0],natural[3]]})),
    solved('principal-permutation',body({half:[.75,.25,.5],orientation:natural})),
    solved('z-quarter-turn',body({orientation:[0,0,Math.SQRT1_2,Math.SQRT1_2]})),
    solved('x-half-turn',body({orientation:[1,0,0,0]})),
    solved('y-quarter-turn',body({orientation:[0,Math.SQRT1_2,0,Math.SQRT1_2]})),
    solved('near-equal-principal',body({half:[.5,.5,.5000000000000001],orientation:natural})),
    solved('exact-isotropy',body({half:[.5,.5,.5],orientation:natural})),
    solved('another-mass',body({mass:.5,orientation:natural})),
    solved('static-partner',[body({orientation:natural}),fixed()],[[1,0]]),
  ];
  const refusal = (caseId,value,reasonPattern,pairs=[],context={jointCount:0}) =>
    ({caseId,freeBodies:Array.isArray(value)?value:[value],pairs,context,
      expect:'NUMERIC_LIMIT',reasonPattern});
  const ill = body();
  ill.inverseInertiaLocal = [1,1,1e-14];
  ill.inertiaDiagonalKgM2 = [1,1,1e14];
  const zero = body();
  zero.inverseInertiaLocal[2] = 0;
  const negative = body();
  negative.inverseInertiaLocal[2] = -1;
  const friction = body();
  friction.frictionStatic = .25;
  result.push(
    refusal('ill-conditioned-positive',ill,'positive definite well-scaled inertia required'),
    refusal('zero-principal',zero,'positive definite well-scaled inertia required'),
    refusal('negative-principal',negative,'profile is unsupported'),
    refusal('nonzero-friction',friction,'zero-friction zero-restitution'),
    refusal('joint',body(),'no joints',[],{jointCount:1}),
    refusal('five-body-bound',Array.from({length:5},(_,index)=>body({id:'body'+index})),
      'existing persistent body bound'),
    refusal('missing-pair',[body(),fixed()],'input is invalid'),
  );
  return result;
}

export function numericWordsHex(value) {
  const words=[];
  let nodes=0;
  function visit(item,depth) {
    if (++nodes>budget.maxNodes || depth>budget.maxDepth) throw new Error('numeric tree bound');
    if (typeof item==='number') {
      if (!Number.isFinite(item)) throw new Error('finite word required');
      if ((words.length+1)*8>budget.maxWordBytes) throw new Error('numeric word bound');
      const word=Buffer.allocUnsafe(8);word.writeDoubleLE(item);words.push(word);
    } else if (Array.isArray(item)) {
      for (const entry of item) visit(entry,depth+1);
    } else if (item && typeof item==='object') {
      for (const key of Object.keys(item)) visit(item[key],depth+1);
    }
  }
  visit(value,0);
  return Buffer.concat(words).toString('hex');
}

export function packet(data) {
  const value={format:'anisotropic-inertia-private-v1',data,
    numericWordsF64leHex:numericWordsHex(data)};
  if (Buffer.byteLength(JSON.stringify(value)+'\n')>budget.maxLineBytes)
    throw new Error('private packet byte bound');
  return value;
}
