import { useMemo } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { geometryOf } from '@barocss/cad-model/engine/direct';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { CONTROL, FIELD } from './panelStyles';
import { Icon } from './atoms';

type XYZDraft = [string, string, string];
type MemberDraft = { curveObjectId: string; handleKey: string; sweepFeatureId: string };
export interface RouteBundleCreateDraft {
  id: string;
  tieId: string;
  anchorMM: XYZDraft;
  members: [MemberDraft, MemberDraft];
}
export interface RouteBundlePanelProps {
  doc: StudioDoc;
  directSelection: string[];
  busy: boolean;
  phase: 'idle' | 'draft' | 'preview' | 'validating' | 'ready' | 'error';
  createDraft: RouteBundleCreateDraft;
  moveDraft: XYZDraft;
  selectedBundleId: string | null;
  error?: { message: string; members?: [string?, string?] };
  onCreateDraftChange(next: RouteBundleCreateDraft): void;
  onMoveDraftChange(next: XYZDraft): void;
  onBundleChange(id: string): void;
  onCreate(): void;
  onPreview(): void;
  onApply(): void;
  onCancel(): void;
  onDetach(): void;
  onClose(): void;
}

const AXES = ['X', 'Y', 'Z'] as const;
const finite = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));
const withCoordinate = (values: XYZDraft, index: number, value: string): XYZDraft =>
  [index === 0 ? value : values[0], index === 1 ? value : values[1], index === 2 ? value : values[2]];
const PHASE_LABEL: Record<RouteBundlePanelProps['phase'], string> = {
  idle: 'Choose two curves and their copied sweeps.',
  draft: 'Draft changed. Preview before applying.',
  preview: 'Preparing the draft preview…',
  validating: 'Checking both sweeps…',
  ready: 'Preview ready. Apply to keep this edit.',
  error: 'Review the error and try again.',
};

/** A controlled editor. The App owns candidate identity, evaluation, cancellation and atomic commit. */
export function RouteBundlePanel(props: RouteBundlePanelProps) {
  const { doc, directSelection, busy, phase, createDraft, moveDraft, selectedBundleId, error,
    onCreateDraftChange, onMoveDraftChange, onBundleChange, onCreate, onPreview, onApply, onCancel, onDetach, onClose } = props;
  const curves = useMemo(() => {
    const direct = doc.direct;
    if (!direct) return [];
    return direct.objects.flatMap(object => {
      try {
        const curve = geometryOf(direct, object);
        if (curve.kind !== 'curve') return [];
        const poles = curve.controlPoints.slice(1, -1).map((at, index) => ({ key: String(index + 1), at }));
        return [{ id: object.id, name: object.name || object.id, poles, cubic: curve.degree === 3 }];
      } catch {
        // A broken source is not a selectable curve. The App's model helper remains the admission authority.
        return [];
      }
    });
  }, [doc.direct]);
  const sweeps = doc.nodes.flatMap(node => {
    if (node.kind !== 'sweep-curve' || node.suppressed || !node.id) return [];
    const profile = doc.nodes[node.sketch];
    return [{ id: node.id, name: node.name || node.id, profileId: profile?.id,
      profileName: profile?.id || `Sketch ${node.sketch + 1}` }];
  });
  const bundles = doc.routeBundles ?? [];
  const active = bundles.find(bundle => bundle.id === selectedBundleId);
  const creating = bundles.length === 0;
  const memberProblems = createDraft.members.map((member, index) => {
    const curve = curves.find(c => c.id === member.curveObjectId), sweep = sweeps.find(s => s.id === member.sweepFeatureId);
    if (error?.members?.[index]) return error.members[index];
    if (!curve) return 'Choose a curve from this document.';
    if (!curve.cubic) return 'Choose an open clamped cubic curve.';
    if (!curve.poles.some(p => p.key === member.handleKey)) return 'Choose an interior control point.';
    if (!sweep?.profileId) return 'Choose a copied sweep with a current profile.';
    const other = createDraft.members[1 - index];
    if (member.curveObjectId === other.curveObjectId) return 'Use a different curve for each member.';
    if (member.sweepFeatureId === other.sweepFeatureId) return 'Use a different copied sweep for each member.';
    return undefined;
  });
  const createValid = createDraft.id.trim() !== '' && createDraft.tieId.trim() !== '' &&
    createDraft.anchorMM.every(finite) && memberProblems.every(problem => !problem);
  const deltaValid = moveDraft.every(finite);
  const editMember = (index: 0 | 1, patch: Partial<MemberDraft>) => {
    const members: RouteBundleCreateDraft['members'] = [createDraft.members[0], createDraft.members[1]];
    members[index] = { ...members[index], ...patch };
    onCreateDraftChange({ ...createDraft, members });
  };
  const coordinates = (label: string, values: XYZDraft, onChange: (next: XYZDraft) => void) =>
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={busy}>
      <legend className="mb-1 text-[11px] text-muted-foreground">{label} · mm</legend>
      <div className="grid grid-cols-3 gap-1">{AXES.map((axis, index) => <label key={axis} className="min-w-0 text-[11px]">
        <span>{axis}</span><Input type="text" inputMode="decimal" aria-label={`${label} ${axis} mm`} aria-invalid={!finite(values[index])}
          value={values[index]} onChange={event => onChange(withCoordinate(values, index, event.target.value))} />
      </label>)}</div>
      {!values.every(finite) && <div className="hud-error" role="status">Enter a finite signed number for each axis.</div>}
    </fieldset>;

  return <aside className="card props" aria-label="Route bundle panel" onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
  }}>
    <div className="card-title">ROUTE BUNDLE
      <Button type="button" size="xs" variant="ghost" aria-label="Close Route bundle" onClick={onClose}><Icon name="close" small /></Button>
    </div>
    <p className="my-1 text-[11px] text-muted-foreground">Tie one interior control point on each of two curves. Each curve keeps its own circular sweep.</p>
    <div className="mb-2 text-[11px]" role="status" aria-label="Route bundle status" aria-live="polite">{busy ? 'Checking both sweeps…' :
      phase === 'idle' && !creating ? active ? 'Bundle linked. Enter a total translation to preview.' : 'Choose the active bundle.' : PHASE_LABEL[phase]}</div>

    {creating ? <>
      <label className={FIELD}><span>Bundle name</span><Input aria-label="Route bundle name" value={createDraft.id} disabled={busy}
        onChange={event => onCreateDraftChange({ ...createDraft, id: event.target.value })} /></label>
      <p className="my-1 text-[11px] text-muted-foreground">Use two existing open clamped cubic curves in millimetres and two matching copied sweeps. Profiles must be independent positive circles in the default XY plane.</p>
      {curves.length < 2 && <div className="empty" role="status">This document needs two direct curves. Create or open the curves, then make a copied Sweep for each.</div>}
      {([0, 1] as const).map(index => {
        const member = createDraft.members[index], curve = curves.find(c => c.id === member.curveObjectId), sweep = sweeps.find(s => s.id === member.sweepFeatureId);
        const letter = index === 0 ? 'A' : 'B';
        return <fieldset key={letter} className="my-2 min-w-0 rounded-md border border-border p-2" disabled={busy} aria-label={`Route member ${letter}`}>
          <legend className="px-1 text-[11px]">Member {letter}</legend>
          <label className={FIELD}><span>Curve</span><NativeSelect className={CONTROL} aria-label={`Member ${letter} curve`} value={member.curveObjectId}
            onChange={event => editMember(index, { curveObjectId: event.target.value, handleKey: '', sweepFeatureId: '' })}>
            <option value="">Choose curve…</option>{curves.map(c => <option key={c.id} value={c.id}>{c.name} · {c.id}{directSelection.includes(c.id) ? ' · selected' : ''}</option>)}
          </NativeSelect></label>
          <label className={FIELD}><span>Control point</span><NativeSelect className={CONTROL} aria-label={`Member ${letter} interior control point`} value={member.handleKey} disabled={!curve || busy}
            onChange={event => editMember(index, { handleKey: event.target.value })}>
            <option value="">Choose interior point…</option>{curve?.poles.map(pole => <option key={pole.key} value={pole.key}>Point {pole.key} · {pole.at.join(', ')} mm</option>)}
          </NativeSelect></label>
          <label className={FIELD}><span>Copied sweep</span><NativeSelect className={CONTROL} aria-label={`Member ${letter} copied sweep`} value={member.sweepFeatureId}
            onChange={event => editMember(index, { sweepFeatureId: event.target.value })}>
            <option value="">Choose sweep…</option>{sweeps.map(s => <option key={s.id} value={s.id}>{s.name} · {s.id}</option>)}
          </NativeSelect></label>
          {sweep && <div className="text-[10px] text-muted-foreground" aria-label={`Member ${letter} profile`}>Profile: {sweep.profileName}{sweep.profileId ? ` · ${sweep.profileId}` : ' · stable ID missing'}</div>}
          {memberProblems[index] && <div className="hud-error" role="status" aria-label={`Member ${letter} error`}>{memberProblems[index]}</div>}
        </fieldset>;
      })}
      {coordinates('Tie anchor', createDraft.anchorMM, anchorMM => onCreateDraftChange({ ...createDraft, anchorMM }))}
      <div className="mt-2 flex flex-wrap gap-1"><Button type="button" aria-label="Create route bundle" disabled={busy || !createValid} onClick={onCreate}>Create</Button></div>
    </> : <>
      <label className={FIELD}><span>Active bundle</span><NativeSelect className={CONTROL} aria-label="Active route bundle" value={selectedBundleId ?? ''} disabled={busy}
        onChange={event => onBundleChange(event.target.value)}>
        <option value="">Choose bundle…</option>{bundles.map(bundle => <option key={bundle.id} value={bundle.id}>{bundle.id}</option>)}
      </NativeSelect></label>
      {active && <>
        <div className="my-2 text-[11px]" aria-label="Route bundle members">{active.members.map((member, index) => <div key={member.id} className="py-1">
          <b>Member {index === 0 ? 'A' : 'B'}</b> · {doc.direct?.objects.find(object => object.id === member.curveObjectId)?.name || member.curveObjectId}
          <div className="text-[10px] text-muted-foreground">Point {member.handleKey} · Sweep {member.sweepFeatureId} · Profile {member.profileFeatureId}</div>
          {error?.members?.[index] && <div className="hud-error" role="status" aria-label={`Member ${index === 0 ? 'A' : 'B'} error`}>{error.members[index]}</div>}
        </div>)}</div>
        <p className="my-1 text-[11px] text-muted-foreground">Total translation from the start of this edit. Values are not added to the previous preview.</p>
        {coordinates('Total translation', moveDraft, onMoveDraftChange)}
        <div className="mt-2 flex flex-wrap gap-1"><Button type="button" aria-label="Preview route bundle translation" disabled={busy || !deltaValid} onClick={onPreview}>Preview</Button>
          <Button type="button" variant="ghost" aria-label="Detach route bundle" disabled={busy} onClick={onDetach}>Detach</Button></div>
        <p className="my-1 text-[10px] text-muted-foreground">Detach removes the link and keeps the current curves and copied sweeps.</p>
      </>}
    </>}
    {error?.message && <div className="hud-error" role="alert" aria-label="Route bundle error">{error.message}</div>}
    <div className="mt-2 flex justify-end gap-1">
      <Button type="button" variant="ghost" aria-label="Cancel route bundle edit" onClick={onCancel}>Cancel</Button>
      <Button type="button" variant="default" aria-label="Apply route bundle edit" disabled={busy || phase !== 'ready'} onClick={onApply}>Apply</Button>
    </div>
  </aside>;
}
