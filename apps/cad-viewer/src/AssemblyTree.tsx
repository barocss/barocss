import { useEffect, useRef, useState } from 'react';
import type { ViewerGeometryRef, ViewerState } from '@barocss/viewer';
import { Button } from './components/ui/button';

export type AssemblyRow = {
  id: string; name: string; kind: string; geometryId: string; assetId: string;
  parentId?: string | null; ancestors?: string[];
};
const sameRef = (a: ViewerGeometryRef, b: ViewerGeometryRef | null) => Boolean(b && a.kind === b.kind
  && a.modelId === b.modelId && (a.kind === 'surface' ? a.surfaceId : a.curveId)
  === (b.kind === 'surface' ? b.surfaceId : b.curveId));

/** Full authored hierarchy. Unloaded parents remain metadata rows with expandable children. */
export function AssemblyTree({ catalog, state, search, onSelect, onVisibility }: {
  catalog: AssemblyRow[]; state: ViewerState; search: string;
  onSelect: (ref: ViewerGeometryRef) => void;
  onVisibility: (ref: ViewerGeometryRef, visible: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const selectedId = state.assemblyInstances.find(row => sameRef(row.ref, state.selectedGeometry))?.instanceId;
  useEffect(() => {
    if (!selectedId) return;
    const selected = catalog.find(row => row.id === selectedId);
    setCollapsed(previous => new Set([...previous].filter(id => !selected?.ancestors?.includes(id))));
  }, [selectedId, catalog]);
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedId, collapsed]);

  const filter = search.trim().toLowerCase();
  const matches = catalog.filter(row => !filter || [row.id, row.assetId, row.geometryId].join(' ').toLowerCase().includes(filter));
  const included = new Set(matches.flatMap(row => [row.id, ...(row.ancestors ?? [])]));
  function rows(parentId: string | null) {
    return catalog.filter(row => (row.parentId ?? null) === parentId && included.has(row.id)).map(row => {
      const binding = state.assemblyInstances.find(value => value.instanceId === row.id);
      const visible = Boolean(binding && state.visibleGeometry.some(ref => sameRef(ref, binding.ref)));
      const selected = row.id === selectedId;
      const children = catalog.some(value => value.parentId === row.id && included.has(value.id));
      const expanded = Boolean(filter) || !collapsed.has(row.id);
      return <li key={row.id} className="assembly-node">
        <div className={`body-row assembly-row${binding && !visible ? ' is-hidden' : ''}`}
          data-instance-id={row.id} data-selected={selected} data-admitted={Boolean(binding)}>
          {children ? <Button type="button" className="assembly-expand" variant="ghost" size="sm"
            aria-label={`Expand ${row.id}`} aria-expanded={expanded}
            onClick={() => setCollapsed(previous => {
              const next = new Set(previous); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next;
            })}><span aria-hidden="true">{expanded ? '⌄' : '›'}</span></Button>
            : <span className="assembly-spacer" />}
          <input type="checkbox" className="body-visibility" checked={visible} disabled={!binding}
            aria-label={`Show instance ${row.id}`} title={binding ? 'Show this occurrence' : 'Choose this instance to load it.'}
            onChange={event => binding && onVisibility(binding.ref, event.target.checked)} />
          <Button className="body-select block h-auto min-h-10 flex-1 justify-start whitespace-normal p-1 text-left"
            variant="ghost" size="sm" disabled={!binding || !visible} aria-label={`Select instance ${row.id}`}
            aria-pressed={selected} onClick={() => binding && onSelect(binding.ref)}>
            <span>{row.id}</span><small>{binding ? row.geometryId : 'Not loaded'}</small>
          </Button>
        </div>
        {children && expanded && <ul className="assembly-children">{rows(row.id)}</ul>}
      </li>;
    });
  }
  return <div ref={listRef} className="assembly-tree" aria-label="Assembly hierarchy">
    <ul className="assembly-roots">{rows(null)}</ul>
    {matches.length === 0 && <p className="list-empty">No matching instances.</p>}
  </div>;
}
