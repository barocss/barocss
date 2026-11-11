import { useEffect, useMemo, useState } from 'react';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import type { Version, VersionLog } from '@barocss/cad-model/versions/log';
import { NativeSelect } from '@/components/ui/native-select';
import { Button } from '@/components/ui/button';
import { checkSavedFollowUpRepair } from './savedFollowUpRepair';
import { useEvidenceSave } from './useEvidenceSave';

type Source = Parameters<typeof checkSavedFollowUpRepair>[0];
type Result = Awaited<ReturnType<typeof checkSavedFollowUpRepair>>;
const unitText = (unit?: string) => unit === 'mm3' ? ' mm³' : unit === 'mm2' ? ' mm²' : unit ? ' ' + unit : '';

function KeepRepairEvidence({ result }: { result: Exclude<Result, { error: string }> }) {
  const { state, save } = useEvidenceSave();
  if (result.saved || state === 'saved') return <div role="status">Repair evidence saved</div>;
  const write = result.saveEvidence;
  return <>
    <Button variant="ghost" size="xs" disabled={state === 'saving'} onClick={() => save(write)}>
      {state === 'saving' ? 'Saving repair evidence…' : 'Save repair evidence'}
    </Button>
    {state === 'failed' && <div role="status">Could not save repair evidence.</div>}
  </>;
}

export function SavedRepairChecks({ source, log, versions, evaluate }: {
  source: Source; log: VersionLog; versions: readonly Version[]; evaluate: Evaluate;
}) {
  const [selected, select] = useState('');
  const id = versions.some(version => version.id === selected) ? selected : '';
  const request = useMemo(() => id ? { source, log, id, evaluate } : null, [source, log, id, evaluate]);
  const [settled, setSettled] = useState<{ request: NonNullable<typeof request>; result: Result }>();
  useEffect(() => {
    if (!request) return;
    let current = true;
    const complete = (result: Result) => { if (current) setSettled({ request, result }); };
    void checkSavedFollowUpRepair(request.source, request.log, request.id,
      doc => current ? request.evaluate(doc) : Promise.resolve(null))
      .then(complete, () => complete({ error: 'Could not verify the saved repair.' }));
    return () => { current = false; };
  }, [request]);
  const result = settled?.request === request ? settled?.result : undefined;
  return <div className="mt-1">
    <label className="block">Repair version
      <NativeSelect aria-label="Repair version" value={id} onChange={event => select(event.currentTarget.value)}>
        <option value="">None</option>
        {versions.map(version => <option key={version.id} value={version.id}>{version.name ?? version.id}</option>)}
      </NativeSelect>
    </label>
    {id && <div role="region" aria-label="Saved repair checks" aria-live="polite">
      {!result ? <div role="status">Checking saved repair…</div>
        : 'error' in result ? <div role="status">{result.error}</div>
        : <>
          <strong>{result.proposal} · {result.version.name ?? result.version.id}</strong>
          {result.recoveries.map(({ id: requirement, from, to, unit }) => {
            const suffix = unitText(unit);
            return <div key={requirement}><strong>{requirement}</strong> · <span>Fail → Pass</span>
              {from !== null && to !== null && <span className="ml-2 inline-block whitespace-nowrap tabular-nums">{from}{suffix} → {to}{suffix}</span>}
            </div>;
          })}
          <KeepRepairEvidence result={result} />
        </>}
    </div>}
  </div>;
}
