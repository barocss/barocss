import { Fragment, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { featureLabel } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { selectedBodies, refOf, type Selection } from '@barocss/cad-model/app/commands';
import { bodyName, bodySteps, lastFeature, lookOf, withLook } from '@barocss/cad-model/app/bodies';
import { emptySel } from '../app/studioConstants';
import { iconFor } from './featureIcon';
import { Icon } from './atoms';
interface BodyBrowserRowsProps {
  model: { doc: StudioDoc; evaluated: StudioDoc; namesDoc: StudioDoc; bodies: BodyResult[]; fresh: boolean; busy: boolean };
  selection: Selection;
  rows: { expanded: string[]; setExpanded: Dispatch<SetStateAction<string[]>>; renaming: string | null; setRenaming: Dispatch<SetStateAction<string | null>>; editNode: number | null; setEditNode: Dispatch<SetStateAction<number | null>>; setRowHover: Dispatch<SetStateAction<number | null>> };
  changes: { commit(next: StudioDoc): boolean; setSelection: Dispatch<SetStateAction<Selection>>; setDirectSel: Dispatch<SetStateAction<string[]>>; setInstanceSel: Dispatch<SetStateAction<string[]>> };
  meshBadges(index: number, body: BodyResult, steps: readonly number[]): ReactNode;
}
/** Body rows and their feature lists; row state survives Browser visibility changes in App. */
export function BodyBrowserRows({ model, selection, rows, changes, meshBadges }: BodyBrowserRowsProps) {
  const { doc, evaluated, namesDoc, bodies, fresh, busy } = model;
  const { expanded, setExpanded, renaming, setRenaming, editNode, setEditNode, setRowHover } = rows;
  const { commit, setSelection, setDirectSel, setInstanceSel } = changes;
  return <>
        {bodies.length > 0 && <div className="ol-head">Bodies</div>}
        {!fresh && bodies.map(b => <div key={b.key} className="ol-row stale" aria-busy="true" title={busy ? 'Evaluating the part: this is the body before the change' : 'The part did not evaluate: this is the last good body'}>
          <span className="ol-eye" /><span className="ol-swatch" /><span className="ol">{bodyName(namesDoc, b)}</span></div>)}
        {fresh && bodies.map((b, i) => {
          const sel = selectedBodies(selection).includes(i), look = lookOf(doc, b);
          const pick = (e: React.MouseEvent) => { setDirectSel([]); setInstanceSel([]); setSelection(prev => {
            const list = selectedBodies(prev); return e.shiftKey ? { faces: [], edges: [], bodies: list.includes(i) ? list.filter(x => x !== i) : [...list, i] } : { faces: [], edges: [], bodies: [i] };
          }); };
          const steps = bodySteps(evaluated.nodes, refOf(b).node), open = expanded.includes(b.key);
          return <Fragment key={b.key}><div className={'ol-row' + (sel ? ' sel' : '') + (look.hidden ? ' hidden-obj' : '')} onMouseEnter={() => setRowHover(i)} onMouseLeave={() => setRowHover(h => h === i ? null : h)}>
            <button className="ol-caret" aria-label={open ? 'Hide its features' : 'Show its features'} disabled={steps.length < 2} onClick={() => setExpanded(x => open ? x.filter(k => k !== b.key) : [...x, b.key])}><Icon name={open ? 'expand_more' : 'chevron_right'} small /></button>
            <button className="ol-eye" aria-label={look.hidden ? 'Show body' : 'Hide body'} data-tip={look.hidden ? 'Show' : 'Hide'}
              onClick={() => { if (!commit(withLook(doc, b, { hidden: !look.hidden }))) return; if (!look.hidden) setSelection(emptySel); }}><Icon name={look.hidden ? 'visibility_off' : 'visibility'} small /></button>
            <span className="ol-swatch" style={look.color ? { background: look.color } : undefined} />
            {renaming === b.key
              ? <input className="ol-name-edit" autoFocus defaultValue={bodyName(doc, b)} aria-label="Body name"
                onKeyDown={e => { if (e.key === 'Enter') { commit(withLook(doc, b, { name: e.currentTarget.value.trim() })); setRenaming(null); } else if (e.key === 'Escape') setRenaming(null); e.stopPropagation(); }}
                onBlur={e => { if (e.currentTarget.value.trim() !== bodyName(doc, b)) commit(withLook(doc, b, { name: e.currentTarget.value.trim() })); setRenaming(null); }} />
              : <button className={'ol' + (sel ? ' sel' : '')} onClick={pick} onDoubleClick={() => setRenaming(b.key)} title="Double-click to rename">
                {bodyName(doc, b)}{(() => { const last = lastFeature(doc, b); return last ? <span className="muted"> · {last}</span> : null; })()}</button>}
            {meshBadges(i, b, steps)}
          </div>
          {open && steps.map(k => <button key={k} className={'ol ol-step' + (editNode === k ? ' sel' : '')} onClick={() => { setEditNode(k); setSelection({ faces: [], edges: [], bodies: [i] }); }}>
            <Icon name={iconFor(evaluated.nodes[k])} small />{featureLabel(evaluated.nodes[k], k, evaluated.nodes)}</button>)}
          </Fragment>;
        })}
  </>;
}
