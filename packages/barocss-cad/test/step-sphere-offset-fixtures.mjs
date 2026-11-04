import { representabilitySphereStep } from './step-sphere-representability-fixtures.mjs';

/** Literal meridian sphere; only the support becomes a direct spherical offset. */
export function sphereOffsetStep({ radius='5', baseRadius='3', distance='2', center=['0','0','0'], compound=false, selfIntersect='F', reversed=false, faceSense=true }={}) {
  const plain = representabilitySphereStep({ radius, center, compound, reversed, faceSense });
  return plain.replace(/^#16=.*;$/m, `#16=OFFSET_SURFACE('',#27,${distance},.${selfIntersect}.);`).replace('ENDSEC;\nEND-ISO-10303-21;', `#27=SPHERICAL_SURFACE('',#15,${baseRadius});\nENDSEC;\nEND-ISO-10303-21;`);
}
export function offsetCircle({ points=[[1,0,0],[1,1,0],[0,1,0]], weights=[1,1,2], knots=[0,0,0,1,1,1], degree=2 }={}) {
  return { kind:'curve', id:'literal-circle', degree, knots, controlPoints:points, weights };
}
export function sphereSupport({ radius=1, distance=0, center=[0,0,0] }={}) {
  return { kind:'sphere', f:{o:center,x:[1,0,0],y:[0,1,0],z:[0,0,1]}, r:radius+distance, input:{origin:center,axis:[0,0,1],radius,distance} };
}
export function witnessPatch({ singular=false }={}) {
  const curve=[[1,0,0],[1,1,0],[0,1,0]], rows=singular?5:3;
  const points=Array.from({length:rows},(_,i)=>curve.map(p=>[p[0],p[1],singular&&i<3?0:i]));
  return { kind:'surface', id:'literal-cell', degreeU:2, degreeV:2, knotsU:singular?[0,0,0,.5,.5,1,1,1]:[0,0,0,1,1,1], knotsV:[0,0,0,1,1,1], controlPoints:points, weights:points.map(()=>[1,1,2]) };
}
