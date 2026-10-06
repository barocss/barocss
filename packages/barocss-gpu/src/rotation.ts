import type {Vec3} from './scene-types.js';
/** Column-major local-from-world matrix; accepted angles only, no authored GLSL. */
export function inverseRotation(degrees:Vec3):number[]{
 if(degrees.length!==3||degrees.some(n=>!Number.isFinite(n)||Math.abs(n)>360))throw new Error('Invalid rotation degrees');
 const [x,y,z]=degrees.map(n=>n*Math.PI/180),cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
 // These are the rows of R, stored as columns of transpose(R).
 return [cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx,
         sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx,
         -sy,cy*sx,cy*cx];
}
