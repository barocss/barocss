// The Specify panel (A6.2, O25): the agent's open questions with their inputs, and the assumptions worth a check.
// "N to answer, M to check"; Send answers (a blank one is skipped), Skip all, Accept all as they are. Nothing is
// blocked: the agent carries on with its assumptions whatever the user does here. Our own layout, following a
// required / worth-a-check / accept-all pattern only.
import { useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { assumptionsOf, readQuestions } from '@barocss/cad-model/chat/questions';

const shown = (v: unknown) => (v === undefined ? '—' : Array.isArray(v) ? v.join('; ') : v && typeof v === 'object' ? Object.values(v).join(' × ') : String(v));

export function SpecifyPanel({ doc, onAnswer, onAcceptAll }: { doc: StudioDoc; onAnswer: (answers: Record<string, string | number | null>) => void; onAcceptAll: () => void }) {
  const open = readQuestions(doc.questions).batches.find(b => b.status === 'open'), checks = assumptionsOf(doc);
  const [values, setValues] = useState<Record<string, string>>({});
  if (!open && !checks.length) return null;
  const n = open?.questions.length ?? 0;
  const answers = () => Object.fromEntries((open?.questions ?? []).map(q => { const v = (values[q.id] ?? '').trim(); return [q.id, !v ? null : q.kind === 'number' ? Number(v) : v]; }));
  return <div className="specify" role="region" aria-label="Specify">
    <div className="ol-head specify-head">Specify <span className="muted" aria-label="Specify counts">{n} to answer · {checks.length} to check</span></div>
    {open && <>
      {open.questions.map(q => <label key={q.id} className="kv specify-q" aria-label={`Question ${q.id}`}>
        <span>{q.text}{q.unit ? <span className="muted"> ({q.unit})</span> : null}</span>
        {q.kind === 'choice'
          ? <select aria-label={`Answer ${q.id}`} value={values[q.id] ?? ''} onChange={e => setValues(v => ({ ...v, [q.id]: e.target.value }))}><option value="">—</option>{q.options!.map(o => <option key={o} value={o}>{o}</option>)}</select>
          : <input aria-label={`Answer ${q.id}`} type={q.kind === 'number' ? 'number' : 'text'} step="any" value={values[q.id] ?? ''} onChange={e => setValues(v => ({ ...v, [q.id]: e.target.value }))} onKeyDown={e => e.stopPropagation()} />}
      </label>)}
      <div className="row"><button className="small" aria-label="Send answers" onClick={() => { onAnswer(answers()); setValues({}); }}>Send answers</button>
        <button className="ghost small" aria-label="Skip questions" onClick={() => { onAnswer(Object.fromEntries(open.questions.map(q => [q.id, null]))); setValues({}); }}>Skip</button></div>
    </>}
    {!!checks.length && <>
      <div className="muted specify-sub">Worth a check (the agent's assumptions; each can be changed)</div>
      {checks.map(x => { const key = 'field' in x ? x.field : x.requirement; return <div key={key} className="kv" aria-label={`Assumption ${key}`}><span>{key}</span><span>{shown(x.value)}{x.why ? <span className="muted"> · {x.why}</span> : null}</span></div>; })}
      <button className="ghost small" aria-label="Accept all assumptions" onClick={onAcceptAll}>Accept {checks.length} as they are</button>
    </>}
    <div className="muted">Nothing is blocked: the agent goes on with its assumptions.</div>
  </div>;
}
