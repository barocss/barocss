import { fmt } from '@barocss/cad-model/engine/doc';
import { linearSpanSpacing } from '@barocss/cad-model/engine/linearSpanPattern';

export function LinearSpanSpacing({ span, count }: { span: number; count: number }) {
  const result = linearSpanSpacing(span, count);
  const pitch = 'spacing' in result ? result.spacing : undefined;
  const label = pitch === undefined ? '—' : `${pitch < 0.005 ? pitch.toPrecision(3) : fmt(pitch)} mm`;
  return <div className="field"><span>Spacing</span><output aria-label="Spacing">{label}</output></div>;
}
