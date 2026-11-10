import { useEffect, useMemo, useState } from 'react';
import { requirementEvidenceOf } from '@barocss/cad-model/chat/requirementEvidence';
import { expectedOf } from '@barocss/cad-model/chat/spec';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';

type Report = Awaited<ReturnType<typeof requirementEvidenceOf>>;
type Scope = { doc: StudioDoc; part: string; evaluate: Evaluate };
const label = { pass: 'Pass', fail: 'Fail', unknown: 'Unknown' };
const mark = { pass: '✓', fail: '✗', unknown: '?' };

export function NestedRequirementReadout({ doc, part, evaluate }: Scope) {
  const scope = useMemo(() => ({ doc, part, evaluate }), [doc, part, evaluate]);
  const [settled, setSettled] = useState<{ scope: Scope; report: Report }>();
  useEffect(() => {
    let active = true;
    void requirementEvidenceOf(scope.doc, scope.part, input => active ? scope.evaluate(input) : Promise.resolve(null)).then(
      report => { if (active) setSettled({ scope, report }); },
      () => { if (active) setSettled({ scope, report: { error: 'The requirements could not be checked.' } }); },
    );
    return () => { active = false; };
  }, [scope]);

  const report = settled?.scope === scope ? settled.report : undefined;
  return <section aria-label="Local requirements">
    <div className="card-title" style={{ marginTop: 8 }}>LOCAL REQUIREMENTS</div>
    {!report ? <div className="kv muted small" role="status">Checking…</div>
      : 'error' in report ? <div className="kv muted small" role="status">{report.error.replace(/^\[OUTPUT_\w+\]\s*/, '')}</div>
      : report.evidence.map(({ requirement, result, freshness }) => {
        if (!requirement || result.kind !== 'requirement') return null;
        const current = report.part === part && result.part === part && result.run === report.revision &&
          result.subject === requirement.id && freshness.state === 'current' && !result.late;
        const verified = current && result.status === 'ok';
        const verdict = verified ? result.verdict ?? 'unknown' : 'unknown';
        const unit = requirement.check.unit, measured = verified && Number.isFinite(result.number)
          ? String(result.number) + (unit ? ' ' + unit : '') : undefined;
        const why = !current ? freshness.unresolved[0]?.message ?? 'The result is no longer current.' : result.why;
        return <div className={`req ${verdict} small`} key={requirement.id} role="group" aria-label={`Local requirement ${requirement.id}`}>
          <div><span className="req-mark" aria-hidden="true">{mark[verdict]}</span><b>{requirement.id}</b> · {label[verdict]}</div>
          <div className="muted">{requirement.source}</div>
          {measured !== undefined && <div>{measured} <span className="muted">(want {expectedOf(requirement.check)})</span></div>}
          {why && <div className="muted">{why}</div>}
        </div>;
      })}
  </section>;
}
