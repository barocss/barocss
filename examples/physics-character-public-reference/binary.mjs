export function numbers(value,out=[]){if(typeof value==='number')out.push(value);else if(Array.isArray(value))for(const item of value)numbers(item,out);else if(value&&typeof value==='object')for(const key of Object.keys(value).sort())numbers(value[key],out);return out;}
export const inputRecords=first=>first.map(c=>({scene:c.scene,positionM:c.positionM,requestMps:c.requestMps}));
export const outputRecords=first=>first.map(c=>({states:c.states,error:c.error,retained:c.retained,rejected:c.rejected}));
export function encode(values){const bytes=new Uint8Array(values.length*8),view=new DataView(bytes.buffer);values.forEach((v,i)=>view.setFloat64(i*8,v,true));return bytes;}
export const hex=bytes=>Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
