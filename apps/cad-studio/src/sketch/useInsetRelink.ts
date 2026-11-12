import { useCallback, useEffect, useRef, useState } from 'react';
import type { InsetRelinkPreview, InsetRelinkReply } from '../engine/client';

type SourceLabels = { before: string; after: string; target: string };
type Request = {
  labels: SourceLabels;
  current(): boolean;
  read(): Promise<InsetRelinkReply>;
  refuse(message: string): void;
  apply(preview: InsetRelinkPreview): void;
};

export type InsetRelinkReview = { labels: SourceLabels; preview?: InsetRelinkPreview };

export function useInsetRelink() {
  const owner = useRef<Request | null>(null);
  const [state, setState] = useState<(InsetRelinkReview & { owner: Request }) | null>(null);

  const cancel = useCallback(() => {
    if (!owner.current) return false;
    owner.current = null;
    setState(null);
    return true;
  }, []);

  useEffect(() => () => { owner.current = null; }, []);
  useEffect(() => {
    if (owner.current && !owner.current.current()) cancel();
  });

  const start = useCallback((request: Request) => {
    owner.current = request;
    setState({ owner: request, labels: request.labels });
    void request.read().then(reply => {
      if (owner.current !== request) return;
      if (!request.current()) { cancel(); return; }
      if ('error' in reply) { cancel(); request.refuse(reply.error); return; }
      setState({ owner: request, labels: request.labels, preview: reply.preview });
    });
  }, [cancel]);

  const apply = () => {
    const request = owner.current, preview = state?.preview;
    if (!request || state?.owner !== request || !preview || !request.current()) { cancel(); return; }
    cancel();
    request.apply(preview);
  };

  const currentReview = (): InsetRelinkReview | null =>
    state?.owner === owner.current && owner.current?.current() ? state : null;

  return { cancel, start, apply, currentReview };
}
