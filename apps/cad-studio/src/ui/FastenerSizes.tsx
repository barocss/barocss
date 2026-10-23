// The fastener sizes (O7e): the person's own — none is built in — from their file or the shipped sample
// (samples/rows/fastener-sizes.json, an example to check against the standard and the supplier), each load the person's
// act in the studio: received as a person's file and loaded as chat's load_rows loads one, its receipt naming the file.
// The agent cannot press it. Fasteners and tapped holes need a size's row.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { loadPersonRows } from '@barocss/cad-model/chat/rows';
import { receivePersonRowFiles } from '@barocss/cad-model/chat/rowFiles';
import sample from '@barocss/cad-model/samples/rows/fastener-sizes.json';

/** A file name the receipt keeps (no folders in it): the sample's says it is the package's sample. */
export const SAMPLE_SIZES_FILE = 'cad-model sample fastener-sizes.json';
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');

/** The person's file loaded into the document's fastener sizes, its receipt kept (a studio load is turn 0). */
export function loadSizesFile(doc: StudioDoc, name: string, text: string): { doc: StudioDoc } | { error: string } {
  try {
    const files = receivePersonRowFiles(hex(), [{ name, text, turn: 0 }], 0);
    const r = loadPersonRows(doc, 'fastener-sizes', files.files[0].id, undefined, files);
    return 'error' in r ? { error: r.error } : { doc: r.doc };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
}

export function FastenerSizes({ doc, onCommit, onError }: { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void }) {
  const rows = doc.fastenerSizes?.rows ?? [];
  const load = (name: string, text: string) => { const r = loadSizesFile(doc, name, text); if ('error' in r) onError('Fastener sizes refused', r.error); else onCommit(r.doc); };
  const addFile = async (file: File) => { try { load(file.name, await file.text()); } catch (cause) { onError('Could not read the fastener sizes', cause instanceof Error ? cause.message : String(cause)); } };
  return <section aria-label="Shop rows">
    <div className="card-title" style={{ marginTop: 8 }}>SHOP ROWS</div>
    <div className="kv" aria-label="Fastener sizes loaded"><span>Fastener sizes</span><b>{rows.length ? rows.map(r => r.id).join(', ') : 'none — fasteners and tapped holes need them'}</b></div>
    <div className="row-actions">
      <button className="ghost small" aria-label="Load sample fastener sizes" title="samples/rows/fastener-sizes.json: an example taken from the sources it names — check it against the standard and your supplier" onClick={() => load(SAMPLE_SIZES_FILE, JSON.stringify(sample))}>Load sample fastener sizes</button>
      <label className="ghost small file-button">Add a fastener sizes file…<input type="file" accept="application/json,.json" aria-label="Fastener sizes file" hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(f); ev.currentTarget.value = ''; }} /></label>
    </div>
  </section>;
}
