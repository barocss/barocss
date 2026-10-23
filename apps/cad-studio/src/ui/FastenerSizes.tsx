// The shop rows (O7e, O7c, O14): the person's own fastener sizes, casting rules and mounts — none is built in — from their
// file or the shipped sample (samples/rows, examples to check against the standard, the supplier, the foundry and the
// part's datasheet), each load the person's act in the studio (app/sizesFile). The agent cannot press it. Fasteners and
// tapped holes need a size's row; a cast part's rules need its process's; a mount needs its row. O16: on shadcn's
// components, drawn again only when its props change.
import { memo } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { loadShopFile, sampleFile, type ShopKind } from '../app/sizesFile';
import sizes from '@barocss/cad-model/samples/rows/fastener-sizes.json';
import casting from '@barocss/cad-model/samples/rows/casting-rules.json';
import mounts from '@barocss/cad-model/samples/rows/mounts.json';
import { Button } from '@/components/ui/button';

const KINDS: { kind: ShopKind; label: string; sample: unknown; loaded(doc: StudioDoc): string; none: string; what: string }[] = [
  { kind: 'fastener-sizes', label: 'Fastener sizes', sample: sizes, loaded: d => (d.fastenerSizes?.rows ?? []).map(r => r.id).join(', '), none: 'none — fasteners and tapped holes need them', what: 'fastener sizes' },
  { kind: 'casting-rules', label: 'Casting rules', sample: casting, loaded: d => [...new Set((d.castingRules?.rows ?? []).map(r => r.process))].map(p => `${p} (${d.castingRules!.rows.filter(r => r.process === p).length})`).join(', '), none: 'none — a cast part\'s limits need them', what: 'casting rules' },
  { kind: 'mounts', label: 'Mounts', sample: mounts, loaded: d => (d.mounts?.rows ?? []).map(r => r.id).join(', '), none: 'none — a mount needs its row', what: 'mounts' },
];

type Props = { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void };
function ShopRows({ doc, onCommit, onError }: Props) {
  const load = (kind: ShopKind, what: string, name: string, text: string) => { const r = loadShopFile(doc, kind, name, text); if ('error' in r) onError(`${what[0].toUpperCase()}${what.slice(1)} refused`, r.error); else onCommit(r.doc); };
  const addFile = async (kind: ShopKind, what: string, file: File) => { try { load(kind, what, file.name, await file.text()); } catch (cause) { onError(`Could not read the ${what}`, cause instanceof Error ? cause.message : String(cause)); } };
  return <section aria-label="Shop rows">
    <div className="card-title" style={{ marginTop: 8 }}>SHOP ROWS</div>
    {KINDS.map(k => <div key={k.kind} className="mb-1.5">
      <div className="kv" aria-label={`${k.label} loaded`}><span>{k.label}</span><b className="min-w-0 truncate" title={k.loaded(doc) || k.none}>{k.loaded(doc) || k.none}</b></div>
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" aria-label={`Load sample ${k.what}`} title={`samples/rows/${k.kind}.json: an example taken from the sources it names — check it before manufacture`} onClick={() => load(k.kind, k.what, sampleFile(k.kind), JSON.stringify(k.sample))}>Load sample {k.what}</Button>
        <Button variant="ghost" asChild><label className="file-button">Add a {k.what} file…<input type="file" accept="application/json,.json" aria-label={`${k.label} file`} hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(k.kind, k.what, f); ev.currentTarget.value = ''; }} /></label></Button>
      </div>
    </div>)}
  </section>;
}
/** Drawn again only when its props change (memo: the panel's own render, O16). A load builds on the document as it is, so it
 *  is never skipped for a document whose other fields changed. */
export const FastenerSizes = memo(ShopRows);
