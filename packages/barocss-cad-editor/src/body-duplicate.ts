import type { CadDocumentV1 } from '@barocss/cad';

function copyId(stem: string, reserved: Set<string>): string {
  // Each suffix is distinct. At most reserved.size candidates can be occupied.
  for (let index = 0; index <= reserved.size; index++) {
    const suffix = index === 0 ? '_copy' : `_copy_${index}`;
    const id = stem.slice(0, 48 - suffix.length) + suffix;
    if (!reserved.has(id)) return id;
  }
  throw new RangeError('A new body or asset ID is unavailable.');
}

/** Copy the complete accepted source asset; native document admission stays in the session. */
export function duplicateBodySourceDocument(document: CadDocumentV1, bodyId: string,
  name: string | undefined, retainedDocuments: readonly CadDocumentV1[]): { document: CadDocumentV1; bodyId: string } {
  const originalBody = document.bodies.find(body => body.id === bodyId)!;
  const originalAsset = document.assets.find(asset => asset.id === originalBody.assetId)!;
  const reserved = new Set(retainedDocuments.flatMap(state => [
    ...state.assets.map(asset => asset.id), ...state.bodies.map(body => body.id),
  ]));
  for (const asset of document.assets) reserved.add(asset.id);
  for (const body of document.bodies) reserved.add(body.id);
  const assetId = copyId(originalAsset.id, reserved);
  reserved.add(assetId);
  const copiedBodyId = copyId(originalBody.id, reserved);
  return {
    document: {
      ...document,
      assets: [...document.assets, { ...originalAsset, id: assetId, revision: 0 }],
      bodies: [...document.bodies, { ...originalBody, id: copiedBodyId, assetId, name: name ?? originalBody.name }],
    },
    bodyId: copiedBodyId,
  };
}
