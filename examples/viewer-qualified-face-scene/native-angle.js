const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face native angle: '+message);};
function sameBits(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&sameBits(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function finite(value,label){check(Number.isFinite(value),label+' is not finite');return value;}
function leg(endpoint,vertex){
  const vector=[0,1,2].map(axis=>finite(endpoint.pointMM[axis]-vertex.pointMM[axis],'original leg component'));
  const length=finite(Math.hypot(...vector),'original leg length');check(length>0,'original leg has represented zero length');
  const direction=vector.map(value=>{
    const normalized=finite(value/length,'normalized leg component');
    check(value===0||normalized!==0,'nonzero original leg component collapsed during normalization');
    return normalized;
  });
  return{length,direction};
}
function product(a,b){
  const value=finite(a*b,'normalized product');
  check(a===0||b===0||value!==0,'nonzero normalized factors produced represented zero');return value;
}

/** Unsigned angle at the original vertex; no screen/tangent/dihedral or accuracy certificate. */
export function queryQualifiedFaceAngle(viewer,first,vertex,third){
  const firstPair=viewer.measureQualifiedFacePoints(first,vertex);
  const thirdPair=viewer.measureQualifiedFacePoints(third,vertex);
  check(sameBits(firstPair.second,thirdPair.second),'repeated vertex pin, parameters or coordinates changed');
  const firstLeg=leg(firstPair.first,firstPair.second),thirdLeg=leg(thirdPair.first,firstPair.second);
  const a=firstLeg.direction,b=thirdLeg.direction;
  const cross=[
    finite(product(a[1],b[2])-product(a[2],b[1]),'cross X'),
    finite(product(a[2],b[0])-product(a[0],b[2]),'cross Y'),
    finite(product(a[0],b[1])-product(a[1],b[0]),'cross Z')
  ];
  const dot=finite(finite(product(a[0],b[0])+product(a[1],b[1]),'dot partial sum')+product(a[2],b[2]),'dot sum');
  const crossLength=finite(Math.hypot(...cross),'cross norm');
  const angleRadians=finite(Math.atan2(crossLength,dot),'angle radians');
  const angleDegrees=finite(angleRadians*180/Math.PI,'angle degrees');
  check(angleRadians>=0&&angleRadians<=Math.PI&&angleDegrees>=0&&angleDegrees<=180,'unsigned angle exceeds its declared range');
  const {pointMM,pointScene,...anchor}=firstPair.second;
  return structuredClone({version:0,first:firstPair.first,vertex:firstPair.second,third:thirdPair.first,
    legsMM:[firstLeg.length,thirdLeg.length],angleRadians,angleDegrees,
    metric:'unsigned-three-point-angle',basis:'authored-xyz-matches-rhyup',certification:'not-certified',anchor});
}
