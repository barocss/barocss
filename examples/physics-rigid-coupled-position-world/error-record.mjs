/** Diagnostic metadata never changes a thrown value or makes a physical decision. */
export function describeThrown(value) {
  try { if(value instanceof Error)return {name:value.name,message:value.message,stack:value.stack}; }
  catch { return {name:'ThrownValue',message:'Error metadata is unavailable'}; }
  return {name:'ThrownValue',message:'Unexpected non-Error exception'};
}
