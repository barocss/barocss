import { useEffect, useMemo, useState } from 'react';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import { isCurrentRequirement, type RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import { expectedOf } from '@barocss/cad-model/chat/spec';
import { NativeSelect } from '@/components/ui/native-select';
import { approvedRequirementComparison, compareApprovedRequirements } from '@barocss/cad-model/versions/approvedRequirements';
import { readVersion, type Version, type VersionLog } from '@barocss/cad-model/versions/log';
import { requirementFollowUp } from '@barocss/cad-model/versions/requirementFollowUp';
import { requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { canonical } from '@barocss/cad-model/util/revision';
import type { CheckpointReview } from '../files/taskCheckpoint';

type Comparison = NonNullable<ReturnType<typeof approvedRequirementComparison>>;
type CheckResult = Awaited<ReturnType<typeof compareApprovedRequirements>>;
type SavedSuccessor = { log: VersionLog; version: Version };
type FollowUpResult = Awaited<ReturnType<typeof requirementFollowUp>>;
const unitText = (unit?: string) => unit === 'mm3' ? 'mm³' : unit === 'mm2' ? 'mm²' : unit;
const FOLLOW_UP_STATUS = {
  regressed: 'Regressed',
  passing: 'Pass',
  'requirement-changed': 'Requirement changed',
  'requirement-withdrawn': 'Requirement withdrawn',
  unresolved: 'Unresolved',
};

function SavedRequirementFollowUp({ pin, comparison, part, approval, evaluate }: {
  pin: SavedSuccessor; comparison: Comparison; part: string; approval: Exclude<CheckResult, { error: string }>; evaluate: Evaluate;
}) {
  const [selected, setSelected] = useState(false);
  const request = useMemo(() => selected ? { pin, comparison, part, approval, evaluate } : null,
    [selected, pin, comparison, part, approval, evaluate]);
  const [settled, setSettled] = useState<{ request: NonNullable<typeof request>; report: FollowUpResult }>();
  useEffect(() => {
    if (!request) return;
    const operation = request.comparison.nested?.ops[0];
    if (!operation) return;
    let current = true;
    const recovered = request.approval.recoveries.map(row => row.id);
    const check = async () => {
      const later = readVersion(request.pin.log, request.pin.version.id);
      return requirementFollowUp(request.comparison.after, later, operation, request.part, recovered,
        request.approval.after, requirementEvidenceRevision(later), input => current ? request.evaluate(input) : Promise.resolve(null));
    };
    const complete = (report: FollowUpResult) => { if (current) setSettled({ request, report }); };
    void check().then(complete, () => complete({ status: 'unresolved', reason: 'Could not check the saved follow-up.',
      findings: recovered.map(id => ({ id, status: 'unresolved' })) }));
    return () => { current = false; };
  }, [request]);
  const report = settled && settled.request === request ? settled.report : undefined;
  const evidence = report?.status === 'checked' ? report.evidence : null;
  return <div className="mt-1">
    <label className="block">Follow-up version
      <NativeSelect aria-label="Follow-up version" value={selected ? pin.version.id : ''} onChange={event => setSelected(event.currentTarget.value === pin.version.id)}>
        <option value="">None</option>
        <option value={pin.version.id}>{pin.version.name ?? pin.version.id}</option>
      </NativeSelect>
    </label>
    {selected && <div role="region" aria-label="Saved follow-up checks" aria-live="polite">
      {!report && <div role="status">Checking follow-up…</div>}
      {report?.status === 'unresolved' && <div>{report.reason}</div>}
      {report?.findings.map(({ id, status }) => {
        const row = status === 'regressed' || status === 'passing' ? evidence?.evidence.find(item => item.requirement?.id === id) : undefined;
        const unit = unitText(row?.requirement?.check.unit);
        return <div key={id}><strong>{id}</strong> · <span>{FOLLOW_UP_STATUS[status]}</span>
          {row?.result.number != null && <span className="ml-2 inline-block whitespace-nowrap tabular-nums">{row.result.number}{unit ? ' ' + unit : ''}</span>}
        </div>;
      })}
    </div>}
  </div>;
}

function Checks({ comparison, part, evaluate, followUp }: {
  comparison: Comparison; part: string; evaluate: Evaluate; followUp?: SavedSuccessor;
}) {
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
    {followUp && result.recoveries.length > 0 && <SavedRequirementFollowUp key={followUp.version.id}
      pin={followUp} comparison={comparison} part={part} approval={result} evaluate={evaluate} />}
  </>;
}

export function ApprovedRequirementChecks({ comparison, evaluate, historical, followUp }: {
  comparison: Comparison; evaluate: Evaluate; historical: boolean; followUp?: SavedSuccessor;
}) {
  const [part, setPart] = useState(comparison.scopes[0].id);
  const label = historical ? 'Saved approval checks' : 'Approved requirement checks';
  return <section className="mt-2" aria-label={label}>
    <strong>{comparison.proposal} · {label}</strong>
    <NativeSelect aria-label="Requirement occurrence" value={part} onChange={event => setPart(event.currentTarget.value)}>
      {comparison.scopes.map(scope => <option key={scope.id} value={scope.id}>{scope.label}{scope.id !== 'base' ? ` (${scope.id})` : ''}</option>)}
    </NativeSelect>
    <Checks key={part} comparison={comparison} part={part} evaluate={evaluate} followUp={followUp} />
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
