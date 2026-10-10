import { buildQualifiedTranslatedStripBody, validateQualifiedTranslatedStripBody, QualifiedTranslatedStripBodyError } from '@barocss/cad';
import { deepStrictEqual, equal } from 'node:assert';

export function runCadBodyRequest(bytes) {
  if (bytes.length > 2097152) throw Error('Complete Body request exceeds2MiB');
  const text = new TextDecoder('utf8', { fatal: true }).decode(bytes);
  if (text.length > 2097152) throw Error('Complete Body request exceeds2Mi UTF16 units');
  const request = JSON.parse(text);
  if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).length !== 4 || !['base', 'ends', 'volume', 'options'].every(key => Object.hasOwn(request, key))) throw Error('Expected complete base/ends/volume/options request');
  let negativeZeroCount = 0;
  function count(value) {
    if (typeof value === 'number' && Object.is(value, -0)) negativeZeroCount++;
    else if (value && typeof value === 'object') for (const child of Object.values(value)) count(child);
  }
  const accepted = buildQualifiedTranslatedStripBody(request.base, request.ends, request.volume, request.options);
  const report = validateQualifiedTranslatedStripBody(accepted);
  // Traverse signed-zero values only after native own-data/depth admission succeeds.
  count(request);
  const before = structuredClone(accepted);
  const tampered = structuredClone(accepted);
  tampered.report.quality.genericBoolean = true;
  let refusal;
  try { validateQualifiedTranslatedStripBody(tampered); }
  catch (error) {
    if (!(error instanceof QualifiedTranslatedStripBodyError)) throw error;
    refusal = { code: error.code, message: error.message };
  }
  equal(refusal?.code, 'OWNED');
  deepStrictEqual(accepted, before);
  deepStrictEqual(validateQualifiedTranslatedStripBody(accepted), report);
  return {
    schema: report.schema, version: report.version,
    body: accepted.body,
    topology: { vertices: report.vertexCount, edges: report.edgeCount, faces: report.faceCount, uses: report.useCount, vertexLinks: report.vertexLinkCount, euler: report.eulerCharacteristic },
    modelObjectCounts: accepted.models.map(record => record.model.objects.length),
    geometryObjects: report.geometryObjectCount,
    volumeMM3: report.volumeMM3, exactVolumeMM3: report.exactVolumeMM3,
    lengthUnit: report.lengthUnit, volumeUnit: report.volumeUnit, sourceFrame: report.sourceFrame,
    quality: report.quality,
    inputNumericNegativeZeros: negativeZeroCount,
    refusedTamperedCopy: refusal, acceptedResultRetained: true,
    requestLimits: report.limits, drawing: 'not executed; compiled CPU Body API only',
  };
}
