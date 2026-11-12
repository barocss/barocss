import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeMidpointFace } from '@barocss/cad-model/app/nativeMidpointPlane';
import type { SketchPlane } from '@barocss/cad-model/sketch/plane';
import type { MidpointPlaneReply } from '../engine/client';

type Review = { faces: readonly [NativeMidpointFace, NativeMidpointFace]; plane?: SketchPlane };
type Request = {
  faces: Review['faces'];
  current(): boolean;
  read(): Promise<MidpointPlaneReply>;
  refuse(message: string): void;
  adopt(plane: SketchPlane): void;
};

export function useMidpointSketch() {
  const request = useRef<Request | null>(null);
  const [review, setReview] = useState<(Review & { owner: Request }) | null>(null);
  const cancel = useCallback(() => {
    if (!request.current) return false;
    request.current = null;
    setReview(null);
    return true;
  }, []);

  useEffect(() => () => { request.current = null; }, []);
  useEffect(() => {
    if (request.current && !request.current.current()) cancel();
  });

  const start = useCallback((next: Request) => {
    request.current = next;
    setReview({ owner: next, faces: next.faces });
    void next.read().then(result => {
      if (request.current !== next) return;
      if (!next.current()) { cancel(); return; }
      if ('error' in result) { cancel(); next.refuse(result.error); return; }
      setReview({ owner: next, faces: next.faces, plane: result.plane });
    });
  }, [cancel]);

  const adopt = () => {
    const next = request.current, plane = review?.plane;
    if (!next || review?.owner !== next || !plane || !next.current()) { cancel(); return; }
    cancel();
    next.adopt(plane);
  };

  const currentReview = (): Review | null => review?.owner === request.current && request.current?.current() ? review : null;
  return { currentReview, start, cancel, adopt };
}
