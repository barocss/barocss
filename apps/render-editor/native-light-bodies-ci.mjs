/** CPU-only Native Light body bridge admission. No browser or GPU pixels. */
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const app = dirname(fileURLToPath(import.meta.url)), root = resolve(app, '../..');
const tmp = await mkdtemp(join(app, 'node_modules', '.barocss-light-bodies-'));
try {
  const outfile = join(tmp, 'test.mjs');
  await build({stdin: {contents: `
import {createNativeSceneBase, createNativeSceneSeed} from './src/native-scene-seed.ts';
import {deriveNativeLightBodyDuplicate, deriveNativeLightBodyRemoval} from './src/native-light-bodies.ts';
import {prepareRenderNativeLightDocument, upgradeRenderNativeSceneToDirectionalLights} from '@barocss/render-editor';
export function run(source) {
 const material = {format:'barocss-render-editor-material',version:0,profile:'mesh-opaque-fragment-v0',documentId:'light-body-test',title:'Material',revision:0,shaderSource:'@shader #test { @fragment { color: #ffffff; } }',uniforms:{}};
 const camera = {eye:[0,2.6,4],target:[0,-.55,0],up:[0,1,0],fovYDegrees:50,near:.01,far:100};
 const base = createNativeSceneSeed(createNativeSceneBase(source,material,camera,{ambientStrength:.2,directionalStrength:.7,direction:[1,1,1]}));
 const original = prepareRenderNativeLightDocument({...upgradeRenderNativeSceneToDirectionalLights(base),version:2,profile:'canonical-native-lights'}).document;
 const before = original.nativeOptions.bodyIds;
 const copied = deriveNativeLightBodyDuplicate(original, before[0]);
 if (copied.document.nativeDocument.bodies.length !== original.nativeDocument.bodies.length + 1) throw Error('Missing native duplicate');
 if (copied.document.revision !== original.revision || copied.document.lights !== original.lights) {
   // Providers own copies: verify semantic catalog equality independently below.
   if (copied.document.revision !== original.revision || JSON.stringify(copied.document.lights) !== JSON.stringify(original.lights)) throw Error('Authored light authority mutated');
 }
 const removed = deriveNativeLightBodyRemoval(copied.document,copied.bodyId);
 if (removed.nativeDocument.bodies.length !== original.nativeDocument.bodies.length) throw Error('Remove failed');
 if (JSON.stringify(removed.lights) !== JSON.stringify(original.lights)) throw Error('Catalog changed on removal');
 if (original.nativeOptions.bodyIds.length !== before.length) throw Error('Input mutated');
 return {original: before.length,duplicate: copied.bodyId,after: removed.nativeDocument.bodies.length};
}
`, resolveDir:app, sourcefile:'native-light-bodies-test.ts'}, absWorkingDir:root,
    outfile,bundle:true,platform:'node',format:'esm'});
  const src = await readFile(join(app, 'public/reference-panel.barocad'),'utf8');
  const result = (await import(pathToFileURL(outfile).href)).run(src);
  assert.ok(result.duplicate);
  process.stdout.write(JSON.stringify({status:'PASS',scope:'Native Light body bridge CPU only',...result})+'\\n');
} finally {await rm(tmp,{recursive:true,force:true});}
