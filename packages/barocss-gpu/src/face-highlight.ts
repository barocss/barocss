import {validatePreviewPacket} from './mesh-packet.js';
import type {PreviewPacket} from './mesh-packet.js';
import {sameMeshPacket} from './edge-overlay.js';
import {ownRecord,freezeGpuData} from './gpu-data.js';
export interface MeshFaceHighlight {version:0;packet:PreviewPacket;faceId:string;indexRange:[number,number];color:[number,number,number]}
function tuple(input:unknown,length:number):number[]{
 if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype||input.length!==length||Reflect.ownKeys(input).length!==length+1)throw new Error('Highlight requires dense owned tuples');
 return Array.from({length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(input,String(i));if(!d||!('value'in d)||!d.enumerable||typeof d.value!=='number'||!Number.isFinite(d.value))throw new Error('Highlight tuple requires finite own numbers');return d.value;});
}
/** A display-only range; the host resolves native face/Surface identity. */
export function prepareFaceHighlight(input:unknown,packet:PreviewPacket):MeshFaceHighlight|null{
 if(input===null)return null;const d=ownRecord(input,['version','packet','faceId','indexRange','color']);
 if(d.version!==0||typeof d.faceId!=='string'||!/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(d.faceId))throw new Error('Invalid highlight face identity/version');
 const owned=validatePreviewPacket(d.packet);if(!sameMeshPacket(owned,packet))throw new Error('Highlight packet does not match the complete accepted mesh');
 const range=tuple(d.indexRange,2),color=tuple(d.color,3);
 if(range.some(n=>!Number.isInteger(n)||n%3!==0)||range[0]<0||range[0]>=range[1]||range[1]>packet.indices.length)throw new Error('Highlight index range must contain whole accepted triangles');
 if(color.some(n=>n<0||n>1))throw new Error('Highlight RGB must be within 0 to 1');
 return freezeGpuData({version:0,packet:owned,faceId:d.faceId,indexRange:range as [number,number],color:color as [number,number,number]});
}
