import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import { isCurrentRequirement, type RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import { expectedOf } from '@barocss/cad-model/chat/spec';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { approvedRequirementComparison, compareApprovedRequirements } from '@barocss/cad-model/versions/approvedRequirements';
import type { ApprovalCheck } from '@barocss/cad-model/versions/approvalEvidenceReport';
import type { Version, VersionLog } from '@barocss/cad-model/versions/log';
import { requirementFollowUp } from '@barocss/cad-model/versions/requirementFollowUp';
import { canonical } from '@barocss/cad-model/util/revision';
import type { CheckpointReview } from '../files/taskCheckpoint';
import { SavedRepairChecks } from './SavedRepairChecks';
import { bindSavedApproval, bindSavedFollowUp, readSavedApprovalEvidence, readSavedFollowUpEvidence,
  saveApprovalEvidence, saveFollowUpEvidence, type SavedApprovalPair, type SavedApprovalSource } from './savedApprovalEvidence';

type Comparison = NonNullable<ReturnType<typeof approvedRequirementComparison>>;
type CheckResult = Awaited<ReturnType<typeof compareApprovedRequirements>>;
type BoundReview = ReturnType<typeof bindSavedApproval>;
type BoundFollowUp = NonNullable<ReturnType<typeof bindSavedFollowUp>>;
export type AttachApprovalEvidence = (source: SavedApprovalSource) => Promise<boolean>;
type SavedSuccessor = { log: VersionLog; version: Version; newer: readonly Version[] };
type FollowUpResult = Awaited<ReturnType<typeof requirementFollowUp>>;
type FollowUpRead = FollowUpResult | { error: string };
const unitText = (unit?: string) => unit === 'mm3' ? 'mm³' : unit === 'mm2' ? 'mm²' : unit;
const FOLLOW_UP_STATUS = {
  regressed: 'Regressed',
  passing: 'Pass',
  'requirement-changed': 'Requirement changed',
  'requirement-withdrawn': 'Requirement withdrawn',
  unresolved: 'Unresolved',
};

function useEvidenceSave() {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const save = (write: () => Promise<void>) => {
    setState('saving');
    void write().then(() => setState('saved'), () => setState('failed'));
  };
  return { state, save };
}

function AttachEvidenceButton({ source, onAttach, kind }: {
  source: SavedApprovalSource; onAttach: AttachApprovalEvidence; kind: 'approval' | 'follow-up';
}) {
  const [attaching, setAttaching] = useState(false), [failed, setFailed] = useState(false);
  return <>
    <Button variant="ghost" size="xs" disabled={attaching} onClick={() => {
      setAttaching(true);
      setFailed(false);
      void onAttach(source).then(ok => setFailed(!ok), () => setFailed(true)).finally(() => setAttaching(false));
    }}>Attach {kind} evidence to chat</Button>
    {failed && <div role="status">Could not attach {kind} evidence.</div>}
  </>;
}

function KeepFollowUpEvidence({ source, approval, report, stored, onAttach, children }: {
  source: BoundFollowUp; approval: ApprovalCheck; report: Extract<FollowUpResult, { status: 'checked' }>;
  stored: boolean; onAttach?: AttachApprovalEvidence; children?: ReactNode;
}) {
  const { state, save } = useEvidenceSave();
  if (stored || state === 'saved') return <div>
    <div role="status">Follow-up evidence saved</div>
    {onAttach && <AttachEvidenceButton source={source} onAttach={onAttach} kind="follow-up" />}
    {children}
  </div>;
  return <div className="mt-1">
    <Button variant="ghost" size="xs" disabled={state === 'saving'} onClick={() => save(() => saveFollowUpEvidence(source, approval, report))}>
      {state === 'saving' ? 'Saving follow-up evidence…' : 'Save follow-up evidence'}
    </Button>
    {state === 'failed' && <div role="status">Could not save follow-up evidence.</div>}
  </div>;
}

function SavedRequirementFollowUp({ source, followUp, approval, evaluate, onAttach }: {
  source: BoundFollowUp; followUp: SavedSuccessor; approval: ApprovalCheck; evaluate: Evaluate; onAttach?: AttachApprovalEvidence;
}) {
  const [selected, setSelected] = useState(false);
  const request = useMemo(() => selected ? { source, approval, evaluate } : null, [selected, source, approval, evaluate]);
  const [settled, setSettled] = useState<{ request: NonNullable<typeof request>; report: FollowUpRead; stored: boolean }>();
  useEffect(() => {
    if (!request) return;
    const { review, doc, version, operation } = request.source;
    let current = true;
    const recovered = request.approval.recoveries.map(row => row.id);
    const complete = (report: FollowUpRead, stored = false) => { if (current) setSettled({ request, report, stored }); };
    const check = async () => {
      const saved = await readSavedFollowUpEvidence(request.source);
      if (!current) return;
      if (saved) {
        if ('error' in saved) complete(saved);
        else if (canonical(saved.approval) === canonical(request.approval)) complete(saved.followUp, true);
        else complete({ error: 'Saved follow-up evidence does not match this review.' });
        return;
      }
      const report = await requirementFollowUp(review.after, doc, operation, review.context.part, recovered,
        request.approval.after, version.evidenceRevision, input => current ? request.evaluate(input) : Promise.resolve(null));
      complete(report);
    };
    void check().catch(() => complete({ status: 'unresolved', reason: 'Could not check the saved follow-up.',
      findings: recovered.map(id => ({ id, status: 'unresolved' })) }));
    return () => { current = false; };
  }, [request]);
  const current = settled?.request === request ? settled : undefined;
  const result = current?.report;
  const report = result && !('error' in result) ? result : undefined;
  const evidence = report?.status === 'checked' ? report.evidence : null;
  return <div className="mt-1">
    <label className="block">Follow-up version
      <NativeSelect aria-label="Follow-up version" value={selected ? source.version.id : ''} onChange={event => setSelected(event.currentTarget.value === source.version.id)}>
        <option value="">None</option>
        <option value={source.version.id}>{followUp.version.name ?? followUp.version.id}</option>
      </NativeSelect>
    </label>
    {selected && <div role="region" aria-label="Saved follow-up checks" aria-live="polite">
      {!result && <div role="status">Checking follow-up…</div>}
      {result && 'error' in result && <div role="status">{result.error}</div>}
      {report?.status === 'unresolved' && <div>{report.reason}</div>}
      {report?.findings.map(({ id, status }) => {
        const row = status === 'regressed' || status === 'passing' ? evidence?.evidence.find(item => item.requirement?.id === id) : undefined;
        const unit = unitText(row?.requirement?.check.unit);
        return <div key={id}><strong>{id}</strong> · <span>{FOLLOW_UP_STATUS[status]}</span>
          {row?.result.number != null && <span className="ml-2 inline-block whitespace-nowrap tabular-nums">{row.result.number}{unit ? ' ' + unit : ''}</span>}
        </div>;
      })}
      {report?.status === 'checked' && <KeepFollowUpEvidence source={source} approval={approval} report={report} stored={!!current?.stored} onAttach={onAttach}>
        {followUp.newer.length > 0 && report.findings.some(row => row.status === 'regressed') &&
          <SavedRepairChecks source={source} log={followUp.log} versions={followUp.newer} evaluate={evaluate} />}
      </KeepFollowUpEvidence>}
    </div>}
  </div>;
}

function KeepApprovalEvidence({ review, report, stored, onAttach }: {
  review: BoundReview; report: ApprovalCheck; stored: boolean; onAttach?: AttachApprovalEvidence;
}) {
  const { state, save } = useEvidenceSave();
  if (stored || state === 'saved') return <div>
    <div role="status">Approval evidence saved</div>
    {onAttach && <AttachEvidenceButton source={review} onAttach={onAttach} kind="approval" />}
  </div>;
  return <div className="mt-1">
    <Button variant="ghost" size="xs" disabled={state === 'saving'} onClick={() => save(() => saveApprovalEvidence(review, report))}>
      {state === 'saving' ? 'Saving approval evidence…' : 'Save approval evidence'}
    </Button>
    {state === 'failed' && <div role="status">Could not save approval evidence.</div>}
  </div>;
}

function Checks({ comparison, part, evaluate, followUp, savedPair, onAttach }: {
  comparison: Comparison; part: string; evaluate: Evaluate; followUp?: SavedSuccessor; savedPair?: SavedApprovalPair; onAttach?: AttachApprovalEvidence;
}) {
  const review = useMemo(() => savedPair ? bindSavedApproval(savedPair, comparison, part) : null, [savedPair, comparison, part]);
  const operation = comparison.nested?.ops[0];
  const source = useMemo(() => review && followUp && operation ? bindSavedFollowUp(review, followUp.log, followUp.version, operation) : null,
    [review, followUp, operation]);
  const [settled, setSettled] = useState<{ comparison: Comparison; part: string; evaluate: Evaluate; review: BoundReview | null;
    source: BoundFollowUp | null; report: CheckResult; stored: boolean }>();
  useEffect(() => {
    let current = true;
    const complete = (report: CheckResult, stored = false) => {
      if (current) setSettled({ comparison, part, evaluate, review, source, report, stored });
    };
    const load = async () => {
      const saved = review ? await readSavedApprovalEvidence(review) : null;
      if (!current) return;
      if (saved) { complete(saved, true); return; }
      const retainedFollowUp = source ? await readSavedFollowUpEvidence(source) : null;
      if (!current) return;
      if (retainedFollowUp && !('error' in retainedFollowUp)) { complete(retainedFollowUp.approval); return; }
      const report = await compareApprovedRequirements(comparison, part, input => current ? evaluate(input) : Promise.resolve(null));
      complete(report);
    };
    void load().catch(
      () => complete({ error: 'Could not check both saved revisions.' }),
    );
    return () => { current = false; };
  }, [comparison, part, evaluate, review, source]);
  const current = settled?.comparison === comparison && settled.part === part && settled.evaluate === evaluate && settled.review === review && settled.source === source
    ? settled : undefined;
  const result = current?.report;
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
    {review && result.recoveries.length > 0 && <KeepApprovalEvidence review={review} report={result} stored={!!current?.stored} onAttach={onAttach} />}
    {source && followUp && result.recoveries.length > 0 && <SavedRequirementFollowUp key={source.version.id}
      source={source} followUp={followUp} approval={result} evaluate={evaluate} onAttach={onAttach} />}
  </>;
}

export function ApprovedRequirementChecks({ comparison, evaluate, historical, followUp, savedPair, onAttach }: {
  comparison: Comparison; evaluate: Evaluate; historical: boolean; followUp?: SavedSuccessor; savedPair?: SavedApprovalPair; onAttach?: AttachApprovalEvidence;
}) {
  const [part, setPart] = useState(comparison.scopes[0].id);
  const label = historical ? 'Saved approval checks' : 'Approved requirement checks';
  return <section className="mt-2" aria-label={label}>
    <strong>{comparison.proposal} · {label}</strong>
    <NativeSelect aria-label="Requirement occurrence" value={part} onChange={event => setPart(event.currentTarget.value)}>
      {comparison.scopes.map(scope => <option key={scope.id} value={scope.id}>{scope.label}{scope.id !== 'base' ? ` (${scope.id})` : ''}</option>)}
    </NativeSelect>
    <Checks key={part} comparison={comparison} part={part} evaluate={evaluate} followUp={followUp} savedPair={savedPair} onAttach={onAttach} />
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
