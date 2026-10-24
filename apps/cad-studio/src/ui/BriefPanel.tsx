// The brief in the Browser (A6.1, O24): each field with its basis and the user's words, the gaps counted, and an
// assumed or ambiguous field confirmed as it is (stated since, by the user). Editing values is A6.2's Specify panel.
// O16: Confirm on shadcn's Button.
import { briefGaps, REQUIRED } from '@barocss/cad-model/chat/brief';
import { BRIEF_FIELDS } from '@barocss/cad-model/engine/schema/brief';
import type { Brief, BriefKey, Field } from '@barocss/cad-model/engine/schema/brief';
import { Button } from '@/components/ui/button';

const LABEL: Record<BriefKey, string> = { purpose: 'Purpose', process: 'Process', material: 'Material', quantity: 'Quantity', envelope: 'Envelope', interfaces: 'Interfaces', loads: 'Loads', finish: 'Finish', notes: 'Notes' };
/** A field's value as a line. */
function shown(key: BriefKey, f: Field<unknown>): string {
  if (key === 'envelope') { const e = f.value as { x: number; y: number; z: number }; return `${e.x} × ${e.y} × ${e.z} mm`; }
  return Array.isArray(f.value) ? f.value.join('; ') : String(f.value);
}

export function BriefPanel({ brief, onConfirm }: { brief: Brief; onConfirm: (key: BriefKey) => void }) {
  const gaps = briefGaps(brief), missing = gaps.filter(g => g.why === 'missing');
  return <>
    <div className="ol-head specify-head">Brief <span className="muted" aria-label="Brief gaps">{gaps.length ? `${gaps.length} to settle${missing.length ? ` · ${missing.map(g => LABEL[g.field]).join(', ')} missing` : ''}` : 'complete'}</span></div>
    {BRIEF_FIELDS.map(key => {
      const f = brief[key] as Field<unknown> | undefined;
      if (!f) return REQUIRED.includes(key) ? <div key={key} className="req unknown" role="listitem" aria-label={`Brief ${key}`}><span className="req-row"><span className="req-mark">?</span><b>{LABEL[key]}</b> <span className="muted">missing · required</span></span></div> : null;
      const open = f.basis !== 'stated', unchecked = !open && f.said === 'unverified' && !f.confirmed;
      return <div key={key} className={'req ' + (open ? 'unknown' : 'pass')} role="listitem" aria-label={`Brief ${key}`}>
        <span className="req-row" title={f.source ?? f.why ?? ''}><span className="req-mark">{open ? '?' : f.said === 'unverified' && !f.confirmed ? '✓?' : '✓'}</span><b>{LABEL[key]}</b> {shown(key, f)}
          <span className="muted"> · {f.basis}{f.confirmed ? ` (confirmed by ${f.confirmed.by})` : f.said === 'unverified' ? ' (unverified: no conversation to check the quote against)' : ''}{open && f.why ? ` · ${f.why}` : ''}</span></span>
        {(open || unchecked) && <span className="req-edit"><Button variant="ghost" aria-label={`Confirm brief ${key}`} onClick={() => onConfirm(key)}>Confirm</Button></span>}
      </div>;
    })}
  </>;
}
