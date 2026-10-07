import type {PreviewPacket} from './mesh-packet.js';
import {prepareFaceHighlight} from './face-highlight.js';
import {ownRecord,freezeGpuData} from './gpu-data.js';

/** Display object identity and its complete accepted triangle range, resolved by the host. */
export interface MeshObjectHighlight {
 version:0; packet:PreviewPacket; objectId:string; indexRange:[number,number]; color:[number,number,number];
}
export function prepareObjectHighlight(input:unknown,packet:PreviewPacket):MeshObjectHighlight|null {
 if(input===null)return null;
 const data=ownRecord(input,['version','packet','objectId','indexRange','color']);
 // Reuse the strict packet/range/color admission; object identity remains separate from native faces.
 const range=prepareFaceHighlight({version:data.version,packet:data.packet,faceId:data.objectId,indexRange:data.indexRange,color:data.color},packet)!;
 return freezeGpuData({version:0,packet:range.packet,objectId:range.faceId,indexRange:range.indexRange,color:range.color});
}
