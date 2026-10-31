import { BODY_COLOURS } from '@barocss/cad-model/app/bodies';
import type { InstanceLookPatch, LookSource } from '@barocss/cad-model/assembly/looks';
import { MATERIALS } from '@barocss/cad-model/library/materials';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { InstanceLookRow } from '../state/useInstanceLooks';
import { Icon } from './atoms';
import { CONTROL, FIELD } from './panelStyles';

// Roadmap 10 ① (#2233): the Appearance of one occurrence of a placed part. By default each body (or the whole part, when it has one)
// shows a Colour row and a Material row; a field this occurrence overrides carries a small accent dot and a Reset, an inherited one
// shows nothing. Visible, face colours, where each field comes from and held looks are under Details, closed. One edit is one undo step.

/** The words for where a field comes from. */
export const sourceText = (source: LookSource | undefined): string => source === 'occurrence' ? 'this occurrence' : 'from the definition';

/** The mark of an overridden field: an accent dot and a compact Reset; nothing for an inherited one. */
function Overridden({ source, label, onReset }: { source: LookSource | undefined; label: string; onReset?(): void }) {
  if (source !== 'occurrence') return null;
  return <span className="inline-flex items-center gap-0.5">
    <i className="inline-block size-1.5 rounded-full bg-[var(--accent)]" data-overridden="true" role="img" aria-label={`${label}: this occurrence; Reset`} title="This occurrence's own: Reset puts back the definition's" />
    {onReset && <button className="tool tiny" aria-label={`Reset ${label} to the definition`} title="Reset to the definition" onClick={onReset}><Icon name="restart_alt" small /></button>}
  </span>;
}

/** The appearance rows of an occurrence: per body a Colour row and a Material row; Details below. */
export function InstanceLooksControls({ rows, held = [], readOnly = false, detailsOpen, onSet, onReset }: {
  rows: readonly InstanceLookRow[];
  /** Plain-word problems: looks whose body the part no longer has, or would not have once the waiting revision is accepted. */
  held?: readonly string[];
  /** A pattern's occurrence: its looks are its seed's. */
  readOnly?: boolean;
  /** Details open to begin with (closed when left out). */
  detailsOpen?: boolean;
  onSet(key: string, patch: InstanceLookPatch): void;
  onReset(key: string, field: 'color' | 'material' | 'hidden' | `face:${string}`): void;
}) {
  if (!rows.length && !held.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-2" role="group" aria-label="Appearance (this occurrence)">
      <div className="card-title">APPEARANCE (THIS OCCURRENCE)</div>
      {readOnly && <div className="text-[10px] text-muted-foreground">Placed by its pattern: set the look on the seed.</div>}
      {rows.map(({ key, name, look }) => {
        const label = rows.length > 1 ? `${name} ` : '';
        return (
          <div key={key} className="flex flex-col gap-0.5" role="group" aria-label={`Look of ${name}`}>
            {rows.length > 1 && <div className="text-[11px] font-medium">{name}</div>}
            <div className={FIELD}><span className="inline-flex items-center gap-1">Colour<Overridden source={look.from.color} label={`${label}colour`} onReset={readOnly ? undefined : () => onReset(key, 'color')} /></span>
              <span className="swatches" role="group" aria-label={`${label}Colour`}>
                {BODY_COLOURS.map(c => <button key={c} className={'swatch' + (look.color === c ? ' on' : '')} style={{ background: c }} disabled={readOnly} aria-label={`${label}Colour ${c}`} onClick={() => onSet(key, { color: c })} />)}
                <label className="swatch pick" data-tip="Any colour" style={look.color && !(BODY_COLOURS as readonly string[]).includes(look.color) ? { background: look.color } : undefined}>
                  <input type="color" disabled={readOnly} aria-label={`${label}Any colour`} value={look.color ?? '#bcc0c7'} onChange={e => onSet(key, { color: e.target.value })} /></label>
              </span>
            </div>
            <label className={FIELD}><span className="inline-flex items-center gap-1">Material<Overridden source={look.from.material} label={`${label}material`} onReset={readOnly ? undefined : () => onReset(key, 'material')} /></span>
              <select aria-label={`${label}Material`} className={`${CONTROL} min-w-0 truncate`} disabled={readOnly} value={look.material ?? ''} onChange={e => onSet(key, { material: e.target.value || null })}>
                <option value="">as the part has it</option>
                {MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select></label>
          </div>);
      })}
      <Collapsible defaultOpen={detailsOpen}>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-1 bg-transparent p-0 text-left text-[11px] text-foreground hover:text-[var(--accent)] [&[data-state=open]_.ms]:rotate-90">
          <Icon name="chevron_right" small />Details{held.length ? ` · ${held.length} held` : ''}</CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-0.5 pt-1">
          {rows.map(({ key, name, look }) => {
            const label = rows.length > 1 ? `${name} ` : '';
            return (
              <div key={key} className="flex flex-col gap-0.5" role="group" aria-label={`Details of ${name}`}>
                {rows.length > 1 && <div className="text-[11px] font-medium">{name}</div>}
                <label className={FIELD}><span className="inline-flex items-center gap-1">Visible<Overridden source={look.from.hidden} label={`${label}visibility`} onReset={readOnly ? undefined : () => onReset(key, 'hidden')} /></span>
                  <input type="checkbox" className="size-3.5" disabled={readOnly} aria-label={`${label}Visible`} checked={!look.hidden} onChange={e => onSet(key, { hidden: !e.target.checked })} /></label>
                {look.faces && Object.entries(look.faces).map(([face, c]) => (
                  <div key={face} className={FIELD}><span className="inline-flex items-center gap-1">Face {face}<Overridden source={look.from.faces?.[face]} label={`face ${face}`} onReset={readOnly ? undefined : () => onReset(key, `face:${face}`)} /></span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><i className="inline-block size-3 rounded-sm border border-border" style={{ background: c }} />{sourceText(look.from.faces?.[face])}</span></div>))}
                <div className="text-[10px] text-muted-foreground">Colour: {sourceText(look.from.color)} · Material: {sourceText(look.from.material)} · Visible: {sourceText(look.from.hidden)}</div>
              </div>);
          })}
          {held.map(h => <div key={h} className="empty warn" role="alert">{h}</div>)}
        </CollapsibleContent>
      </Collapsible>
    </div>);
}
