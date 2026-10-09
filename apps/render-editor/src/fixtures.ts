import type { RenderSceneDocumentV0 } from '@barocss/render-editor';

const camera = {
  eye: [0, 1.3, 8] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  up: [0, 1, 0] as [number, number, number],
  fovYDegrees: 45, near: 0.01, far: 100,
};

export const fixtureDocuments: readonly RenderSceneDocumentV0[] = [
  {
    format: 'barocss-render-editor', version: 0, kind: 'gpu-scene',
    documentId: 'forms', title: 'Primitive study', revision: 0, sourceVersion: 1, camera,
    sceneSource: `/* Primitive study: edit the original source, then Apply. */
@scene forms {
  version: 1;
  background: #161c22;
  sphere #orb;
  box #block;
  cylinder #post;
}
#orb {
  radius: .75;
  translate: -1.9 0 0;
  color: #72c8bb;
}
#block {
  size: 1.25 1.5 1.25;
  translate: 0 0 0;
  rotate-y: 28deg;
  color: #d0b990;
}
#post {
  radius: .48;
  height: 1.8;
  translate: 1.9 0 0;
  rotate-z: -12deg;
  color: #7e9fb6;
}
`,
  },
  {
    format: 'barocss-render-editor', version: 0, kind: 'gpu-scene',
    documentId: 'assembly', title: 'Ring assembly', revision: 0, sourceVersion: 1,
    camera: { ...camera, eye: [0, 3.6, 7.8] },
    sceneSource: `/* Ring assembly: independent scene IDs and view configuration. */
@scene assembly {
  version: 1;
  background: #161c22;
  torus #ring;
  capsule #strut;
  box #plinth;
}
#ring {
  major-radius: .85;
  minor-radius: .22;
  translate: -1.35 .5 0;
  rotate-x: 65deg;
  color: #83bcae;
}
#strut {
  radius: .24;
  start: 0 -.6 0;
  end: 0 .65 0;
  translate: 1.35 .45 0;
  rotate-z: -25deg;
  color: #c5a982;
}
#plinth {
  size: 4.7 .3 1.7;
  translate: 0 -.8 0;
  color: #637687;
}
`,
  },
];

export function createEmptyDocument(documentId: string): RenderSceneDocumentV0 {
  return {
    format: 'barocss-render-editor', version: 0, kind: 'gpu-scene', documentId,
    title: 'Untitled scene', revision: 0, sourceVersion: 1, camera,
    sceneSource: '@scene untitled {\n  version: 1;\n  background: #161c22;\n}\n',
  };
}
