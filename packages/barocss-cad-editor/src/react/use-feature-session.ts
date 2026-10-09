import { useEffect, useState } from 'react';
import type { CadEditorFeatureSession, CadEditorFeatureSnapshot } from '../feature-types.js';

/** Feature sessions return copied native data, not stable store identities. */
export function useCadEditorFeatureSnapshot(session: CadEditorFeatureSession): CadEditorFeatureSnapshot {
  const [value, setValue] = useState(() => ({ session, snapshot: session.getSnapshot() }));
  useEffect(() => {
    const refresh = () => setValue({ session, snapshot: session.getSnapshot() });
    const unsubscribe = session.subscribe(refresh);
    refresh();
    return unsubscribe;
  }, [session]);
  return value.session === session ? value.snapshot : session.getSnapshot();
}
