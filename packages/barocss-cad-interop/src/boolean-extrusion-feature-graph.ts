import { parseBooleanExtrusionFeatureGraph } from '@barocss/cad';
import type { BooleanExtrusionFeatureGraphOptions, BooleanExtrusionFeatureGraphResult } from '@barocss/cad';
import {
  readAbortableBaroCadFeatureGraph, throwIfBaroCadAborted, validateBaroCadTransport,
} from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';

export type { BaroCadLoadProgress, BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadBooleanExtrusionFeatureGraphRead {
  readonly authoredText: string;
  readonly native: BooleanExtrusionFeatureGraphResult;
}

/** Preserve the authored text while the CAD parser admits and evaluates its own graph. */
export function readBaroCadBooleanExtrusionFeatureGraph(
  text: string,
  options: BooleanExtrusionFeatureGraphOptions,
): BaroCadBooleanExtrusionFeatureGraphRead {
  const native = parseBooleanExtrusionFeatureGraph(text, options);
  return Object.freeze({ authoredText: text, native });
}

/** Load an authored graph over bounded HTTP(S), then use the same native reader. */
export async function loadBaroCadBooleanExtrusionFeatureGraph(
  url: string,
  options: BooleanExtrusionFeatureGraphOptions,
  transport: BaroCadLoadTransportOptions = {},
): Promise<BaroCadBooleanExtrusionFeatureGraphRead> {
  if (typeof url !== 'string') throw new TypeError('A Boolean extrusion feature graph URL is required');
  const parsedURL = new URL(url);
  if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:') {
    throw new RangeError('Boolean extrusion feature graph requires an HTTP(S) URL');
  }
  const request = validateBaroCadTransport(parsedURL.href, transport);
  const text = await readAbortableBaroCadFeatureGraph(request);
  throwIfBaroCadAborted(request.signal);
  const result = readBaroCadBooleanExtrusionFeatureGraph(text, options);
  await Promise.resolve();
  throwIfBaroCadAborted(request.signal);
  return result;
}
