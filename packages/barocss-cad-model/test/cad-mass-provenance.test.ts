import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {evaluateCadPart,brepMassProperties,type CadPartDocument,type MassProperties} from '@barocss/cad';
const {controlledCadMass}=await import(resolve(import.meta.dirname,'helpers/cad-mass-provider.mjs')) as {
 controlledCadMass(t:unknown,o:{modelRoot:string;provider(output:unknown,density:number):MassProperties}):Promise<{massOf(output:unknown,density:number):{volume:number;mass:number;centroid:readonly number[];inertia:number[][];method?:string;volumeBasis?:{method:'tessellated';bound:number|null}}}>;
};
const{massTranslationSphereStep}=await import(resolve(import.meta.dirname,'../../barocss-cad/test/brep-mass-translation-fixtures.mjs')) as {massTranslationSphereStep(o:{radius:number;center:number[];compound:boolean}):string};
const doc:CadPartDocument={format:'barocss-cad-part',version:1,units:'mm',parameters:{},features:[{id:'sphere',kind:'import',step:massTranslationSphereStep({radius:4,center:[0,0,0],compound:false})}]};
const output=evaluateCadPart(doc).outputs[0];
for(const estimate of ['native','missing','zero'] as const)test(`CAD forced tessellated provider forwards ${estimate} volume estimate without changing units or density scaling`,async t=>{
 const native=new Map<number,MassProperties>();
 for(const density of [1,2.7,7.85]){
  const props=brepMassProperties(output.brep,density,{quadratureSegments:0});assert.equal(props.method,'tessellated');
  native.set(density,estimate==='native'?props:{...props,volumeBound:estimate==='zero'?0:undefined});
 }
 const api=await controlledCadMass(t,{modelRoot:resolve(import.meta.dirname,'..'),provider(actual,density){assert.equal(actual,output);return native.get(density)!;}});
 const expected=native.get(1)!,first=api.massOf(output,1),next=api.massOf(output,7.85);
 assert.equal(first.method,'tessellated');assert.deepEqual(first.volumeBasis,{method:'tessellated',bound:expected.volumeBound??null});
 assert.deepEqual(next.volumeBasis,first.volumeBasis);assert.equal(first.volume,next.volume);assert.deepEqual(first.centroid,next.centroid);
 assert.deepEqual(first.inertia,expected.inertia);assert.equal(first.mass,expected.mass);
 assert.ok(first.volumeBasis);first.volumeBasis.bound=999;
 assert.deepEqual(api.massOf(output,1).volumeBasis,{method:'tessellated',bound:expected.volumeBound??null});
 // These are real explicitly forced native mass results supplied at a controlled facade dependency seam.
 // This is not a claim that ordinary evaluation selected the tessellated fallback for this sphere.
});
