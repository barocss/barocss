import { useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { InsetRelinkReview } from '../sketch/useInsetRelink';

function RingThumbnail({ rings }: { rings: NonNullable<InsetRelinkReview['preview']>['rings'] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context) return;
    const points = rings.flat();
    const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    for (const [x, y] of points) {
      lo[0] = Math.min(lo[0], x); hi[0] = Math.max(hi[0], x);
      lo[1] = Math.min(lo[1], y); hi[1] = Math.max(hi[1], y);
    }
    const width = hi[0] - lo[0], height = hi[1] - lo[1];
    if (!(width > 0 && height > 0)) return;
    const scale = Math.min((element.width - 32) / width, (element.height - 32) / height);
    const centerX = (lo[0] + hi[0]) / 2, centerY = (lo[1] + hi[1]) / 2;
    context.clearRect(0, 0, element.width, element.height);
    context.beginPath();
    for (const ring of rings) {
      ring.forEach(([x, y], index) => {
        const u = element.width / 2 + (x - centerX) * scale;
        const v = element.height / 2 - (y - centerY) * scale;
        if (index === 0) context.moveTo(u, v); else context.lineTo(u, v);
      });
      context.closePath();
    }
    context.fillStyle = '#7fb2f033';
    context.fill('evenodd');
    context.strokeStyle = '#7fb2f0';
    context.lineWidth = 2;
    context.stroke();
  }, [rings]);
  return <canvas ref={canvas} width={500} height={160} className="w-full" aria-label="Resolved ring preview" role="img" />;
}

export function InsetSourceReview({ review, apply, cancel }: { review: InsetRelinkReview; apply(): void; cancel(): void }) {
  const { labels, preview } = review;
  const cancelButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { cancelButton.current?.focus(); }, []);
  const format = (value: number) => Number(value.toPrecision(12));
  return <aside className="card props" aria-label="Inset source replacement" aria-busy={!preview}>
    <div className="card-title">INSET SOURCE</div>
    <p>{labels.before} → {labels.after}</p>
    <p>Target · {labels.target}</p>
    {preview ? <>
      <RingThumbnail rings={preview.rings} />
      <p>Plane origin (mm) · {preview.plane.origin.map(format).join(', ')}</p>
      <p>Normal · {preview.plane.normal.map(format).join(', ')}</p>
      <p>Extrude · {format(preview.volume)} mm³</p>
    </> : <p role="status">Checking the replacement face…</p>}
    <div className="row-actions">
      <Button ref={cancelButton} type="button" variant="ghost" onClick={cancel}>Cancel</Button>
      <Button type="button" disabled={!preview} onClick={apply}>Apply source</Button>
    </div>
  </aside>;
}
