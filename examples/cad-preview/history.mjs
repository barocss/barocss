import {parseProject,serializeProject} from './project.mjs';
export const historyLimits=Object.freeze({states:20,bytes:8*1024*1024});
// Only bounded serialized document data is retained, never renderer/native handles.
export function createProjectHistory(gpu){
 const prepared=new WeakSet();let entries=[],cursor=-1,total=0;
 return{
  prepare(record){const text=serializeProject(record,gpu),entry=Object.freeze({text,bytes:new TextEncoder().encode(text).length});prepared.add(entry);return entry;},
  commit(entry){
   if(!prepared.has(entry))throw new TypeError('History requires an owned prepared project');
   prepared.delete(entry);
   const next=[...entries.slice(0,cursor+1),entry];let bytes=next.reduce((sum,item)=>sum+item.bytes,0);
   while(next.length>historyLimits.states||bytes>historyLimits.bytes)bytes-=next.shift().bytes;
   entries=next;total=bytes;cursor=entries.length-1;
  },
  target(direction){
   if(direction!==-1&&direction!==1)throw new RangeError('Choose an adjacent history state');
   const index=cursor+direction;if(index<0||index>=entries.length)throw new RangeError(direction<0?'No retained earlier model':'No retained later model');
   return{cursor:index,record:parseProject(entries[index].text,gpu)};
  },
  move(index){if(!Number.isInteger(index)||index<0||index>=entries.length)throw new RangeError('Invalid history cursor');cursor=index;},
  state(available=true){return{count:entries.length,cursor,undoCount:Math.max(0,cursor),redoCount:Math.max(0,entries.length-cursor-1),bytes:total,canUndo:available&&cursor>0,canRedo:available&&cursor>=0&&cursor<entries.length-1,maxStates:historyLimits.states,maxBytes:historyLimits.bytes};},
 };
}
