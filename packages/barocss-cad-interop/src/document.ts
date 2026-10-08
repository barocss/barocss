import { parseCadDocument } from '@barocss/cad';
import type { CadDocumentResult } from '@barocss/cad';
import {
  readAbortableBaroCadDocument, throwIfBaroCadAborted, validateBaroCadTransport,
} from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';

export type { CadDocumentResult } from '@barocss/cad';
export type { BaroCadLoadProgress, BaroCadLoadTransportOptions } from './transport.js';

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
