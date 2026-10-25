import { useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { BarocssError, Robot } from '@barocss/cad-model/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { CONTROL, FIELD } from './panelStyles';

type Experiment = ReturnType<Robot['gravityExperiment']>;
type Options = Parameters<Robot['gravityExperiment']>[0];
type Inputs = { joint: string; angle: string; x: string; y: string; z: string };

function optionsOf(input: Inputs): Options {
  const joint = input.joint.trim();
  if (!joint) throw new BarocssError('VALUE', 'Choose the moving joint ID.');
  const number = (text: string, label: string) => {
    if (!text.trim() || !Number.isFinite(Number(text))) {
      throw new BarocssError('VALUE', `${label} requires an explicit finite number.`);
    }
    return Number(text);
  };
  return {
    values: { [joint]: number(input.angle, 'Angle') },
    gravity: [number(input.x, 'Gravity X'), number(input.y, 'Gravity Y'), number(input.z, 'Gravity Z')],
  };
}

/** A local, detached static calculation. It does not change the document or the viewport pose. */
export function GravityExperimentPanel({ doc, joints }: { doc: StudioDoc; joints: readonly { key: string; type: string }[] }) {
  const [input, setInput] = useState<Inputs>({ joint: '', angle: '', x: '', y: '', z: '' });
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [failureKind, setFailureKind] = useState<'Refused' | 'Failed' | null>(null);
  let options: Options | null = null;
  try { options = optionsOf(input); } catch { /* Incomplete fields remain explicit, without defaults. */ }
  let current = false;
  if (experiment && options) {
    try { current = experiment.matches(doc, options); } catch { /* Unmatchable inputs leave the old result stale. */ }
  }
  const report = experiment?.report;
  const change = (key: keyof Inputs, value: string) => {
    setInput(previous => ({ ...previous, [key]: value }));
    setFailure(null);
    setFailureKind(null);
  };
  const calculate = () => {
    try {
      const next = new Robot(doc).gravityExperiment(optionsOf(input));
      setExperiment(next);
      setFailure(null);
      setFailureKind(null);
    } catch (error) {
      const refused = error instanceof BarocssError && (error.code === 'VALUE' || error.code === 'ROBOT');
      setFailureKind(refused ? 'Refused' : 'Failed');
      setFailure(`${refused ? `Refused (${error.code})` : 'Calculation failed'}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const status = failure ? `${failureKind === 'Refused' ? 'Calculation refused.' : 'Calculation failed.'}` : report
    ? (current ? 'Calculation complete. Inputs match this document.' : 'Stale result. The document or inputs changed. Calculate again.')
    : 'No calculation result.';
  const shortStatus = failureKind ?? (report ? (current ? 'Complete' : 'Stale') : 'Not calculated');
  return <aside className="card props min-w-0 break-words text-[11px]" aria-label="Static gravity experiment"
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <details>
    <summary className="card-title">STATIC GRAVITY <span className="muted" aria-live="polite">{shortStatus}</span></summary>
    <p className="muted">One open revolute or continuous joint. Enter a prescribed stationary pose and world XYZ gravity. Positive angles follow the joint axis by the right-hand rule. The entered pose is used; the viewport pose is unchanged.</p>
    <label className={FIELD}><span>Joint ID</span>
      <NativeSelect className={CONTROL} aria-label="Gravity experiment joint ID" value={input.joint} onChange={event => change('joint', event.target.value)}>
        <option value="">Choose a joint</option>
        {input.joint && !joints.some(joint => joint.key === input.joint) && <option value={input.joint}>Previous joint: {input.joint}</option>}
        {joints.map(joint => <option key={joint.key} value={joint.key}>{joint.key} ({joint.type})</option>)}
      </NativeSelect></label>
    <label className={FIELD}><span>Angle (degree)</span>
      <Input className={CONTROL} type="number" step="any" aria-label="Gravity experiment angle (degree)" value={input.angle} onChange={event => change('angle', event.target.value)} /></label>
    {(['x', 'y', 'z'] as const).map(axis => <label className={FIELD} key={axis}><span>Gravity {axis.toUpperCase()} (mm/s²)</span>
      <Input className={CONTROL} type="number" step="any" aria-label={`Gravity ${axis.toUpperCase()} (mm/s²)`} value={input[axis]} onChange={event => change(axis, event.target.value)} /></label>)}
    <Button variant="ghost" onClick={calculate}>Calculate holding torque</Button>
    {failure && <div className="hud-error" role="alert">{failure}</div>}
    <div className="muted" role="status">{status}</div>
    {report && <div aria-label="Static gravity calculation result">
      <div className="kv muted">{failure || !current ? 'Previous calculation result.' : 'Current calculation result.'}</div>
      <div className="kv">Static holding torque <b>{report.result.torques[report.scope.joint]} N·mm</b></div>
      <div className="kv muted">Calculated joint: {report.scope.joint}</div>
      <div className="kv muted">Calculated angle: {report.inputs.values[report.scope.joint]} degree</div>
      <div className="kv muted">Calculated gravity XYZ: [{report.inputs.gravity.join(', ')}] mm/s²</div>
      <div className="kv muted">{report.scope.coordinateFrame}</div>
      <div className="kv muted">Positive angle follows the joint axis direction [{report.scope.axis.direction.join(', ')}] by the right-hand rule.</div>
      <ul className="muted">{report.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul>
    </div>}
    </details>
  </aside>;
}
