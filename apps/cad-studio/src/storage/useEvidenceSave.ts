import { useState } from 'react';

export function useEvidenceSave() {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const save = (write: () => Promise<void>) => {
    setState('saving');
    void write().then(() => setState('saved'), () => setState('failed'));
  };
  return { state, save };
}
