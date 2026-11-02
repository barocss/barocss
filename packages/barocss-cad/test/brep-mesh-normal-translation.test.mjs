import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cases=[
 ['original far tiny sphere completes at unchanged q8',{radius:.001,center:[999000,999000,999000]}],
 ['far tiny q1 normals retain radial direction',{radius:.001,center:[999000,999000,999000],q:1}],
 ['same tiny sphere near origin',{radius:.001}],
 ['ordinary centered sphere',{radius:5}],
 ['negative far coordinates',{radius:.001,center:[-999000,-999000,-999000]}],
 ['tilted far sphere',{radius:.001,center:[999000,999000,999000],tilted:true}],
 ['mirrored far sphere preserves outward normals',{radius:.001,center:[999000,999000,999000],mirror:true}],
 ['reversed seam far sphere',{radius:.001,center:[999000,999000,999000],reversed:true}],
 ['strong rational quadratic sheet at origin',{kind:'sheet'}],
 ['strong rational quadratic sheet far from origin',{kind:'sheet',center:[999000,999000,999000]}],
 ['multiplicity-two knot sheet at origin',{kind:'sheet',c0:true}],
 ['multiplicity-two knot sheet far from origin',{kind:'sheet',c0:true,center:[999000,999000,999000]}],
 ['wide cross-zero native coordinate extrema',{kind:'sheet',wide:true}],
 ['positive wide native axis remains unshifted',{kind:'sheet',wide:'positive'}],
 ['positive wide axis with shifted Z',{kind:'sheet',wide:'positive',center:[0,0,999000]}],
 ['wide axes with a shifted narrow Z axis',{kind:'sheet',wide:true,center:[0,0,999000]}],
];
for(const [name,options] of cases)test(name,()=>{
 const child=spawnSync(process.execPath,[fileURLToPath(new URL('./brep-mesh-normal-child.mjs',import.meta.url)),JSON.stringify(options)],{encoding:'utf8',timeout:20000});
 assert.equal(child.error,undefined,`bounded child failed: ${child.error}; ${child.stderr}`);assert.equal(child.status,0,child.stderr);process.stdout.write(child.stdout);
});
