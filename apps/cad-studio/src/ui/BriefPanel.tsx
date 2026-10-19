// The brief in the Browser (A6.1, O24): each field with its basis and the user's words, the gaps counted, and an
// assumed or ambiguous field confirmed as it is (stated since, by the user). Editing values is A6.2's Specify panel.
import { BRIEF_FIELDS, briefGaps, REQUIRED, type Brief, type BriefKey, type Field } from '../chat/brief';

const LABEL: Record<BriefKey, string> = { purpose: 'Purpose', process: 'Process', material: 'Material', quantity: 'Quantity', envelope: 'Envelope', interfaces: 'Interfaces', loads: 'Loads', finish: 'Finish', notes: 'Notes' };
/** A field's value as a line. */
function shown(key: BriefKey, f: Field<unknown>): string {
  if (key === 'envelope') { const e = f.value as { x: number; y: number; z: number }; return `${e.x} × ${e.y} × ${e.z} mm`; }
  return Array.isArray(f.value) ? f.value.join('; ') : String(f.value);
}

export function BriefPanel({ brief, onConfirm }: { brief: Brief; onConfirm: (key: BriefKey) => void }) {
  const gaps = briefGaps(brief), missing = gaps.filter(g => g.why === 'missing');
  return <>
    <div className="ol-head req-head">Brief <span className="muted" aria-label="Brief gaps">{gaps.length ? `${gaps.length} to settle${missing.length ? ` · ${missing.map(g => LABEL[g.field]).join(', ')} missing` : ''}` : 'complete'}</span></div>
    {BRIEF_FIELDS.map(key => {
      const f = brief[key] as Field<unknown> | undefined;
      if (!f) return REQUIRED.includes(key) ? <div key={key} className="req unknown" role="listitem" aria-label={`Brief ${key}`}><span className="req-row"><span className="req-mark">?</span><b>{LABEL[key]}</b> <span className="muted">missing · required</span></span></div> : null;
      const open = f.basis !== 'stated';
      return <div key={key} className={'req ' + (open ? 'unknown' : 'pass')} role="listitem" aria-label={`Brief ${key}`}>
        <span className="req-row" title={f.source ?? f.why ?? ''}><span className="req-mark">{open ? '?' : '✓'}</span><b>{LABEL[key]}</b> {shown(key, f)}
          <span className="muted"> · {f.basis}{f.confirmed ? ` (confirmed by ${f.confirmed.by})` : ''}{open && f.why ? ` · ${f.why}` : ''}</span></span>
        {open && <span className="req-edit"><button className="ghost small" aria-label={`Confirm brief ${key}`} onClick={() => onConfirm(key)}>Confirm</button></span>}
      </div>;
    })}
  </>;
}
