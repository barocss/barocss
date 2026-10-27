import { createCadDocument, importIGES, validateIGESImport } from '@barocss/cad';
import { parseDocument } from './document.js';

const IGES_LIMIT = 1024 * 1024;

/** Import only the CAD writer-compatible IGES 5.3 geometry profile. */
export async function readIgesSource(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isSafeInteger(file.size) || file.size < 0)
    throw new TypeError('Choose an IGES file.');
  if (file.size > IGES_LIMIT) throw new RangeError('Choose an IGES file of 1 MiB or less.');
  const buffer = await file.arrayBuffer();
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== file.size || buffer.byteLength > IGES_LIMIT)
    throw new RangeError('The IGES file bytes do not match its declared size.');
  const bytes = new Uint8Array(buffer);
  if (bytes.some(value => value > 0x7f)) throw new RangeError('IGES input must be ASCII.');
  const hash = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)),
    value => value.toString(16).padStart(2, '0')).join('');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const documentId = `iges_${hash.slice(0, 32)}`;
  const imported = importIGES(text, { sourceId: documentId, modelName: 'iges_model', idPrefix: 'iges',
    maximumEntities: 16, maximumRecords: 8192 });
  validateIGESImport(imported);
  const mappings = imported.entities.map(entity => ({ directoryPointer: entity.directoryPointer,
    nativeId: entity.nativeId, bodyId: `iges_body_d${entity.directoryPointer}` }));
  const document = createCadDocument({ schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
    documentId, revision: 0, units: { length: 'mm', angle: 'rad' },
    nativeFrame: 'authored-xyz-no-axis-conversion',
    assets: [{ id: 'iges_asset', revision: 0, role: 'authored-native-source', sourceVersion: 0,
      sourceFrame: 'authored-xyz-no-axis-conversion', source: imported.source }],
    bodies: mappings.map(value => ({ id: value.bodyId, name: `IGES D${value.directoryPointer}`,
      kind: 'direct-geometry-object', assetId: 'iges_asset', geometryId: value.nativeId })),
    features: [], parameters: [], constraints: [], placements: [], derivedCaches: [] });
  const parsed = parseDocument(JSON.stringify(document.document), file.name);
  return { ...parsed, kind: 'document', source: parsed.result.document,
    origin: { format: 'iges-5.3-126-128', sourceSHA256: hash, mappings } };
}
