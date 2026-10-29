import { Profiler, type ComponentProps, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { fmt, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Selection } from '@barocss/cad-model/app/commands';
import { CAD_DISPLAY_MODES, emptySel } from '../app/studioConstants';
import { onBlockRender } from '../devRenders';
import type { ViewportHandle } from '../viewport/Viewport';
import type { DisplayMode } from '../viewport/renderer';
import { axisSection, type Section } from '../viewport/sectionView';
import type { MapKind, ScalarMap } from '../viewport/scalarMaps';
import type { ValueStore } from '../state/valueStore';
import { Icon } from './atoms';
import { ExplodeButton } from './ExplodeButton';
import { MapLegend, MouldLegend } from './MapLegend';
import { SectionBar } from './SectionBar';

type StateSetter<T> = Dispatch<SetStateAction<T>>;
type SectionProps = ComponentProps<typeof SectionBar>;
type AnalysisMode = 'zebra' | 'curvature' | 'overhang' | null;
type AnalysisMap = MapKind | 'parting' | 'halves' | null;
type PickFilter = 'all' | 'face' | 'edge' | 'body';

export interface ViewDisplayState {
  displayOpen: boolean;
  setDisplayOpen: StateSetter<boolean>;
  displayMode: DisplayMode;
  setDisplayMode: StateSetter<DisplayMode>;
  effectiveDisplayMode: DisplayMode;
  displayScopeReason?: string;
  displayModeReason?: string;
  displayModeNotice?: string;
  clearDisplayModeFailure(): void;
  isolatedInstances: readonly string[] | undefined;
  setIsolatedInstances: StateSetter<readonly string[] | undefined>;
  isolationReason?: string;
  isolationSelection: readonly string[] | undefined;
}

export interface ViewCameraControls {
  ortho: boolean;
  setOrtho: StateSetter<boolean>;
  ao: boolean;
  setAo: StateSetter<boolean>;
  theme: 'dark' | 'light';
  setTheme: StateSetter<'dark' | 'light'>;
  rendering: boolean;
  printing: boolean;
  viewBackend: 'webgpu' | 'webgl2' | null;
}

export interface ViewSectionControls {
  section: Section | null;
  setSection: StateSetter<Section | null>;
  sectionHatchOn: boolean;
  setSectionHatchOn: SectionProps['setHatch'];
  sectionBox: SectionProps['box'];
  sectionFacePick: number | null;
  setSectionFacePick: SectionProps['setFacePick'];
  sketchSection: SectionProps['onSketch'];
  cameraEye: SectionProps['eye'];
}

export interface ViewAnalysisControls {
  analysis: AnalysisMode;
  setAnalysis: StateSetter<AnalysisMode>;
  mapKind: AnalysisMap;
  setMapKind: StateSetter<AnalysisMap>;
  mapLegend: ScalarMap | null;
  mapHover: number | null;
  setMapHover: StateSetter<number | null>;
  mouldResult: ComponentProps<typeof MouldLegend>['result'];
  mouldSpread: number;
  setMouldSpread: StateSetter<number>;
}

export interface ViewPickingControls {
  pickFilter: PickFilter;
  setPickFilter: StateSetter<PickFilter>;
  snapStep: number;
  setSnapStep: StateSetter<number>;
  setSelection(selection: Selection): void;
}

export interface ViewDisplayControlsProps {
  model: { doc: StudioDoc; bodies: BodyResult[]; instancesPlaced: readonly { bodies: BodyResult[] }[] };
  viewport: RefObject<ViewportHandle | null>;
  cornerRight: RefObject<HTMLDivElement | null>;
  display: ViewDisplayState;
  view: ViewCameraControls;
  section: ViewSectionControls;
  analysis: ViewAnalysisControls;
  picking: ViewPickingControls;
  explodeStore: ValueStore<number>;
}

/** The existing corner view/display controls; all state and viewport ownership remain in App. */
export function ViewDisplayControls({ model, viewport, cornerRight, display, view, section: sectionState, analysis: analysisState, picking, explodeStore }: ViewDisplayControlsProps) {
  const { doc, bodies, instancesPlaced } = model;
  const { displayOpen, setDisplayOpen, displayMode, setDisplayMode, effectiveDisplayMode, displayScopeReason,
    displayModeReason, displayModeNotice, clearDisplayModeFailure, isolatedInstances, setIsolatedInstances, isolationReason, isolationSelection } = display;
  const { ortho, setOrtho, ao, setAo, theme, setTheme, rendering, printing, viewBackend } = view;
  const { section, setSection, sectionHatchOn, setSectionHatchOn, sectionBox, sectionFacePick, setSectionFacePick, sketchSection, cameraEye } = sectionState;
  const { analysis, setAnalysis, mapKind, setMapKind, mapLegend, mapHover, setMapHover, mouldResult, mouldSpread, setMouldSpread } = analysisState;
  const { pickFilter, setPickFilter, snapStep, setSnapStep, setSelection } = picking;
  return <Profiler id="corner-right" onRender={onBlockRender}><div className="corner-right" ref={cornerRight}>
        {/* (What stands above the row, stacked so nothing overlaps: the maps' legends, the previews and display
            toggles, then the section bar nearest the row. None of it covers the history bar or the timeline.) */}
        <div className="corner-stack">
    {mapLegend && <MapLegend map={mapLegend} hover={mapHover} />}
    {(mapKind === 'parting' || mapKind === 'halves') && <MouldLegend kind={mapKind} result={mouldResult} pull={!!doc.mould?.pull} spread={mouldSpread} onSpread={setMouldSpread} />}
        {/* (The previews' toggles stacked above the row, at its right: never over the history bar or the timeline.) */}
        {displayOpen && <div className="previews" role="group" aria-label="Previews">
        {/* (G21's display mode and isolate, in the column too: the Views row stays as narrow as the history bar assumes.) */}
        <div className="card views display" role="group" aria-label="Display">
          <label className="cad-display-control"><span className="sr">CAD display mode</span>
            <select aria-label="CAD display mode" aria-describedby={displayModeNotice ? 'cad-display-mode-status' : undefined} value={effectiveDisplayMode} disabled={!!displayScopeReason}
              data-display-mode-requested={displayMode} data-display-mode-effective={effectiveDisplayMode} data-display-mode-supported={!displayModeReason}
              onChange={event => { clearDisplayModeFailure(); setDisplayMode(event.target.value as DisplayMode); }}>
              {CAD_DISPLAY_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
          </label>
          <Button size="sm" variant={isolatedInstances ? 'default' : 'ghost'} aria-label={isolatedInstances ? 'Restore view' : 'Isolate selection'} aria-pressed={!!isolatedInstances} className={isolatedInstances ? 'on' : ''}
            disabled={!isolatedInstances && !!isolationReason} title={isolatedInstances ? 'Restore the ordinary view' : isolationReason ?? 'Keep the selected instances opaque and fade the other solids'}
            onClick={() => setIsolatedInstances(current => current ? undefined : isolationSelection)}>{isolatedInstances ? 'Restore view' : 'Isolate selection'}</Button>
          {/* (Why a mode cannot apply, said where the mode is chosen: never over the panels.) */}
          {displayModeNotice && <span id="cad-display-mode-status" className="cad-display-status" role="status">{displayModeNotice} Shaded with edges is active.</span>}
        </div>
        </div>}
    {section && <SectionBar section={section} setSection={setSection} hatch={sectionHatchOn} setHatch={setSectionHatchOn} box={sectionBox} facePick={sectionFacePick} setFacePick={setSectionFacePick} onSketch={sketchSection} eye={cameraEye} />}
        </div>
        <div className="card views" role="group" aria-label="Views">
          <Button size="sm" variant={displayOpen || !!isolatedInstances || displayMode !== 'shaded-with-edges' ? 'default' : 'ghost'} aria-label="Display and previews" aria-expanded={displayOpen} className={displayOpen || !!isolatedInstances || displayMode !== 'shaded-with-edges' ? 'on' : ''}
            title="The display mode and isolate (the previews are in the dock)" onClick={() => setDisplayOpen(o => !o)}>Display</Button>
          {(['iso', 'top', 'front', 'right'] as const).map(v => <Button size="sm" variant="ghost" key={v} onClick={() => viewport.current?.setView(v)}>{v === 'iso' ? 'Iso' : v[0].toUpperCase() + v.slice(1)}</Button>)}
          <Button size="sm" variant="ghost" onClick={() => viewport.current?.fit()} title="Frame all (F)"><Icon name="fit_screen" small /></Button>
          <Button size="sm" variant={section ? 'default' : 'ghost'} className={section ? 'on' : ''} aria-label="Section view" data-tip="Section view" data-tip-desc="Cut the part open along a plane to see inside (the model is not changed)"
            onClick={() => { if (section) { setSection(null); return; } const zs = [...bodies, ...instancesPlaced.flatMap(i => i.bodies)].flatMap(b => [b.mesh.bounds.min[1], b.mesh.bounds.max[1]]); setSelection(emptySel); setSectionFacePick(null); setSection(axisSection({ axis: 'y', at: zs.length ? Math.round((Math.min(...zs) + Math.max(...zs))) / 2 : 0, keep: 'positive' })); }}>
            <Icon name="cad-split" small /></Button>

          <Button size="sm" variant={ortho ? 'default' : 'ghost'} onClick={() => setOrtho(viewport.current?.toggleOrtho() ?? false)} className={ortho ? 'on' : ''}>Ortho</Button>
          <Button size="sm" variant={ao ? 'default' : 'ghost'} onClick={() => setAo(v => !v)} className={ao ? 'on' : ''} title="Ambient occlusion">AO</Button>
          {!rendering && <Button size="sm" variant={analysis ? 'default' : 'ghost'} aria-label="Surface analysis" className={analysis ? 'on' : ''} data-tip={analysis === 'zebra' ? 'Zebra stripes' : analysis === 'curvature' ? 'Curvature map' : 'Surface analysis'}
            data-tip-desc="Click: zebra stripes (a bend or break in a stripe is a joint that is not smooth), then the curvature map (flat blue, tight red), then — for a printing process — the overhang map (red past its limit), then off"
            onClick={() => setAnalysis(a => a === null ? 'zebra' : a === 'zebra' ? 'curvature' : a === 'curvature' && printing ? 'overhang' : null)}>{analysis === 'zebra' ? 'Zebra' : analysis === 'curvature' ? 'Curv' : analysis === 'overhang' ? 'Overhang' : 'Analyse'}</Button>}
          {!rendering && viewBackend === 'webgl2' && <Button size="sm" variant="ghost" aria-label="Analysis map" disabled data-tip="Analysis map" data-tip-desc="The analysis maps (wall thickness, draft, what a 3-axis mill reaches) and the mould's parting line and halves are drawn with WebGPU; this browser draws with WebGL2">Maps</Button>}
          {!rendering && viewBackend !== 'webgl2' && <Button size="sm" variant={mapKind ? 'default' : 'ghost'} aria-label="Analysis map" className={mapKind ? 'on' : ''} data-tip="Analysis map" data-tip-desc="Click: the wall thickness (thin red, nominal green, thick orange, past the thick-section limit purple); for a part with a pull, its draft (under the least draft red, + green, − blue, the isoclines white); the share a 3-axis mill does not reach (red); for a part with a pull, its parting line, then its two halves (spread apart from the legend); then off — each legend shows the value under the pointer"
            onClick={() => { setMapHover(null); setMouldSpread(0); const pull = !!doc.mould?.pull; setMapKind(k => k === null ? 'thickness' : k === 'thickness' ? (pull ? 'draft' : 'access') : k === 'draft' ? 'access' : k === 'access' ? (pull ? 'parting' : null) : k === 'parting' ? 'halves' : null); }}>{mapKind === 'thickness' ? 'Thickness' : mapKind === 'draft' ? 'Draft' : mapKind === 'access' ? 'Access' : mapKind === 'parting' ? 'Parting' : mapKind === 'halves' ? 'Halves' : 'Maps'}</Button>}
          <Button size="sm" variant="ghost" onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')} title="Toggle light / dark" aria-label="Toggle light or dark theme"><Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} small /></Button>
        </div>
        {(doc.instances?.length ?? 0) > 0 && <ExplodeButton store={explodeStore} />}
        <Button size="sm" variant="secondary" className="chip snap" aria-label="Selection filter" data-tip="Selection filter" data-tip-desc="What a click picks: anything, or only faces, edges or whole bodies (click for the next)"
          onClick={() => setPickFilter(f => { const all = ['all', 'face', 'edge', 'body'] as const, n = all[(all.indexOf(f) + 1) % all.length]; try { localStorage.setItem('studio.pick', n); } catch { /* private mode */ } return n; })}>
          <Icon name="ads_click" small />{({ all: 'Pick all', face: 'Faces', edge: 'Edges', body: 'Bodies' } as const)[pickFilter]}</Button>
        <Button size="sm" variant="secondary" className="chip snap" aria-label="Snap" data-tip="Grid snap" data-tip-desc="Sketch points, placing and moves land on this step: click for the next (1, 0.5, 0.1, 5, 10 mm, off)"
          onClick={() => setSnapStep(s => { const steps = [1, 0.5, 0.1, 5, 10, 0], n = steps[(steps.indexOf(s) + 1) % steps.length]; try { localStorage.setItem('studio.snap', String(n)); } catch { /* private mode */ } return n; })}>
          <Icon name="adjust" small />{snapStep ? `Snap ${fmt(snapStep)} mm` : 'Snap off'}</Button>
        <span className="chip mono">mm</span>
      </div></Profiler>;
}
