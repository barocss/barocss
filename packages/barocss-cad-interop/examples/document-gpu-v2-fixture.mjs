import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeCadDocument } from '@barocss/cad';

export const source = `@model authored_part {
  version: 0;
  length-unit: mm;
  @curve #guide_path_native {
    type: nurbs;
    degree: 2;
    knots: [-3,-3,-3,1,1,7,7,7];
    control-points: [[-2,-0,-0],[0,3,1],[3,0,2],[5,-2,4],[6,1,5]];
    weights: [1,2,0.75,1.5,1];
  }
  @surface #support_patch_native {
    type: nurbs;
    degree-u: 1;
    degree-v: 1;
    knots-u: [-2,-2,5,5];
    knots-v: [-0,-0,3,3];
    control-points: [[[-0,-0,-0],[0,3,1]],[[4,-0,2],[4,3,3]]];
    weights: [[1,1.25],[0.75,1.5]];
  }
  @curve #skip_path_native {
    type: nurbs;
    degree: 1;
    knots: [0,0,1,1];
    control-points: [[-2,5,0],[6,5,0]];
    weights: [1,1];
  }
}
`;
const frame = 'authored-xyz-no-axis-conversion';
const assetIds = ['asset-a', 'asset_b'];
export const document = {
  schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
  documentId: 'document_gpu_v2', revision: 5,
  units: { length: 'mm', angle: 'rad' }, nativeFrame: frame,
  assets: assetIds.map((id, index) => ({ id, revision: index ? 7 : 2,
    role: 'authored-native-source', sourceVersion: 0, sourceFrame: frame, source })),
  bodies: assetIds.flatMap((assetId, index) => [
    { id: `body_${index}_curve`, name: `Guide ${index}`, kind: 'direct-geometry-object',
      assetId, geometryId: 'guide_path_native' },
    { id: `body_${index}_surface`, name: `Patch ${index}`, kind: 'direct-geometry-object',
      assetId, geometryId: 'support_patch_native' },
    { id: `body_${index}_skip`, name: `Extra ${index}`, kind: 'direct-geometry-object',
      assetId, geometryId: 'skip_path_native' },
  ]),
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: [],
};

export const fixtureText = serializeCadDocument(document);
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(new URL('document-gpu-v2.cad-document.json', import.meta.url), fixtureText);
  console.log(JSON.stringify({ bytes: Buffer.byteLength(fixtureText),
    assets: document.assets.length, bodies: document.bodies.length }));
}
