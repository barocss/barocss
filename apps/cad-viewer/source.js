import { parseDocument, loadOptions } from './document.js';
import { parseAssembly, assemblyLoadOptions } from './assembly.js';
import { readIgesSource } from './iges-source.js';

const FILE_LIMIT = 2 * 1024 * 1024;

/** Dispatch only the two existing public CAD file formats. Neither parser changes the live scene. */
export function parseSource(text, label = 'CAD file') {
  if (typeof text !== 'string') throw new TypeError('CAD file text is required.');
  if (text.length > FILE_LIMIT || new TextEncoder().encode(text).length > FILE_LIMIT)
    throw new RangeError('Choose a CAD file of 2 MiB or less.');
  let envelope;
  try { envelope = JSON.parse(text); }
  catch { throw new RangeError('The CAD file is not valid JSON.'); }
  if (envelope?.schema === 'barocss-cad-assembly') return parseAssembly(text, label);
  if (envelope?.schema === 'barocss-cad-document') {
    const document = parseDocument(text, label);
    return { ...document, kind: 'document', source: document.result.document };
  }
  throw new RangeError('Choose a supported CAD document or assembly file.');
}

export async function readSource(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 0)
    throw new TypeError('Choose a CAD file.');
  if (typeof file.name === 'string' && /\.(?:igs|iges)$/i.test(file.name)) return readIgesSource(file);
  if (typeof file.text !== 'function') throw new TypeError('Choose a CAD file.');
  if (file.size > FILE_LIMIT) throw new RangeError('Choose a CAD file of 2 MiB or less.');
  return parseSource(await file.text(), file.name);
}

export function admitSource(viewer, source, ids) {
  if (source.kind === 'assembly') viewer.loadAssembly(source.result, assemblyLoadOptions(ids));
  else viewer.loadDocument(source.result, loadOptions(ids));
}
