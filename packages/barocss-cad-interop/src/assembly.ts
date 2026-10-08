import { parseCadAssembly } from '@barocss/cad';
import type { CadAssemblyResult } from '@barocss/cad';
import {
  readAbortableBaroCadDocument, throwIfBaroCadAborted, validateBaroCadTransport,
} from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';

export type { CadAssemblyResult } from '@barocss/cad';
export type { BaroCadLoadProgress, BaroCadLoadTransportOptions } from './transport.js';

/** Parse authored assembly0 through the public CAD grammar and native evaluator. */
export function parseBaroCadAssembly(text: string): CadAssemblyResult {
  return parseCadAssembly(text);
}

/** Read a bounded assembly file without creating renderer objects. */
export async function loadBaroCadAssembly(
  url: string, transport: BaroCadLoadTransportOptions = {},
): Promise<CadAssemblyResult> {
  if (typeof url !== 'string') throw new TypeError('A BaroCAD assembly URL is required');
  const parsedURL = new URL(url);
  if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:') {
    throw new RangeError('BaroCAD assembly requires an HTTP(S) URL');
  }
  const request = validateBaroCadTransport(parsedURL.href, transport);
  const text = await readAbortableBaroCadDocument(request);
  throwIfBaroCadAborted(request.signal);
  const result = parseBaroCadAssembly(text);
  await Promise.resolve();
  throwIfBaroCadAborted(request.signal);
  return result;
}
