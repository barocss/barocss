import {ArchiveError} from './archive.mjs';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function compareMeasurement(measured,reference){
 if(!reference||reference.ok!==true||reference.resolved!==true)return {agree:false,resolved:false,referenceFailure:reference??null};
 const scalar=['relativeAngleRad','anchorGapM','axisDeviationRad','limitExcessRad','reportedAngleDifferenceRad'];
 const deltas={};let numericValid=finite(reference.precisionMaxDifference)&&reference.precisionMaxDifference<=1e-25;
 for(const key of scalar){numericValid&&=finite(measured?.[key])&&finite(reference.raw?.[key])&&finite(reference.normalized?.[key]);deltas[key]=finite(measured?.[key])&&finite(reference.raw?.[key])?Math.abs(measured[key]-reference.raw[key]):null;}
 for(const key of ['anchorAM','anchorBM']){const a=measured?.[key],b=reference.raw?.[key];const valid=Array.isArray(a)&&a.length===3&&a.every(finite)&&Array.isArray(b)&&b.length===3&&b.every(finite);numericValid&&=valid;deltas[key]=valid?Math.max(...a.map((v,i)=>Math.abs(v-b[i]))):null;}
 return {agree:numericValid&&Object.values(deltas).every(v=>finite(v)&&v<=1e-12),resolved:true,numericValid,deltas};
}
export function requireReference(reference,context){if(!reference||reference.ok!==true||reference.resolved!==true){const error=new Error(`Independent reference execution failed: ${context}`);error.name='ReferenceExecutionError';error.code='REFERENCE_EXECUTION';error.reference=reference;throw error;}return reference;}
export function originalResiduals(measured,reported){if(!finite(reported)||!finite(measured.relativeAngleRad))throw new ArchiveError('diagnostic angle must be finite');return {reportedAngleRad:reported,reportedAngleDifferenceRad:measured.relativeAngleRad-reported,limitExcessRad:Math.max(0,-.8-measured.relativeAngleRad,measured.relativeAngleRad-.8),originalGatePassed:Math.abs(measured.relativeAngleRad-reported)<=1e-9&&Math.abs(measured.relativeAngleRad)<=.8+1e-9};}
