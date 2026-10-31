import { useEffect, useState } from 'react';
import type { PartInstance, StudioDoc } from '@barocss/cad-model/engine/doc';
import { stepsOf } from '@barocss/cad-model/assembly/steps';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { DockSection } from '../layout/DockSection';
import { Icon } from './atoms';
import { FIELD, TICK } from './panelStyles';
import type { StepOffer } from '../app/assemblySteps';

// Roadmap 10 ⑥: the Steps panel — an ordered explanation of the assembly, part by part. The primary controls are the step list, Prev and
// Next, the shown step's parts and its explode scale, the view; the note, the faded-waiting-parts toggle and the notes about missing
// parts are under Details, closed. Presentation only: the parts are never moved (the viewer hides, highlights and explodes them for display).
// Every edit is one undo step (the App's); the position (which step is shown) is the session's.

const EXPLODES = [0, 0.5, 1, 2] as const;

/** A text box that keeps what is typed and commits it (one undo step) when it is left or Enter is pressed; an empty value is not committed when `required`. */
function CommitText({ value, onCommit, required, multiline, ...rest }: { value: string; onCommit(v: string): void; required?: boolean; multiline?: boolean; 'aria-label': string; className?: string; maxLength?: number }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const done = () => { if (draft === value) return; if (required && !draft.trim()) { setDraft(value); return; } onCommit(draft); };
  if (multiline) return <textarea {...rest} className={'rounded-md border border-input bg-transparent px-1 text-[11px] ' + (rest.className ?? '')} value={draft} onChange={e => setDraft(e.target.value)} onBlur={done} />;
  return <Input {...rest} type="text" value={draft} onChange={e => setDraft(e.target.value)} onBlur={done} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

export function AssemblyStepsPanel({ doc, index, offer, faded, problems, onGo, onFaded, onNew, onRename, onNote, onExplode, onAddSelected, onTakeOut, onCaptureView, onResetView, onMove, onDelete, onClose }: {
  doc: StudioDoc; index: number;
  /** The one selected part's step (to go to) or that it is in none. */
  offer: StepOffer;
  faded: boolean;
  /** The steps' notes about parts that are gone or in no step, in words. */
  problems: readonly string[];
  onGo(index: number): void; onFaded(on: boolean): void;
  onNew(): void; onRename(id: string, name: string): void; onNote(id: string, note: string): void; onExplode(id: string, scale: number): void;
  onAddSelected(id: string): void; onTakeOut(id: string, part: string): void;
  onCaptureView(id: string): void; onResetView(): void; onMove(id: string, to: number): void; onDelete(id: string): void; onClose(): void;
}) {
  const steps = stepsOf(doc), n = steps.length, step = steps[index], instances: readonly PartInstance[] = doc.instances ?? [];
  const nameOf = (id: string) => instances.find(i => i.id === id)?.name ?? id, placed = (id: string) => instances.some(i => i.id === id);
  return <aside className="card props" aria-label="Assembly steps panel"><DockSection id="steps" title="Steps" summary={n ? `${index + 1}/${n}` : '0'}
    actions={<Button size="xs" variant="ghost" aria-label="Close steps" title="Close the steps: all parts are shown again" onClick={onClose}><Icon name="close" small /></Button>}>
    <div className="flex flex-col gap-1.5">
      <Button variant="default" aria-label="New step from selection" title="The selected parts become a new last step (a part is in one step only)" onClick={onNew}><Icon name="add" small />New step from selection</Button>
      {!n && <div className="empty" role="status">No steps yet. Select the parts a step adds, in the Browser or the view, then New step from selection.</div>}
      {step && <>
        <div className="flex items-center justify-between gap-1">
          <Button size="xs" variant="ghost" aria-label="Previous step" title="Previous step" disabled={index <= 0} onClick={() => onGo(index - 1)}>Prev</Button>
          <span role="status" aria-label="Step position" className="text-[11px] font-medium">Step {index + 1} of {n}</span>
          <Button size="xs" variant="ghost" aria-label="Next step" title="Next step" disabled={index >= n - 1} onClick={() => onGo(index + 1)}>Next<Icon name="chevron_right" small /></Button>
        </div>
        <ul className="m-0 flex list-none flex-col gap-px p-0" role="list" aria-label="Steps">
          {steps.map((s, k) => <li key={s.id}><button className={'ol' + (k === index ? ' sel' : '')} aria-label={`Go to step ${k + 1}: ${s.name}`} aria-current={k === index ? 'step' : undefined} data-step={s.id} onClick={() => onGo(k)}>
            <span className="min-w-0 flex-1 truncate">{k + 1}. {s.name}</span><span className="muted">{s.add.length}</span></button></li>)}
        </ul>
        {offer?.kind === 'go' && <Button size="xs" variant="secondary" aria-label="Go to its step" title={`${nameOf(offer.part)} is introduced in step ${offer.index + 1}`} onClick={() => onGo(offer.index)}>Go to its step: {offer.name}</Button>}
        {offer?.kind === 'none' && <div className="text-[11px] text-muted-foreground" role="status">{nameOf(offer.part)} is in no step.</div>}
        <label className={FIELD}><span>Name</span><CommitText key={step.id} aria-label="Step name" className="w-36" maxLength={60} required value={step.name} onCommit={v => onRename(step.id, v)} /></label>
        <div className="flex flex-col gap-0.5" role="group" aria-label="Parts of this step">
          <div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">Parts</span>
            <Button size="xs" variant="ghost" aria-label="Add selected parts to this step" title="Add the parts selected in the Browser or the view to this step" onClick={() => onAddSelected(step.id)}>Add selected</Button></div>
          <div className="flex flex-wrap gap-1">
            {step.add.length ? step.add.map(id => <span key={id} data-part={id} className={'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[11px]' + (placed(id) ? ' border-border' : ' border-[var(--warn,#d19a3b)]')}
              title={placed(id) ? undefined : `${id} is not placed now: the step keeps it`}>{nameOf(id)}{!placed(id) && ' (missing)'}
              <button className="tool tiny" aria-label={`Take ${nameOf(id)} out of this step`} onClick={() => onTakeOut(step.id, id)}><Icon name="close" small /></button></span>)
              : <span className="text-[11px] text-muted-foreground">None: select a part, then Add selected.</span>}
          </div>
        </div>
        <label className={FIELD}><span>Explode</span>
          <NativeSelect aria-label="Step explode" className="w-24" value={String(step.explode ?? 0)} onChange={e => onExplode(step.id, Number(e.target.value))}>
            {EXPLODES.map(k => <option key={k} value={k}>{k ? `×${k}` : 'Off'}</option>)}</NativeSelect></label>
        <div className="flex flex-wrap gap-1">
          <Button size="xs" aria-label="Capture view" title={step.view ? 'Record the camera as this step\'s recommended view (replacing the last one)' : 'Record the camera as this step\'s recommended view'} onClick={() => onCaptureView(step.id)}>Capture view{step.view ? ' ·' : ''}</Button>
          <Button size="xs" aria-label="Reset view" disabled={!step.view} title={step.view ? 'Back to the recommended view' : 'No view recorded for this step'} onClick={onResetView}>Reset view</Button>
        </div>
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" aria-label="Move step up" title="Earlier in the order" disabled={index <= 0} onClick={() => onMove(step.id, index - 1)}><Icon name="expand_less" small /></Button>
          <Button size="xs" variant="ghost" aria-label="Move step down" title="Later in the order" disabled={index >= n - 1} onClick={() => onMove(step.id, index + 1)}><Icon name="expand_more" small /></Button>
          <Button size="xs" variant="ghost" aria-label="Delete step" title="Delete this step: its parts are in no step, nothing is moved" onClick={() => onDelete(step.id)}><Icon name="delete" small /></Button>
        </div>
        <Collapsible>
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-1 bg-transparent p-0 text-left text-[11px] text-foreground hover:text-[var(--accent)] [&[data-state=open]_.ms]:rotate-90" aria-label="Details"><Icon name="chevron_right" small />Details{problems.length ? ' ·' : ''}</CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1 pt-1">
            <label className={FIELD}><span>Note</span><CommitText key={step.id} multiline aria-label="Step note" className="h-12 w-40 min-w-0" maxLength={500} value={step.note ?? ''} onCommit={v => onNote(step.id, v)} /></label>
            <label className={FIELD}><span>Show waiting parts faded</span><input type="checkbox" className={TICK} aria-label="Show waiting parts faded" checked={faded} onChange={e => onFaded(e.target.checked)} /></label>
            {problems.map(p => <div key={p} className="text-[10px] text-muted-foreground" role="status">{p}</div>)}
            <div className="text-[10px] text-muted-foreground">Steps explain the assembly; they never move a part, a mate, the BOM or an export. Waiting parts are left out of the view (or drawn faded), the step's own parts are highlighted, the explode scale and the view apply only while this panel is open. A part in no step shows at the last step.{faded ? ' Faded waiting parts fade the base part too.' : ''}</div>
          </CollapsibleContent>
        </Collapsible>
      </>}
    </div>
  </DockSection></aside>;
}
