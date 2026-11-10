import { sha256Hex } from '../util/digest';

const encoder = new TextEncoder();
export const outputFile = (path: string, mime: string, data: string | Uint8Array) => {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  // bytes are explicit for binary files, as robot exporters' files carry bytes; no host path is accepted.
  return { path, mime, bytes: bytes.length, sha256: sha256Hex(bytes), ...(typeof data === 'string' ? { encoding: 'utf-8', text: data } : { encoding: 'bytes', data: Array.from(bytes) }) };
};
