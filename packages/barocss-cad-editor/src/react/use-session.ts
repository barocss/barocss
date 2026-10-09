import { useEffect, useState } from 'react';
import type { CadEditorSession, CadEditorSnapshot } from '../types.js';

/** The session deliberately returns owned copies, not stable store identities. */
export function useCadEditorSnapshot(session: CadEditorSession): CadEditorSnapshot {
  const [value, setValue] = useState(() => ({ session, snapshot: session.getSnapshot() }));
  useEffect(() => {
    const refresh = () => setValue({ session, snapshot: session.getSnapshot() });
    const unsubscribe = session.subscribe(refresh);
    refresh();
    return unsubscribe;
  }, [session]);
  return value.session === session ? value.snapshot : session.getSnapshot();
}
