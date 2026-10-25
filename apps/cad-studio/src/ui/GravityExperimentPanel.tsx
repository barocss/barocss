import { useEffect, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { BarocssError, Robot } from '@barocss/cad-model/api';
import { GravityExperimentRecord, type GravityExperimentMaterialPreview } from '@barocss/cad-model/api/experimentRecord';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { CONTROL, FIELD } from './panelStyles';
import { downloadBytes } from './files';

type Options = Parameters<Robot['gravityExperiment']>[0];
type Inputs = { joint: string; angle: string; x: string; y: string; z: string };
type RecordEntry = { record: GravityExperimentRecord; historical: boolean; filename?: string };

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
  const [entry, setEntry] = useState<RecordEntry | null>(null);
  const [pinned, setPinned] = useState<(RecordEntry & { preview: GravityExperimentRecord['preview'] }) | null>(null);
  const [prefilled, setPrefilled] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const epoch = useRef(0), fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { epoch.current++; }, []);
  const [failure, setFailure] = useState<string | null>(null);
  const [failureKind, setFailureKind] = useState<'Refused' | 'Failed' | null>(null);
  let options: Options | null = null;
  try { options = optionsOf(input); } catch { /* Incomplete fields remain explicit, without defaults. */ }
  let current = false;
  if (entry && options) {
    try { current = entry.record.matches(doc, options); } catch { /* Unmatchable inputs leave the old result stale. */ }
  }
  const preview = entry?.record.preview;
  const recordedDocumentMatch = (record: GravityExperimentRecord, value: GravityExperimentRecord['preview']) => {
    try {
      return record.matches(doc, { values: { [value.joint]: value.angle }, gravity: value.gravity })
        ? 'Matches current document at its recorded inputs.' : 'Different current document.';
    } catch { return 'Document match unavailable.'; }
  };
  const comparisonMismatch = pinned && preview ? [
    pinned.preview.joint !== preview.joint && 'joint',
    pinned.preview.occurrence !== preview.occurrence && 'occurrence',
    pinned.preview.coordinateFrame !== preview.coordinateFrame && 'coordinate frame',
    !pinned.preview.axis.point.every((value, index) => value === preview.axis.point[index]) && 'axis origin',
    !pinned.preview.axis.direction.every((value, index) => value === preview.axis.direction[index]) && 'axis direction',
  ].filter(Boolean).join(', ') : '';
  // Both typed previews use the record contract's degree/mm/mm/s²/N·mm units.
  const torqueDifference = pinned && preview && !comparisonMismatch ? preview.torque - pinned.preview.torque : null;
  let materialPreview: GravityExperimentMaterialPreview | null = null;
  let materialUnavailable = false;
  if (entry) {
    try { materialPreview = entry.record.materialPreview; } catch { materialUnavailable = true; }
  }
  const invalidateRead = () => { epoch.current++; setReading(false); };
  const fail = (error: unknown) => {
    const refused = error instanceof BarocssError && (error.code === 'VALUE' || error.code === 'ROBOT');
    setFailureKind(refused ? 'Refused' : 'Failed');
    setFailure(`${refused ? `Refused (${error.code})` : 'Operation failed'}: ${error instanceof Error ? error.message : String(error)}`);
  };
  const change = (key: keyof Inputs, value: string) => {
    invalidateRead();
    setPrefilled(null);
    setInput(previous => ({ ...previous, [key]: value }));
    setFailure(null);
    setFailureKind(null);
  };
  const calculate = () => {
    invalidateRead();
    try {
      const next = new Robot(doc).gravityExperiment(optionsOf(input));
      setEntry({ record: next.record(), historical: false });
      setFailure(null);
      setFailureKind(null);
    } catch (error) {
      fail(error);
    }
  };
  const open = async (file: File) => {
    const request = ++epoch.current;
    setReading(true);
    try {
      const text = await file.text();
      if (request !== epoch.current) return;
      const record = GravityExperimentRecord.parse(text);
      if (request !== epoch.current) return;
      const loaded = record.preview;
      setEntry({ record, historical: true, filename: file.name });
      setInput({ joint: loaded.joint, angle: String(loaded.angle), x: String(loaded.gravity[0]), y: String(loaded.gravity[1]), z: String(loaded.gravity[2]) });
      setPrefilled(file.name);
      setFailure(null);
      setFailureKind(null);
    } catch (error) {
      if (request === epoch.current) fail(error);
    } finally {
      if (request === epoch.current) setReading(false);
    }
  };
  const download = () => {
    if (!entry) return;
    try {
      const filename = entry.historical ? 'static-gravity-historical-record.json' : current && !failure ? 'static-gravity-calculation-record.json' : 'static-gravity-previous-record.json';
      downloadBytes(new TextEncoder().encode(JSON.stringify(entry.record.toJSON(), null, 2)), filename, 'application/json');
    } catch (error) { fail(error); }
  };
  const status = failure ? `${failureKind === 'Refused' ? 'Operation refused.' : 'Operation failed.'}` : entry?.historical
    ? `Historical record; not recalculated. ${current ? 'Document and inputs match.' : 'Stale: document or inputs differ.'}` : preview
    ? (current ? 'Calculation complete. Inputs match this document.' : 'Stale result. The document or inputs changed. Calculate again.')
    : 'No calculation result.';
  const shortStatus = failureKind ?? (entry?.historical ? (current ? 'Historical · Match' : 'Historical · Stale') : preview ? (current ? 'Complete' : 'Stale') : 'Not calculated');
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
    <Button type="button" variant="ghost" onClick={calculate}>Calculate holding torque</Button>
    <Button type="button" variant="ghost" disabled={!entry} onClick={download}>{entry?.historical ? 'Download historical record' : current && !failure ? 'Download calculation record' : 'Download previous calculation record'}</Button>
    <Button type="button" variant="ghost" onClick={() => { invalidateRead(); fileInput.current?.click(); }}>Open gravity record</Button>
    <Button type="button" variant="ghost" disabled={!entry} onClick={() => {
      invalidateRead();
      if (entry) setPinned({ ...entry, preview: entry.record.preview });
    }}>{pinned ? 'Replace pinned record' : 'Pin this record'}</Button>
    <Button type="button" variant="ghost" disabled={!pinned} onClick={() => { invalidateRead(); setPinned(null); }}>Unpin record</Button>
    <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Gravity record file" onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void open(file);
    }} />
    {reading && <div className="muted" role="status">Reading gravity record…</div>}
    {prefilled && <div className="muted">Inputs were loaded from the opened record: {prefilled}.</div>}
    {failure && <div className="hud-error" role="alert">{failure}</div>}
    <div className="muted" role="status">{status}</div>
    {pinned && preview && entry && <details>
      <summary>Compare records</summary>
      <p className="muted">Pinned locally. Not saved in the document. Cleared when this panel is removed.</p>
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Pinned record', record: pinned.record, value: pinned.preview, historical: pinned.historical, filename: pinned.filename },
          { label: 'Current entry', record: entry.record, value: preview, historical: entry.historical, filename: entry.filename },
        ].map(({ label, record, value, historical, filename }) => <div key={label} className="min-w-0 flex-1 basis-48 break-words" aria-label={label}>
          <b>{label}</b>
          <div className="muted">{historical ? 'Historical record; not recalculated.' : 'Calculated record.'}</div>
          <div className="muted">{recordedDocumentMatch(record, value)}</div>
          {historical && <div className="muted">Opened record: {filename}</div>}
          <div className="kv muted">Joint: {value.joint}</div>
          <div className="kv muted">Occurrence: {value.occurrence}</div>
          <div className="kv muted">Angle: {value.angle} degree</div>
          <div className="kv muted">Gravity XYZ: [{value.gravity.join(', ')}] mm/s²</div>
          <div className="kv">Recorded torque: <b>{value.torque} N·mm</b></div>
          <div className="muted">Coordinate frame: {value.coordinateFrame}</div>
          <div className="muted">Axis origin XYZ: [{value.axis.point.join(', ')}] mm</div>
          <div className="muted">Axis direction XYZ: [{value.axis.direction.join(', ')}]</div>
        </div>)}
      </div>
      {comparisonMismatch ? <div className="muted">Torque difference not shown. Recorded {comparisonMismatch} differ.</div>
        : torqueDifference !== null && Number.isFinite(torqueDifference) ? <div className="kv muted">Recorded torque difference (current − pinned): {torqueDifference} N·mm</div>
        : <div className="muted">Torque difference not shown. The difference is outside the finite numeric range.</div>}
      <p className="muted">Recorded values only. The difference does not establish a cause, accuracy, measured validation or producer compatibility.</p>
    </details>}
    {preview && <div aria-label="Static gravity calculation result">
      <div className="kv muted">{entry?.historical ? 'Historical record; not recalculated.' : failure || !current ? 'Previous calculation result.' : 'Current calculation result.'}</div>
      {entry?.historical && <div className="kv muted">Opened record: {entry.filename}</div>}
      <div className="kv">Static holding torque <b>{preview.torque} N·mm</b></div>
      <div className="kv muted">Recorded joint: {preview.joint}</div>
      <div className="kv muted">Recorded occurrence: {preview.occurrence}</div>
      <div className="kv muted">Axis origin XYZ: [{preview.axis.point.join(', ')}] mm</div>
      <div className="kv muted">Recorded angle: {preview.angle} degree</div>
      <div className="kv muted">Recorded gravity XYZ: [{preview.gravity.join(', ')}] mm/s²</div>
      <div className="kv muted">{preview.coordinateFrame}</div>
      <div className="kv muted">Positive angle follows the joint axis direction [{preview.axis.direction.join(', ')}] by the right-hand rule.</div>
      <ul className="muted">{preview.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>
      <details>
        <summary>Recorded material inputs</summary>
        <p className="muted">Recorded mass inputs and catalogue declarations. These do not establish agreement, authenticity, measured properties or native inertia provenance.</p>
        {materialUnavailable ? <div className="muted">Recorded material inputs cannot be displayed.</div>
          : materialPreview === null ? <div className="muted">Not recorded.</div>
          : materialPreview.bodies.length === 0 ? <div className="muted">No body entries recorded.</div>
          : materialPreview.bodies.map(({ link, body, materialSnapshot: snapshot, inertiaSource }, index) => <div key={index} className="min-w-0 break-words py-0.5">
            <div className="kv muted">Recorded body: {link} / {body}</div>
            {snapshot === null ? <div className="muted">Material snapshot: Not recorded.</div> : <>
              <div className="kv muted">Used mass density: {snapshot.densityGPerCm3} g/cm³</div>
              <div className="kv muted">Catalogue declaration density: {snapshot.catalogueDensityGPerCm3 === null ? 'Not recorded' : `${snapshot.catalogueDensityGPerCm3} g/cm³`}</div>
              <div className="kv muted">Body material ID: {snapshot.bodyMaterialId === null ? 'Unset' : snapshot.bodyMaterialId === '' ? 'Empty ID' : snapshot.bodyMaterialId}</div>
              <div className="kv muted">Input material ID: {snapshot.inputMaterialId === null ? 'Unset' : snapshot.inputMaterialId === '' ? 'Empty ID' : snapshot.inputMaterialId}</div>
              <div className="kv muted">Resolved material ID: {snapshot.resolvedMaterialId}</div>
              <div className="kv muted">Fallback: {snapshot.fallback}</div>
              <div className="kv muted">Density source ID: {snapshot.densitySourceId === null ? 'Not recorded' : snapshot.densitySourceId === '' ? 'Empty string' : snapshot.densitySourceId}</div>
              <div className="kv muted">Density source text: {snapshot.densitySourceText === null ? 'Not recorded' : snapshot.densitySourceText === '' ? 'Empty string' : snapshot.densitySourceText}</div>
              {snapshot.densityPage ? <div className="muted">
                <div>Source page URL: {snapshot.densityPage.url}</div>
                <div>Source page read: {snapshot.densityPage.read}</div>
                <div>Source page label: {snapshot.densityPage.label}</div>
                {snapshot.densityPage.note !== undefined && <div>Source page note: {snapshot.densityPage.note}</div>}
              </div> : <div className="muted">Source page: Not recorded.</div>}
              <div className="kv muted">Library version: {snapshot.libraryVersion === '' ? 'Empty string' : snapshot.libraryVersion}</div>
              <div className="kv muted">Catalogue row estimate: {snapshot.rowEstimate === null ? 'Not recorded' : String(snapshot.rowEstimate)}</div>
              <div className="kv muted">Basis: {snapshot.basis}</div>
            </>}
            <div className="kv muted">Inertia source: {inertiaSource ?? 'Not recorded'}</div>
            {inertiaSource === 'callback-override' && <div className="muted">The density records the mass input. It does not establish the callback inertia's native provenance.</div>}
          </div>)}
      </details>
    </div>}
    </details>
  </aside>;
}
