import { parseBaroCadDocument } from '@barocss/cad-interop/document';

const FILE_LIMIT = 2 * 1024 * 1024;
const BODY_ID = /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/;

/** Parse with the public CAD reader and keep its complete source-backed result. */
export function parseDocument(text, label = 'CAD document') {
  if (typeof text !== 'string') throw new TypeError('CAD document text is required.');
  if (text.length > FILE_LIMIT || new TextEncoder().encode(text).length > FILE_LIMIT)
    throw new RangeError('Choose a CAD document of 2 MiB or less.');
  const result = parseBaroCadDocument(text);
  const { document, compiledAssets, bodyBindings } = result;
  const catalog = document.bodies.map(body => {
    const asset = document.assets.find(value => value.id === body.assetId);
    const compiled = compiledAssets.find(value => value.assetId === body.assetId);
    const binding = bodyBindings.find(value => value.bodyId === body.id);
    const geometry = compiled?.model.objects.find(value => value.id === body.geometryId);
    const kind = binding?.geometryKind ?? geometry?.kind ?? body.kind;
    let reason = '';
    if (document.units.length !== 'mm' || document.units.angle !== 'rad')
      reason = 'This Viewer requires millimetres and radians.';
    else if (body.kind !== 'direct-geometry-object' || !['surface', 'curve'].includes(kind))
      reason = 'This Viewer supports direct native Surfaces and Curves.';
    else if (!asset || !compiled || !binding || !geometry || binding.assetId !== body.assetId ||
        binding.geometryId !== body.geometryId || geometry.kind !== kind)
      reason = 'The source geometry binding is incomplete.';
    else if (document.nativeFrame !== 'authored-xyz-no-axis-conversion' ||
        asset.sourceFrame !== 'authored-xyz-no-axis-conversion')
      reason = 'This Viewer requires the authored XYZ frame.';
    else if (compiled.model.objects.filter(value => ['surface', 'curve'].includes(value.kind)).length > 4)
      reason = 'The source asset exceeds the current 4 native object limit.';
    return {
      id: body.id, name: body.name, kind, geometryId: body.geometryId,
      assetId: body.assetId, assetRevision: asset?.revision ?? null,
      supported: reason === '', reason,
    };
  });
  const used = new Set();
  const defaultBodyIds = [];
  for (const entry of catalog) {
    const identity = JSON.stringify([entry.assetId, entry.kind, entry.geometryId]);
    if (!entry.supported || used.has(identity)) continue;
    used.add(identity);
    defaultBodyIds.push(entry.id);
    if (defaultBodyIds.length === 2) break;
  }
  return { result, id: document.documentId, revision: document.revision,
    label: typeof label === 'string' && label.trim() ? label : 'CAD document',
    catalog, defaultBodyIds };
}

/** Read a local file without replacing the currently accepted scene. */
export async function readDocument(file) {
  if (!file || typeof file.text !== 'function' || !Number.isSafeInteger(file.size) || file.size < 0)
    throw new TypeError('Choose a CAD document file.');
  if (file.size > FILE_LIMIT) throw new RangeError('Choose a CAD document of 2 MiB or less.');
  return parseDocument(await file.text(), file.name);
}

/** The existing public SDK profile; it performs the final display admission. */
export function loadOptions(bodyIds) {
  if (!Array.isArray(bodyIds) || bodyIds.length < 1 || bodyIds.length > 4 ||
      Array.from(bodyIds).some(id => typeof id !== 'string' || !BODY_ID.test(id)) ||
      new Set(bodyIds).size !== bodyIds.length)
    throw new RangeError('Choose 1 to 4 distinct supported bodies.');
  return {
    native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 1,
      curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
    basis: 'authored-xyz-matches-rhyup', bodyIds: [...bodyIds],
  };
}
