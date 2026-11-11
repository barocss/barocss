import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { checkInterferencePairs, type InterferenceReport } from '../app/checkInterference';
import type { EngineClient } from '../engine/client';

type Source = { input: StudioDoc };
type Run = { source: Source };
type Result = { run: Run; value: InterferenceReport | 'busy' };

/** Own the requested body list and its report for one current Studio input. */
export function useInterferenceCheck(source: Source, ownsInput: () => boolean, engine: Pick<EngineClient, 'volumes'>) {
  const active = useRef<Run | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    setResult(previous => previous?.run.source === source ? previous : null);
    return () => {
      if (active.current?.source === source) active.current = null;
    };
  }, [source]);
  const close = useCallback(() => {
    active.current = null;
    setResult(null);
  }, []);
  const start = useCallback(async (bodies: readonly BodyResult[]) => {
    if (!ownsInput()) return;
    const run = { source };
    active.current = run;
    setResult({ run, value: 'busy' });
    const current = () => active.current === run && ownsInput();
    const checked = await checkInterferencePairs(source.input, bodies, probe => engine.volumes(probe), current);
    if (checked && current()) setResult(previous => previous?.run === run && current() ? { run, value: checked } : previous);
  }, [source, ownsInput, engine]);
  return {
    result: result?.run.source === source ? result.value : null, close, start,
    ownsResult: () => result !== null && active.current === result.run && ownsInput(),
  };
}
