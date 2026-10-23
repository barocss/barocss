// The person's fastener sizes loaded in the studio (O7e): their file, or the shipped sample, received as a person's file
// — the click is the person's act, a one-turn receipt of its own — and loaded as chat's load_rows loads one, its receipt
// naming the file. The agent cannot call it (it is no tool).
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { loadPersonRows } from '@barocss/cad-model/chat/rows';
import { receivePersonRowFiles } from '@barocss/cad-model/chat/rowFiles';

/** The sample's name in its receipt (a receipt's file name holds no folders): samples/rows/fastener-sizes.json. */
export const SAMPLE_SIZES_FILE = 'cad-model sample fastener-sizes.json';
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');

/** The person's file loaded into the document's fastener sizes, its receipt kept. */
export function loadSizesFile(doc: StudioDoc, name: string, text: string): { doc: StudioDoc } | { error: string } {
  try {
    const files = receivePersonRowFiles(hex(), [{ name, text, turn: 1 }], 1);
    const r = loadPersonRows(doc, 'fastener-sizes', files.files[0].id, undefined, files);
    return 'error' in r ? { error: r.error } : { doc: r.doc };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
}
