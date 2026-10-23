// The fastener sizes (O7e): the person's own — none is built in — from their file or the shipped sample
// (samples/rows/fastener-sizes.json, an example to check against the standard and the supplier), each load the person's
// act in the studio (app/sizesFile). The agent cannot press it. Fasteners and tapped holes need a size's row.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { loadSizesFile, SAMPLE_SIZES_FILE } from '../app/sizesFile';
import sample from '@barocss/cad-model/samples/rows/fastener-sizes.json';

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
