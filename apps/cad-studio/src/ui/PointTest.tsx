import { useEffect, useState } from 'react';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { pointInBody } from '@barocss/cad-model/app/measure';
/** A point tried against a body: inside, outside or on it. */
export function PointTest({ mesh }: { mesh: BodyResult['mesh'] }) {
  const [p, setP] = useState<[number, number, number]>([0, 0, 0]), [res, setRes] = useState<string | null>(null);
  useEffect(() => setRes(null), [mesh, p]);
  return <div className="point-test">
    <div className="kv"><span>Point test</span><span className="pt-xyz">{(['X', 'Y', 'Z'] as const).map((a, k) => <input key={a} type="number" step="any" aria-label={`Point ${a}`} value={p[k]} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) setP(q => q.map((x, j) => j === k ? v : x) as typeof q); }} onKeyDown={e => e.stopPropagation()} />)}
      <button className="ghost small" aria-label="Test the point" onClick={() => setRes(pointInBody(mesh, p))}>Test</button></span></div>
    {res && <div className="kv"><span /><b aria-label="Point is">{res === 'inside' ? 'inside the body' : res === 'outside' ? 'outside the body' : 'on its surface'}</b></div>}
  </div>;
}

