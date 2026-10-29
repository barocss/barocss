import type { Dispatch, SetStateAction } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Outcome } from '@barocss/cad-model/engine/schema/spec';
import type { Selection } from '@barocss/cad-model/app/commands';
import { resolveNames } from '@barocss/cad-model/chat/names';
import { expectedOf } from '@barocss/cad-model/chat/spec';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';
export type RequirementReport = { summary: { pass: number; fail: number; unknown: number }; outcomes: Record<string, Outcome>; of: readonly unknown[] };
interface RequirementsBrowserProps {
  doc: StudioDoc;
  evaluated: StudioDoc;
  bodies: BodyResult[];
  spec: RequirementReport | null;
  specRunning: boolean;
  failingOnly: boolean;
  setFailingOnly: Dispatch<SetStateAction<boolean>>;
  setSelection: Dispatch<SetStateAction<Selection>>;
  setRequirement(id: string, value: number): void;
}
export function RequirementsBrowser({ doc, evaluated, bodies, spec, specRunning, failingOnly, setFailingOnly, setSelection, setRequirement }: RequirementsBrowserProps) {
  return <>
        {!!doc.requirements?.length && <><div className="ol-head req-head">Requirements <span className="muted">{spec ? `${spec.summary.pass} ✓ · ${spec.summary.fail} ✗ · ${spec.summary.unknown} ?` : ''}{specRunning ? ' · checking…' : spec && spec.of !== evaluated.nodes ? ' · stale' : ''}</span>
          <ToolIconButton size="tiny" state={failingOnly ? 'on' : 'idle'} aria-label="Failing only" data-tip={failingOnly ? 'Show all' : 'Failing only'} onClick={() => setFailingOnly(f => !f)}><Icon name="filter_list" small /></ToolIconButton></div>
        {doc.requirements.map(q => {
          const o = spec?.outcomes[q.id], st = o?.status ?? 'unknown';
          if (failingOnly && st === 'pass') return null;
          const editable = q.basis === 'assumed' || q.basis === 'ambiguous';
          return <div key={q.id} className={'req ' + st} role="listitem" aria-label={`Requirement ${q.id}`}>
            <button className="req-row" title={o?.why ?? (o?.hint ? `${o.hint}` : q.source)} onClick={() => { if (o?.entities?.length) setSelection(resolveNames(bodies, { faces: o.entities, edges: o.entities }).selection); }}>
              <span className="req-mark">{st === 'pass' ? '✓' : st === 'fail' ? '✗' : '?'}</span><b>{q.id}</b> {q.source}
              {st === 'fail' && <span className="muted"> · {String(o?.measured)} (want {expectedOf(q.check)})</span>}
              {st === 'unknown' && o?.why && <span className="muted"> · {o.why}</span>}
              <span className="muted"> · {q.hard ? 'hard' : 'soft'} · {q.basis ?? 'stated'}{q.confirmed ? ` (confirmed by ${q.confirmed.by})` : ''}</span></button>
            {editable && <span className="req-edit"><span className="muted">{q.basis}</span>
              <input aria-label={`${q.id} value`} type="number" step="any" defaultValue={q.check.value ?? q.check.max ?? q.check.min}
                onKeyDown={e => { if (e.key === 'Enter') setRequirement(q.id, Number(e.currentTarget.value)); e.stopPropagation(); }} />
              <button className="ghost small" aria-label={`Confirm ${q.id}`} onClick={e => { const v = (e.currentTarget.previousSibling as HTMLInputElement).value; setRequirement(q.id, Number(v)); }}>Confirm</button></span>}
          </div>;
        })}</>}
  </>;
}
