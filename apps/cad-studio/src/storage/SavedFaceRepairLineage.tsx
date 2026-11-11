import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import type { Version, VersionLog } from '@barocss/cad-model/versions/log';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { checkSavedFaceRepair, type SavedFaceRepairSource } from './checkSavedFaceRepair';
import { useEvidenceSave } from './useEvidenceSave';

type Review = Parameters<typeof checkSavedFaceRepair>[0];
type Result = Awaited<ReturnType<typeof checkSavedFaceRepair>>;

function KeepFaceRepair({ result, children }: { result: Exclude<Result, { error: string }>; children?: ReactNode }) {
  const { state, save } = useEvidenceSave();
  if (result.saved || state === 'saved') return <><div role="status">Face repair evidence saved</div>{children}</>;
  const write = result.saveEvidence;
  return <>
    <Button variant="ghost" size="xs" disabled={state === 'saving'} onClick={() => save(write)}>
      {state === 'saving' ? 'Saving face repair evidence…' : 'Save face repair evidence'}
    </Button>
    {state === 'failed' && <div role="status">Could not save face repair evidence.</div>}
  </>;
}

export function SavedFaceRepairLineage({ review, log, base, versions, requirement, evaluate, attachButton }: {
  review: Review; log: VersionLog; base: Version; versions: readonly Version[]; requirement: string; evaluate: Evaluate;
  attachButton?(source: SavedFaceRepairSource): ReactNode;
}) {
  const [selected, select] = useState('');
  const target = versions.find(version => version.id === selected);
  const request = useMemo(() => target ? { review, log, base, target, requirement, evaluate } : null,
    [review, log, base, target, requirement, evaluate]);
  const [settled, setSettled] = useState<{ request: NonNullable<typeof request>; result: Result }>();
  useEffect(() => {
    if (!request) return;
    let current = true;
    const complete = (result: Result) => { if (current) setSettled({ request, result }); };
    void checkSavedFaceRepair(request.review, request.log, request.base.id, request.target.id, request.requirement,
      doc => current ? request.evaluate(doc) : Promise.resolve(null))
      .then(complete, () => complete({ error: 'Could not verify the saved face repair.' }));
    return () => { current = false; };
  }, [request]);
  if (!versions.length) return null;
  const result = settled?.request === request ? settled?.result : undefined;
  return <div className="mt-1">
    <label className="block">Face repair version
      <NativeSelect aria-label="Face repair version" value={target?.id ?? ''} onChange={event => select(event.currentTarget.value)}>
        <option value="">None</option>
        {versions.map(version => <option key={version.id} value={version.id}>{version.name ?? version.id}</option>)}
      </NativeSelect>
    </label>
    {request && <div role="region" aria-label="Saved face repair checks" aria-live="polite">
      {!result ? <div role="status">Checking saved face repair…</div>
        : 'error' in result ? <div role="status">{result.error}</div>
        : <>
          <strong>{result.requirement} · {result.proposal}</strong>
          <div>{result.base.name ?? result.base.id} · {result.from} · Unresolved</div>
          <div>{result.target.name ?? result.target.id} · {result.to} · Pass · {result.measured}{result.unit ? ` ${result.unit}` : ''}</div>
          <KeepFaceRepair key={request.target.id} result={result}>
            {attachButton?.({ kind: 'face-repair', review, log, baseId: base.id, targetId: request.target.id, requirement })}
          </KeepFaceRepair>
        </>}
    </div>}
  </div>;
}
