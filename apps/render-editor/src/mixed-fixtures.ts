import type { RenderMixedDocumentV1 } from '@barocss/render-editor';

const camera = { eye: [0, 0, 6] as [number, number, number], target: [0, 0, 0] as [number, number, number],
  up: [0, 1, 0] as [number, number, number], fovYDegrees: 45, near: 0.01, far: 100 };

export const mixedFixtureDocuments: readonly RenderMixedDocumentV1[] = [
  {
    format: 'barocss-render-editor', version: 1, kind: 'mixed-depth',
    documentId: 'surface_study', title: 'Sphere and curved sheet', revision: 0,
    profile: 'sdf-sphere-native-surface-v0', sourceVersion: 1, camera,
    sceneSource: `/* Original source 1: one Sphere for this mixed profile. */
@scene surface_study { version: 1; background: #161c22; sphere #orb; }
#orb { radius: .75; color: #d6b37a; }
`,
    asset: {
      assetId: 'curved_sheet_asset', revision: 0, sourceVersion: 0,
      modelId: 'curved_sheet_model', surfaceId: 'sheet',
      source: `/* Complete original model. The Curve stays in the document. */
@model curved_sheet_model {
 version: 0; length-unit: mm;
 @surface #sheet {
  type: nurbs; degree-u: 2; degree-v: 2;
  knots-u: [0,0,0,1,1,1]; knots-v: [0,0,0,1,1,1];
  control-points: [[[-12,-9,8],[-12,0,8],[-12,9,8]],[[0,-9,8],[0,0,-3],[0,9,8]],[[12,-9,8],[12,0,8],[12,9,8]]];
  weights: [[1,1,1],[1,2.4,1],[1,1,1]];
 }
 @curve #boundary {
  type: nurbs; degree: 1; knots: [0,0,1,1];
  control-points: [[-12,-9,8],[12,-9,8]]; weights: [1,1];
 }
}
`,
    },
    display: { mmToSceneUnit: 0.1, translate: [0, 0, 0], color: [0.3, 0.7, 0.9], countU: 17, countV: 17 },
  },
  {
    format: 'barocss-render-editor', version: 1, kind: 'mixed-depth',
    documentId: 'rational_panel', title: 'Sphere and rational panel', revision: 0,
    profile: 'sdf-sphere-native-surface-v0', sourceVersion: 1, camera,
    sceneSource: `/* Original source 1 with a different ID and position. */
@scene rational_panel { version: 1; background: #161c22; sphere #ball; }
#ball { radius: .85; translate: -.4 .15 0; color: #72c8bb; }
`,
    asset: {
      assetId: 'rational_panel_asset', revision: 0, sourceVersion: 0,
      modelId: 'rational_panel_model', surfaceId: 'panel',
      source: `/* Unequal original rational weights are authored data. */
@model rational_panel_model {
 version: 0; length-unit: mm;
 @surface #panel {
  type: nurbs; degree-u: 1; degree-v: 1;
  knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
  control-points: [[[-10,-8,9],[-10,8,6]],[[10,-8,-4],[10,8,9]]];
  weights: [[1,2],[3,4]];
 }
 @curve #guide {
  type: nurbs; degree: 1; knots: [0,0,1,1];
  control-points: [[-10,-8,9],[10,-8,-4]]; weights: [1,2];
 }
}
`,
    },
    display: { mmToSceneUnit: 0.1, translate: [0.25, 0, 0], color: [0.69, 0.48, 0.3], countU: 13, countV: 13 },
  },
];

/** New starts from the named valid profile, including its complete native source. */
export function createNewMixedDocument(documentId: string): RenderMixedDocumentV1 {
  return { ...mixedFixtureDocuments[0], documentId, title: 'Untitled mixed scene', revision: 0,
    asset: { ...mixedFixtureDocuments[0].asset, assetId: `${documentId}_asset`, revision: 0 } };
}
