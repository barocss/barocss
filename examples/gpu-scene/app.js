import { mountScene } from '/gpu.js';

let canvas = document.querySelector('#scene');
const source = document.querySelector('#source');
const status = document.querySelector('#status');
const example = document.querySelector('#scene-example');
const version = document.querySelector('#source-version');
const initial = source.value;
const torus = '@scene ring { version:1; torus #ring; }\n#ring { major-radius:1; minor-radius:.25; color:#7cd8ca; }';
const front = {eye:[0,0,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100};
const above = {...front,eye:[0,6,0],up:[0,0,-1]};
let renderer, acceptedVersion;
function apply() {
  const nextVersion = Number(version.value);
  if (renderer && acceptedVersion === nextVersion) {
    const result = renderer.update(source.value);
    status.textContent = result.ok ? 'Scene accepted.' : String(result.error);
    return;
  }
  // The renderer's source-version contract is fixed. Stage a new view before adoption.
  const candidate = canvas.cloneNode(false);
  let next;
  try {
    next = mountScene(candidate, source.value, example.value === 'torus' ? above : front,
      nextVersion === 1 ? {sourceVersion:1} : undefined);
    const oldRenderer = renderer, oldCanvas = canvas;
    canvas.replaceWith(candidate); canvas = candidate; renderer = next; acceptedVersion = nextVersion;
    oldRenderer?.dispose(); oldCanvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    status.textContent = 'Scene accepted.';
  } catch (error) {
    next?.dispose(); candidate.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    status.textContent = String(error);
  }
}
example.addEventListener('change', () => {
  source.value = example.value === 'torus' ? torus : initial;
  version.value = example.value === 'torus' ? '1' : '0';
  status.textContent = 'Example staged. Apply scene to render it.';
});
document.querySelector('#apply').addEventListener('click', apply);
document.querySelector('#reset').addEventListener('click', () => {
  example.value='baseline'; version.value='0'; source.value=initial; apply();
});
window.sceneExample = {get renderer(){return renderer;},get sourceVersion(){return acceptedVersion;}};
window.addEventListener('pagehide', () => renderer?.dispose(), {once:true});
apply();
