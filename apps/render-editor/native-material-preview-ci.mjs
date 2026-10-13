/** Actual NativeSceneHost material token lifecycle; CPU owned presenter, no WebGPU. */
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const app = dirname(fileURLToPath(import.meta.url)), workspace = resolve(app, '../..');
const output = await mkdtemp(join(app, 'node_modules', '.barocss-material-preview-'));
try {
  const outfile = join(output, 'flow.mjs');
  await build({stdin: {contents: `
import {createNativeSceneBase,createNativeSceneSeed} from './apps/render-editor/src/native-scene-seed';
import {createNativeSceneHost} from './apps/render-editor/src/native-scene-host';
export function run(source) {
  const material = {format:'barocss-render-editor-material',version:0,profile:'mesh-opaque-fragment-v0',documentId:'material-preview-ci',title:'Material',revision:0,
    shaderSource:'@shader #material_preview { @uniform amount: float(0, 1, .25); @fragment { color: mix(#ff0000, #0000ff, amount); } }',uniforms:{amount:.25}};
  const camera = {eye:[0,2.6,4],target:[0,-.55,0],up:[0,1,0],fovYDegrees:50,near:.01,far:100};
  const lighting = {ambientStrength:.4,directionalStrength:.6,direction:[.3,1,.4]};
  const original = createNativeSceneSeed(createNativeSceneBase(source,material,camera,lighting));
  const host = createNativeSceneHost(original);
  const views = [];
  let owner = {}, refuseNextRestore = false;
  try {
    host.setPresenter(prepared => {
      if (refuseNextRestore) {refuseNextRestore = false; throw Error('Atomic presenter refusal before pixel mutation');}
      views.push(prepared.authored.document); owner = {};
    },()=>owner,()=>host.getSnapshot().accepted.display.camera);
    host.restoreAccepted();
    const before = host.getSnapshot();
    const body = before.selectedBodyId, current = before.accepted.surfaceMaterials.find(item=>item.target.bodyId===body);
    if (!current) throw Error('Missing selected material');
    const firstUniform = current.material.uniforms.amount;
    host.materialSession.setDraftUniforms({...current.material.uniforms,amount:.6});
    const staged = host.getSnapshot();
    if (!staged.dirty || !staged.materialDirty) throw Error('Missing staged material');
    const token = host.beginMaterialPreview();
    if (views.at(-1).surfaceMaterials.find(item=>item.target.bodyId===body).material.uniforms.amount !== .6) throw Error('Preview did not display draft');
    if (host.getSnapshot().accepted !== before.accepted) throw Error('Preview committed authorship');
    host.cancelMaterialPreview(token);
    if (views.at(-1).surfaceMaterials.find(item=>item.target.bodyId===body).material.uniforms.amount !== firstUniform) throw Error('Cancel did not restore accepted');
    if (!host.getSnapshot().materialDirty || !host.getSnapshot().dirty) throw Error('Cancel cleared corrective text');
    let stale=false; try {host.cancelMaterialPreview(token);} catch {stale=true;} if (!stale) throw Error('Consumed token accepted');
    const applied = host.applyMaterialPreview(host.beginMaterialPreview());
    const accepted = host.getSnapshot();
    if (accepted.accepted.revision !== before.accepted.revision+1 || !accepted.canUndo) throw Error('Apply did not author exactly once');
    const appliedBinding = accepted.accepted.surfaceMaterials.find(item=>item.target.bodyId===body);
    if (appliedBinding.material.revision !== current.material.revision+1 || appliedBinding.material.uniforms.amount !== .6) throw Error('Material revision/value changed incorrectly');
    if (accepted.materialPreview || accepted.dirty || !applied) throw Error('Apply left draft/preview');
    host.materialSession.setDraftUniforms({...appliedBinding.material.uniforms, amount:.7});
    const beforeRefusal = host.getSnapshot(), refusedToken = host.beginMaterialPreview();
    const shown = views.at(-1);
    refuseNextRestore = true;
    let refused = false;
    try {host.cancelMaterialPreview(refusedToken);} catch (cause) {
      refused = String(cause).includes('Atomic presenter refusal');
    }
    if (!refused || views.at(-1) !== shown) throw Error('Atomic restore refusal must not publish a different frame');
    const pending = host.getSnapshot();
    if (!pending.materialPreview || pending.accepted !== beforeRefusal.accepted
      || !pending.materialDirty || pending.canUndo !== beforeRefusal.canUndo)
      throw Error('Restore refusal lost the original token or authored/draft state');
    host.cancelMaterialPreview(refusedToken);
    const recovered = host.getSnapshot();
    if (recovered.materialPreview || !recovered.materialDirty || recovered.accepted !== beforeRefusal.accepted
      || views.at(-1).surfaceMaterials.find(item=>item.target.bodyId===body).material.uniforms.amount !== .6)
      throw Error('Cancel retry failed to restore accepted frame and original draft');
    return {status:'PASS',presentations:views.length,bodyId:body,originalRevision:before.accepted.revision,appliedRevision:accepted.accepted.revision,
      materialRevision:appliedBinding.material.revision,assertions:['preview isolated','cancel restores pixels-owner candidate','draft preserved','stale token refused','apply single history entry','atomic presenter refusal preserves token','Cancel retry restores accepted presentation']};
  } finally {host.dispose();}
}
`,resolveDir:workspace,sourcefile:'material-preview-ci.ts'},outfile,absWorkingDir:workspace,bundle:true,platform:'node',format:'esm'});
  const source = await readFile(join(app,'public/reference-panel.barocad'),'utf8');
  const report = (await import(pathToFileURL(outfile).href)).run(source);
  assert.equal(report.status,'PASS');
  process.stdout.write(JSON.stringify({scope:'Native host CPU synchronous owned presenter; not actual GPU/physical files',...report})+'\n');
} finally {await rm(output,{recursive:true,force:true});}
