import {
  parseCadDocument, validateAdaptiveCurveSamples, validateCadDocumentResult,
  validateWideAdaptiveCurveSamples,
} from '@barocss/cad';
import type { AdaptiveCurveSamplingResult, CadDocumentResult, WideAdaptiveCurveSamplingResult } from '@barocss/cad';
import { parseBaroCadSource, validateBaroCadParseOptions } from './native.js';
import type { BaroCadParseOptions } from './native.js';
import { copyCadPreviewPacket } from './packet.js';
import type { CadPreviewPacket } from './packet.js';
import {
  readAbortableBaroCadDocument, throwIfBaroCadAborted, validateBaroCadTransport,
} from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';

export type { CadDocumentResult } from '@barocss/cad';
export type { BaroCadLoadProgress, BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadDocumentPrimitiveOptionsV2 {
  native: BaroCadParseOptions;
  /** Host assertion: the authored XYZ frame matches this right-handed Y-up GPU target. */
  basis: 'authored-xyz-matches-rhyup';
  /** Required when the document has more than four bodies. */
  bodyIds?: string[];
}

export interface BaroCadDocumentPrimitiveBindingV2 {
  readonly documentId: string;
  readonly documentRevision: number;
  readonly nativeFrame: 'authored-xyz-no-axis-conversion';
  readonly bodyId: string;
  readonly assetId: string;
  readonly assetRevision: number;
  readonly sourceFrame: 'authored-xyz-no-axis-conversion';
  readonly modelId: string;
  readonly geometryKind: 'curve' | 'surface';
  readonly geometryId: string;
}

export interface BaroCadDocumentPrimitiveRefV2 {
  /** Caller-scoped display namespace derived injectively from the asset ID. */
  readonly modelId: string;
  /** Original native Curve or Surface ID. */
  readonly geometryId: string;
}

export type BaroCadDocumentPrimitiveEntryV2 =
  | { readonly kind: 'surface'; readonly packet: CadPreviewPacket;
      readonly ref: BaroCadDocumentPrimitiveRefV2;
      readonly binding: BaroCadDocumentPrimitiveBindingV2 }
  | { readonly kind: 'curve'; readonly sampleVersion: 0;
      readonly sample: AdaptiveCurveSamplingResult;
      readonly basis: 'authored-xyz-matches-rhyup';
      readonly ref: BaroCadDocumentPrimitiveRefV2;
      readonly binding: BaroCadDocumentPrimitiveBindingV2 }
  | { readonly kind: 'curve'; readonly sampleVersion: 1;
      readonly sample: WideAdaptiveCurveSamplingResult;
      readonly basis: 'authored-xyz-matches-rhyup';
      readonly ref: BaroCadDocumentPrimitiveRefV2;
      readonly binding: BaroCadDocumentPrimitiveBindingV2 };

function ownOptions(input: unknown): { native: BaroCadParseOptions;
  basis: 'authored-xyz-matches-rhyup'; bodyIds?: string[] } {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Document display options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  if (keys.length < 2 || keys.length > 3 || keys.some(key => typeof key !== 'string' ||
      !['native', 'basis', 'bodyIds'].includes(key))) {
    throw new TypeError('Document display options require native, basis and optional bodyIds only');
  }
  const fields = Object.getOwnPropertyDescriptors(input);
  for (const key of keys as string[]) {
    if (!fields[key].enumerable || !('value' in fields[key])) {
      throw new TypeError(`Document display option ${key} must be own data`);
    }
  }
  if (!fields.native || !fields.basis || fields.basis.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Host must explicitly assert the authored XYZ right-handed Y-up basis');
  }
  const native = validateBaroCadParseOptions(fields.native.value);
  let bodyIds: string[] | undefined;
  if (fields.bodyIds) {
    const value: unknown = fields.bodyIds.value;
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
        value.length < 1 || value.length > 4 || Reflect.ownKeys(value).length !== value.length + 1) {
      throw new RangeError('Selected bodyIds must be a dense own array of 1..4 IDs');
    }
    bodyIds = Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !('value' in descriptor) ||
          typeof descriptor.value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(descriptor.value)) {
        throw new TypeError('Selected bodyId must be own ASCII data');
      }
      return descriptor.value;
    });
    if (new Set(bodyIds).size !== bodyIds.length) throw new RangeError('Selected bodyIds must be unique');
  }
  return { native, basis: fields.basis.value, bodyIds };
}

/** Project selected authoritative document bodies into owned native-ID GPU v2 inputs. */
export function prepareBaroCadDocumentPrimitiveNativeRefsV2(
  result: CadDocumentResult, options: BaroCadDocumentPrimitiveOptionsV2,
): ReadonlyArray<BaroCadDocumentPrimitiveEntryV2> {
  validateCadDocumentResult(result);
  // The CAD validator rejects accessors. Cloning then rejects Proxy wrappers
  // and holds one stable candidate while previews are derived.
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const { document, compiledAssets, bodyBindings } = owned;
  if (!request.bodyIds && document.bodies.length > 4) {
    throw new RangeError('Documents with more than four bodies require explicit bodyIds');
  }
  const selected = request.bodyIds ?? document.bodies.map(body => body.id);
  const wanted = new Set(selected);
  if (selected.some(id => !document.bodies.some(body => body.id === id))) {
    throw new RangeError('Selected bodyId does not exist in the document');
  }
  const previews = new Map<string, ReturnType<typeof parseBaroCadSource>>();
  const output: BaroCadDocumentPrimitiveEntryV2[] = [];
  for (const body of document.bodies) {
    if (!wanted.has(body.id)) continue;
    const binding = bodyBindings.find(value => value.bodyId === body.id);
    const asset = document.assets.find(value => value.id === body.assetId);
    const compiled = compiledAssets.find(value => value.assetId === body.assetId);
    if (!binding || !asset || !compiled || compiled.source !== asset.source ||
        binding.assetId !== body.assetId || binding.geometryId !== body.geometryId) {
      throw new RangeError('Document body binding differs from authoritative source');
    }
    let preview = previews.get(asset.id);
    if (!preview) {
      preview = parseBaroCadSource(asset.source, request.native);
      if (preview.source !== asset.source || preview.model.name !== compiled.model.name) {
        throw new RangeError('Document preview differs from compiled native source');
      }
      previews.set(asset.id, preview);
    }
    const nativeObject = compiled.model.objects.find(value => value.id === body.geometryId);
    if (!nativeObject || nativeObject.kind !== binding.geometryKind) {
      throw new RangeError('Document native geometry kind differs from binding');
    }
    const ref = Object.freeze({ modelId: asset.id.replaceAll('-', '.'), geometryId: body.geometryId });
    const provenance = Object.freeze({
      documentId: document.documentId, documentRevision: document.revision,
      nativeFrame: document.nativeFrame, bodyId: body.id, assetId: asset.id,
      assetRevision: asset.revision, sourceFrame: asset.sourceFrame,
      modelId: compiled.model.name, geometryKind: binding.geometryKind, geometryId: body.geometryId,
    });
    if (binding.geometryKind === 'surface') {
      const matches = preview.surfaces.filter(value => value.surfaceId === body.geometryId);
      if (matches.length !== 1) throw new RangeError('Selected native Surface has no unique preview');
      const packet = copyCadPreviewPacket(matches[0].packet);
      if (packet.surfaceId !== ref.geometryId) throw new RangeError('Surface packet ID differs from native ID');
      output.push(Object.freeze({ kind: 'surface', packet, ref, binding: provenance }));
    } else {
      const matches = preview.curves.filter(value => value.curveId === body.geometryId);
      if (matches.length !== 1) throw new RangeError('Selected native Curve needs explicit sampled preview');
      const sample = structuredClone(matches[0].sample);
      if (sample.curve.id !== ref.geometryId) throw new RangeError('Curve sample ID differs from native ID');
      const version = sample.report.dto.version;
      if (version === 1) {
        validateWideAdaptiveCurveSamples(sample as WideAdaptiveCurveSamplingResult);
        output.push(Object.freeze({ kind: 'curve', sampleVersion: 1,
          sample: sample as WideAdaptiveCurveSamplingResult, basis: request.basis, ref, binding: provenance }));
      } else if (version === 0) {
        validateAdaptiveCurveSamples(sample as AdaptiveCurveSamplingResult);
        output.push(Object.freeze({ kind: 'curve', sampleVersion: 0,
          sample: sample as AdaptiveCurveSamplingResult, basis: request.basis, ref, binding: provenance }));
      } else throw new RangeError('Unsupported native Curve sample DTO');
    }
  }
  return Object.freeze(output);
}

/** Parse CAD document1 through the authoritative CAD grammar and source0 compiler. */
export function parseBaroCadDocument(text: string): CadDocumentResult {
  return parseCadDocument(text);
}

/** Load a bounded document file without creating renderer objects. */
export async function loadBaroCadDocument(
  url: string, transport: BaroCadLoadTransportOptions = {},
): Promise<CadDocumentResult> {
  if (typeof url !== 'string') throw new TypeError('A BaroCAD document URL is required');
  const parsedURL = new URL(url);
  if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:') {
    throw new RangeError('BaroCAD document requires an HTTP(S) URL');
  }
  const request = validateBaroCadTransport(parsedURL.href, transport);
  const text = await readAbortableBaroCadDocument(request);
  throwIfBaroCadAborted(request.signal);
  const result = parseBaroCadDocument(text);
  await Promise.resolve();
  throwIfBaroCadAborted(request.signal);
  return result;
}
