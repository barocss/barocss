import { Canvas2DError, validateScene } from './schema.js';
import type { PathCommand, Point } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_SCENE', message); }
function limit(message: string): never { throw new Canvas2DError('SCENE_LIMIT', message); }
function copied(commands: readonly PathCommand[]): PathCommand[] {
  if (!Array.isArray(commands) || Object.getPrototypeOf(commands) !== Array.prototype) invalid('split commands need an ordinary array');
  const field = Object.getOwnPropertyDescriptor(commands, 'length');
  if (!field || !('value' in field) || !Number.isInteger(field.value)) invalid('split commands need a data length');
  if (field.value < 2 || field.value > 256) limit('split source needs 2..256 commands');
  const scene = validateScene({ version:29, unit:'logical-px', contextId:'PathSplit', nodes:[{
    kind:'path',id:'Source',layer:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},
    visible:true,alpha:1,hitMode:'auto',commands,
    stroke:{color:[0,0,0,1],width:1,cap:'butt',join:'bevel',dash:{lengths:[],offset:0},miterLimit:4},
  }] });
  const node=scene.nodes[0]; if(node.kind!=='path') invalid('split source must be a path');
  return node.commands;
}

/** Insert one authored same-degree segment boundary; do not tessellate or mutate input. */
export function splitPathSegment(commands: readonly PathCommand[], index: number, t: number): PathCommand[] {
  const source=copied(commands);
  if(typeof index!=='number'||!Number.isInteger(index)||Object.is(index,-0)||index<0||index>=source.length) invalid('split index is outside the source');
  if(typeof t!=='number'||!Number.isFinite(t)||Object.is(t,-0)||t<=0||t>=1) invalid('split parameter must be strictly between 0 and 1');
  const target=source[index];
  if(target.kind==='M'||target.kind==='Z') throw new Canvas2DError('UNSUPPORTED_FEATURE','only L/Q/C segments can be split');
  let current:Point={x:0,y:0},start=current;
  for(const command of source.slice(0,index)) {
    if(command.kind==='M'){current={x:command.x,y:command.y};start=current;}
    else if(command.kind==='Z') current=start;
    else current={x:command.x,y:command.y};
  }
  const end={x:target.x,y:target.y};
  const points=target.kind==='L'?[current,end]:target.kind==='Q'?[current,{x:target.cx,y:target.cy},end]:
    [current,{x:target.c1x,y:target.c1y},{x:target.c2x,y:target.c2y},end];
  const constant=(values:Point[])=>values.every(p=>p.x===values[0].x&&p.y===values[0].y);
  if(constant(points)) throw new Canvas2DError('UNSUPPORTED_FEATURE','constant segments have no new anchor');
  if(source.length===256) limit('split output exceeds 256 commands');
  function mix(a:Point,b:Point):Point {
    let x=(1-t)*a.x+t*b.x,y=(1-t)*a.y+t*b.y;
    if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e6||Math.abs(y)>1e6) limit('split coordinates exceed Scene range');
    if(Object.is(x,-0))x=0;if(Object.is(y,-0))y=0;return{x,y};
  }
  const levels=[points];
  while(levels[levels.length-1].length>1){const prior=levels[levels.length-1];levels.push(prior.slice(0,-1).map((p,i)=>mix(p,prior[i+1])));}
  const left=levels.map(level=>level[0]),right=levels.map(level=>level[level.length-1]).reverse();
  if(constant(left)||constant(right)) limit('split half collapses after Number rounding');
  function command(values:Point[]):PathCommand {
    const end=values[values.length-1];
    if(target.kind==='L')return{kind:'L',x:end.x,y:end.y};
    if(target.kind==='Q')return{kind:'Q',cx:values[1].x,cy:values[1].y,x:end.x,y:end.y};
    return{kind:'C',c1x:values[1].x,c1y:values[1].y,c2x:values[2].x,c2y:values[2].y,x:end.x,y:end.y};
  }
  try{return copied([...source.slice(0,index),command(left),command(right),...source.slice(index+1)]);}
  catch(error){if(error instanceof Canvas2DError)limit('split output is outside the admitted command grammar');throw error;}
}
