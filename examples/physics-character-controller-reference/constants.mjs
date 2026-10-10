export const DT=1/120,STEPS=240,GRAVITY=-9.81,SKIN=.002,SNAP=.02,STEP_HEIGHT=.1,PREVIEW=.152,STEP_DOWN=.12,ASSIST_CAP=20,SLIDE_CAP=4,QUERY_CAP=32;
export const WALKABLE=Math.cos(10*Math.PI/180);
export class MovementRefusal extends Error{constructor(code,message){super(message);this.name='MovementRefusal';this.code=code;}}
export const clone=value=>structuredClone(value);
export const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const scale=(a,f)=>a.map(v=>v*f);
export const norm=a=>Math.hypot(...a);
