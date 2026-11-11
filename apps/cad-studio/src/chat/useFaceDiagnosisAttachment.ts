import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { faceDiagnosisMatchesDocument, type FaceDiagnosisSelection } from './faceDiagnosis';

type Context = { enabled: boolean; part: string | null; project: object | null; owner(): object | undefined };
export type FaceDiagnosisAttachment = { selection: FaceDiagnosisSelection; doc: StudioDoc; isCurrent(): boolean };

export function useFaceDiagnosisAttachment(context: Context) {
  const [pending, setPending] = useState<FaceDiagnosisAttachment>();
  const { enabled, part, project } = context, owner = context.owner();
  const scope = useMemo(() => ({ enabled, part, project, owner }), [enabled, part, project, owner]);
  const latest = useRef({ scope, owner: context.owner });
  latest.current = { scope, owner: context.owner };
  useEffect(() => {
    setPending(prior => prior?.isCurrent() ? prior : undefined);
  }, [scope]);

  function attach(selection: FaceDiagnosisSelection, doc: StudioDoc): boolean {
    const isCurrent = () => enabled && !!owner && latest.current.scope === scope &&
      latest.current.owner() === owner && part === selection.part;
    if (!isCurrent() || !faceDiagnosisMatchesDocument(doc, selection)) return false;
    setPending({ selection, doc, isCurrent });
    return true;
  }

  function clear(attachment: FaceDiagnosisAttachment) {
    setPending(prior => prior === attachment ? undefined : prior);
  }
  return { attach, clear, selected: pending?.isCurrent() ? pending : undefined };
}
