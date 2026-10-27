// Rows rule b in tests: a test's rows reach a loader only as a file the person supplied in the conversation.
// The values are each test's own test rows, not a catalogue.
import { receivePersonRowFiles, type PersonRowFiles } from '../src/engine/rowFiles';

/** One supplied file at turn 1: the context the chat state carries, and the reference a loader takes. */
export function personFile(name: string, payload: unknown): { rowFiles: PersonRowFiles; file: string } {
  const rowFiles = receivePersonRowFiles('0123456789abcdef01234567', [{ name, text: JSON.stringify(payload), turn: 1 }], 1);
  return { rowFiles, file: rowFiles.files[0].id };
}

// O7: the shipped sample rows (samples/rows), loaded in a test's setup as the person loads them — their file, its
// receipt kept — never built in. A test that builds a document with fasteners, tapped holes or casting starts from these.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPersonRows } from '../src/chat/rows';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { fastenerSizesOf } from '../src/engine/fastenerSizeRows';

/** The document with a sample file's rows loaded by the person (a receipt naming the file). */
export function withSampleRows(doc: StudioDoc, kind: 'fastener-sizes' | 'casting-rules' = 'fastener-sizes'): StudioDoc {
  const name = `${kind}.json`, text = readFileSync(resolve(import.meta.dirname, '../samples/rows', name), 'utf8');
  const rowFiles = receivePersonRowFiles('0123456789abcdef01234567', [{ name, text, turn: 1 }], 1);
  const r = loadPersonRows(doc, kind, rowFiles.files[0].id, undefined, rowFiles);
  if ('error' in r) throw new Error(r.error);
  return r.doc;
}
/** The sample's fastener sizes, for the readings that take sizes directly. */
export const SAMPLE_SIZES = fastenerSizesOf(withSampleRows(emptyDoc()));
