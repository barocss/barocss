import { useEffect, useState } from 'react';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import { NativeSelect } from '@/components/ui/native-select';
import { approvedRequirementComparison, compareApprovedRequirements } from './approvedRequirementCompare';

type Comparison = NonNullable<ReturnType<typeof approvedRequirementComparison>>;
type CheckResult = Awaited<ReturnType<typeof compareApprovedRequirements>>;
const unitText = (unit?: string) => unit === 'mm3' ? 'mm³' : unit === 'mm2' ? 'mm²' : unit;

function Checks({ comparison, part, evaluate }: { comparison: Comparison; part: string; evaluate: Evaluate }) {
  const [settled, setSettled] = useState<{ comparison: Comparison; part: string; evaluate: Evaluate; report: CheckResult }>();
  useEffect(() => {
    let current = true;
    const complete = (report: CheckResult) => { if (current) setSettled({ comparison, part, evaluate, report }); };
    void compareApprovedRequirements(comparison, part, input => current ? evaluate(input) : Promise.resolve(null)).then(
      complete,
      () => complete({ error: 'Could not check both saved revisions.' }),
    );
    return () => { current = false; };
  }, [comparison, part, evaluate]);
  const result = settled?.comparison === comparison && settled.part === part && settled.evaluate === evaluate ? settled.report : undefined;
  if (!result) return <div role="status">Checking both revisions…</div>;
  if ('error' in result) return <div role="status">{result.error}</div>;
  return <>
    {!result.recoveries.length && <div>No verified failure-to-pass checks.</div>}
    {result.recoveries.map(row => {
      const unit = unitText(row.unit), suffix = unit ? ` ${unit}` : '';
      return <div key={row.id}><strong>{row.id}</strong> · Fail → Pass
        {row.from !== null && row.to !== null && <span className="ml-2 inline-block whitespace-nowrap tabular-nums">{row.from}{suffix} → {row.to}{suffix}</span>}
      </div>;
    })}
    {result.changed.map(({ id, kind, priorFailure, criterion }) => <div key={id}>
      <strong>{id}</strong> · {kind === 'withdrawn' ? 'Requirement withdrawn' : 'Requirement changed'}
      {priorFailure && <div>Saved failure · {priorFailure.measured === null
        ? `want ${priorFailure.expected}`
        : `${priorFailure.measured}${priorFailure.unit ? ' ' + unitText(priorFailure.unit) : ''} (want ${priorFailure.expected})`}</div>}
      {criterion && <div>New criterion · {criterion}</div>}
    </div>)}
  </>;
}

export function ApprovedRequirementChecks({ comparison, evaluate, historical }: { comparison: Comparison; evaluate: Evaluate; historical: boolean }) {
  const [part, setPart] = useState(comparison.scopes[0].id);
  const label = historical ? 'Saved approval checks' : 'Approved requirement checks';
  return <section className="mt-2" aria-label={label}>
    <strong>{comparison.proposal} · {label}</strong>
    <NativeSelect aria-label="Requirement occurrence" value={part} onChange={event => setPart(event.currentTarget.value)}>
      {comparison.scopes.map(scope => <option key={scope.id} value={scope.id}>{scope.label}{scope.id !== 'base' ? ` (${scope.id})` : ''}</option>)}
    </NativeSelect>
    <Checks key={part} comparison={comparison} part={part} evaluate={evaluate} />
  </section>;
}
