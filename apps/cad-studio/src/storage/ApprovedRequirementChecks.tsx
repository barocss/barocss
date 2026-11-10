import { useEffect, useState } from 'react';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import { isCurrentRequirement, type RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import { expectedOf } from '@barocss/cad-model/chat/spec';
import { NativeSelect } from '@/components/ui/native-select';
import { approvedRequirementComparison, compareApprovedRequirements } from '@barocss/cad-model/versions/approvedRequirements';
import { canonical } from '@barocss/cad-model/util/revision';
import type { CheckpointReview } from '../files/taskCheckpoint';

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

type EvidenceRow = RequirementEvidence['evidence'][number];
function checkpointVerdict(report: RequirementEvidence, row?: EvidenceRow) {
  if (!row || !isCurrentRequirement(row, report.part, report.revision)) return 'Unavailable';
  if (row.result.verdict !== 'pass' && row.result.verdict !== 'fail') return 'Unknown';
  const verdict = row.result.verdict === 'pass' ? 'Pass' : 'Fail', measured = row.result.number;
  const unit = unitText(row.requirement?.check.unit);
  return measured === null ? verdict : `${verdict} · ${measured}${unit ? ' ' + unit : ''}`;
}

/** The two saved columns stay bound to approval. The optional working column has its own revision. */
export function CheckpointApprovalChecks({ review, historical = false, working }: {
  review: CheckpointReview; historical?: boolean; working?: RequirementEvidence;
}) {
  const { before, approved, taskId, revision, proposalId } = review;
  const previous = new Map(before.evidence.map(row => [row.requirement?.id, row]));
  const current = new Map(working?.evidence.map(row => [row.requirement?.id, row]));
  const title = historical ? 'Worker approval checks' : 'Worker checkpoint checks';
  return <section className="my-2" aria-label={title}>
    <strong>{title}</strong>
    <div>Task {taskId} · {approved.part} · {proposalId}{historical ? '' : ' · Revision ' + revision}</div>
    <table className="mt-1 w-full text-left text-[11px]">
      <thead><tr><th scope="col">Requirement</th><th scope="col">Before approval</th><th scope="col">Approved</th>{working && <th scope="col">Working model</th>}</tr></thead>
      <tbody>{approved.evidence.map(row => {
        const req = row.requirement;
        if (!req) return null;
        const latest = current.get(req.id);
        return <tr key={req.id}>
          <th scope="row">{req.id}<span className="block font-normal text-muted-foreground">{expectedOf(req.check)}</span></th>
          <td className="tabular-nums">{checkpointVerdict(before, previous.get(req.id))}</td>
          <td className="tabular-nums">{checkpointVerdict(approved, row)}</td>
          {working && <td className="tabular-nums">{latest?.requirement && canonical(latest.requirement) !== canonical(req)
            ? <>Requirement changed<span className="block">{expectedOf(latest.requirement.check)}</span></>
            : checkpointVerdict(working, latest)}</td>}
        </tr>;
      })}</tbody>
    </table>
    <details className="mt-1 text-[11px]">
      <summary>Evidence revisions</summary>
      <dl className="m-0"><dt>Before approval</dt><dd className="m-0 break-all font-mono">{before.revision}</dd>
        <dt>Approved</dt><dd className="m-0 break-all font-mono">{approved.revision}</dd>
        {working && <><dt>Working model</dt><dd className="m-0 break-all font-mono">{working.revision}</dd></>}</dl>
    </details>
  </section>;
}
