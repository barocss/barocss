import { Button } from '@/components/ui/button';
import type { useMidpointSketch } from '../sketch/useMidpointSketch';

type Controller = ReturnType<typeof useMidpointSketch>;

export function MidpointSketchReview({ review, cancel, adopt }: Pick<Controller, 'cancel' | 'adopt'> & { review: NonNullable<ReturnType<Controller['currentReview']>> }) {
  const { faces, plane } = review;
  const xyz = (values: readonly number[]) => values.map(value => Number(value.toPrecision(12))).join(', ');
  return <aside className="card props" aria-label="Midpoint sketch" aria-busy={!plane}>
    <div className="card-title">MIDPOINT SKETCH</div>
    <p>{faces[0].name} · {faces[1].name}</p>
    {plane ? <>
      <p>Origin (mm) · {xyz(plane.origin)}</p>
      <p>Normal · {xyz(plane.normal)}</p>
      <p>Independent plane snapshot</p>
    </> : <p role="status">Checking the two faces…</p>}
    <div className="row-actions">
      <Button type="button" variant="ghost" onClick={cancel}>Cancel</Button>
      <Button type="button" disabled={!plane} onClick={adopt}>Start sketch</Button>
    </div>
  </aside>;
}
