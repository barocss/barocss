/** One bounded original-document source/emitted/declaration/cold qualifier.
 * No actual adapter, shader compilation, pixels or file-picker UI are claimed. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, statfs } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { root, loadModules, runPreparationChecks, runFacadeChecks, runControllerChecks, runSoftwarePlatformChecks, runDomChecks, signed } from '../../packages/barocss-viewer/tests/native-directional-light-webgpu.test.mjs';

assert.equal(Number(process.versions.node.split('.')[0]),22,'Use Node22');
const here=dirname(fileURLToPath(import.meta.url));
const evidence=process.env.BAROCSS_1580_EVIDENCE ?? await mkdtemp(resolve(tmpdir(),'barocss1580-qualify-'));
await mkdir(evidence,{recursive:true});
const disk=await statfs(root); assert.ok(disk.bavail*disk.bsize>=500*1024*1024,'Need fresh 500MiB free before the bounded fixture pass');
const hash=value=>createHash('sha256').update(signed(value)).digest('hex');
if(process.argv.includes('--cold')) {
  const file=process.argv[process.argv.indexOf('--cold')+1];
  const m=await loadModules('emitted',true,evidence);
  // The fresh process receives only the original composition file, never parent compiled caches.
  const original=await readFile(file,'utf8'), input=m.example.decodeComposition(original);
  const joined=m.candidate.prepareLightCandidate(input,1,null);
  const viewer=await m.viewer.createNativeDirectionalLightWebGPUViewer({},input,{width:16,height:8});
  assert.deepEqual(viewer.accepted.bindings,joined.accepted.bindings);viewer.dispose();
  await writeFile(resolve(evidence,'cold.json'),JSON.stringify({original:hash(input),request:hash(joined.gpuRequest),ten:hash(joined.accepted.bindings),owner:hash(input.owner),catalog:hash(input.lights)}));
  console.log('COLD ORIGINAL FILE: PASS');
} else {
  const receipt={base:'cf9e201cd6017b7deacd38c71f1fffc9b233c58a',softwareOnly:true,realDevice:'UNRUN externally owned',checks:{},evidence};
  let source;
  for(const mode of ['source','emitted']) {
    const m=await loadModules(mode,true,evidence), preparation=await runPreparationChecks(m);
    const facade=await runFacadeChecks(m), controller=await runControllerChecks(m);
    assert.deepEqual(Object.keys(m.viewer).sort(), ['VIEWER_POSE_LIMITS','Viewer','createViewer','prepareViewerNativeSceneAppearance',
      'createNativeDirectionalLightWebGPUViewer','ViewerNativeDirectionalLightError'].sort());
    const graph=JSON.parse(await readFile(resolve(evidence,`${mode}-mock-graph.json`),'utf8'));
    const inputs=Object.keys(graph.inputs);
    assert.ok(inputs.some(path=>path.includes(`barocss-viewer/${mode==='source'?'src':'dist'}/native-directional-light-webgpu.`)));
    if(mode==='emitted') assert.equal(inputs.some(path=>/packages\/barocss-(cad|cad-interop|gpu|viewer)\/src\//.test(path)),false,'Emitted path may not fall through source providers');
    receipt.checks[mode]={preparation:preparation.providerCounts,visibleSubset:preparation.subsetCounts,facadeCalls:facade.calls,
      request:hash(preparation.expected),original:hash(preparation.input),controllerSecondSaveBytes:Buffer.byteLength(controller.second)};
    if(mode==='source')source=preparation;
    else {assert.equal(hash(preparation.expected),hash(source.expected));assert.equal(hash(preparation.input),hash(source.input));}
  }
  receipt.checks.dom=await runDomChecks(await loadModules('source',true,evidence));
  // The real GPU runtime and all CPU providers, on the explicit test-only software platform.
  receipt.checks.softwarePlatform=await runSoftwarePlatformChecks(await loadModules('emitted',false,evidence));
  const declaration=await readFile(resolve(root,'packages/barocss-viewer/dist/index.d.ts'),'utf8');
  const additions=declaration.slice(declaration.indexOf('export { createNativeDirectionalLightWebGPUViewer'));
  const typeNames=['ViewerNativeDirectionalLightCode','ViewerNativeDirectionalLightOwner','ViewerNativeDirectionalLightInput',
    'ViewerNativeDirectionalLightAccepted','ViewerNativeDirectionalLightPick','ViewerNativeDirectionalLightWebGPU'];
  const typeClauses=[...additions.matchAll(/export type \{([^}]+)\}/g)].flatMap(match=>match[1].split(',').map(name=>name.trim()));
  assert.deepEqual(typeClauses.sort(),typeNames.sort());
  assert.equal(/prepareLightCandidate|copyOwn|LightCandidate/.test(declaration),false);
  const consumer=resolve(evidence,'public-consumer.ts');
  await writeFile(consumer,`import {createNativeDirectionalLightWebGPUViewer, ViewerNativeDirectionalLightError} from ${JSON.stringify(resolve(root,'packages/barocss-viewer/dist/index.js'))};
import type {${typeNames.join(',')}} from ${JSON.stringify(resolve(root,'packages/barocss-viewer/dist/index.js'))};
import type {NativeDirectionalLightWebGPUOptions} from ${JSON.stringify(resolve(root,'packages/barocss-gpu/dist/index.js'))};
declare const canvas:HTMLCanvasElement, input:ViewerNativeDirectionalLightInput, options:NativeDirectionalLightWebGPUOptions;
const promise:Promise<ViewerNativeDirectionalLightWebGPU>=createNativeDirectionalLightWebGPUViewer(canvas,input,options);
const code:ViewerNativeDirectionalLightCode='OWNER'; const error=new ViewerNativeDirectionalLightError(code,'owner');
const owner:ViewerNativeDirectionalLightOwner=input.owner;
async function read(){const viewer=await promise; const accepted:ViewerNativeDirectionalLightAccepted=viewer.accepted; const pick:ViewerNativeDirectionalLightPick=await viewer.pick(0,0); return [accepted,pick,error,owner];} void read;
// @ts-expect-error no runtime diagnostic enumeration or private preparation export
import {prepareLightCandidate} from ${JSON.stringify(resolve(root,'packages/barocss-viewer/dist/index.js'))};
// @ts-expect-error type-only diagnostic union has no runtime value
void ViewerNativeDirectionalLightCode;
// @ts-expect-error old singleton lighting is not a new wrapper field
input.lighting={ambientStrength:1};
// @ts-expect-error runtime diagnostic vocabulary is fixed
const wrong:ViewerNativeDirectionalLightCode='RENDER'; void wrong;
`);
  const config=resolve(evidence,'tsconfig.json');
  await writeFile(config,JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',strict:true,noEmit:true,skipLibCheck:true,lib:['ES2022','DOM'],baseUrl:root,
    paths:{'@barocss/cad':['packages/barocss-cad/dist/index.d.ts'],'@barocss/gpu':['packages/barocss-gpu/dist/index.d.ts'],'@barocss/cad-interop/*':['packages/barocss-cad-interop/dist/*.d.ts']}},files:[consumer]}));
  try {const output=execFileSync(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'-p',config,'--listFiles'],{timeout:180000,encoding:'utf8',env:{...process.env,NODE_OPTIONS:'--max-old-space-size=2048'}});await writeFile(resolve(evidence,'public-types.log'),output);}
  catch(error){await writeFile(resolve(evidence,'public-types.log'),String(error.stdout)+String(error.stderr));throw error;}
  receipt.checks.publicDeclarations='PASS: two runtime and six type-only additions';
  const file=resolve(evidence,'accepted-original.json');await writeFile(file,source.saved);
  const output=execFileSync(process.execPath,[resolve(here,'qualify.mjs'),'--cold',file],{timeout:180000,encoding:'utf8',env:{...process.env,BAROCSS_1580_EVIDENCE:evidence,NODE_OPTIONS:'--max-old-space-size=2048'}});
  await writeFile(resolve(evidence,'cold.log'),output);const cold=JSON.parse(await readFile(resolve(evidence,'cold.json'),'utf8'));
  assert.equal(cold.original,hash(source.input));assert.equal(cold.request,hash(source.expected));
  const m=await loadModules('source',true);const joined=m.candidate.prepareLightCandidate(source.input,1,null);
  assert.equal(cold.ten,hash(joined.accepted.bindings));assert.equal(cold.owner,hash(source.input.owner));assert.equal(cold.catalog,hash(source.input.lights));
  receipt.checks.cold=cold;
  await writeFile(resolve(evidence,'receipt.json'),JSON.stringify(receipt,null,2));
  console.log(JSON.stringify({result:'SOFTWARE COMPLETE',evidence,checks:Object.keys(receipt.checks),realDevice:'UNRUN externally owned'}));
}
