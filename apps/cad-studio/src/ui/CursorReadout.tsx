import { useEffect, useState, type MutableRefObject } from 'react';
import { fmt } from '@barocss/cad-model/engine/doc';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
/** The pointer's point to 0.1 mm (it renders again only when that text changes). */
export function CursorReadout({ sink }: { sink: MutableRefObject<((p: Vec3 | null) => void) | null> }) {
  const [text, setText] = useState('');
  useEffect(() => { sink.current = p => setText(p ? ` · ${p.map(v => fmt(Math.round(v * 10) / 10)).join(', ')}` : ''); return () => { sink.current = null; }; }, [sink]);
  return <>{text}</>;
}

