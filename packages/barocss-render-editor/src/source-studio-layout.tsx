import {useEffect, useId, useRef, useState} from 'react';
import type {CSSProperties, KeyboardEvent, ReactNode} from 'react';
import {WorkbenchIcon} from './mixed-workbench-icons.js';

type BrowserTab = 'scene' | 'projects';
type InspectorTab = 'object' | 'camera';
type Drawer = 'source' | 'problems' | null;

export interface SourceStudioLayoutProps {
  viewport: ReactNode;
  toolRail: ReactNode;
  addToolbar: ReactNode;
  actions: ReactNode;
  scene: ReactNode;
  projects: ReactNode;
  object: ReactNode;
  camera: ReactNode;
  timeline: ReactNode;
  source: ReactNode;
  problems: ReactNode;
  browserTab: BrowserTab;
  onBrowserTab: (tab: BrowserTab) => void;
  inspectorTab: InspectorTab;
  onInspectorTab: (tab: InspectorTab) => void;
  drawer: Drawer;
  onDrawer: (drawer: Drawer) => void;
  problemCount: number;
}

interface TabItem {
  key: string;
  label: string;
  icon: 'sphere' | 'projects' | 'camera';
  testId: string;
  content: ReactNode;
}

function StudioTabs({label, selected, onSelect, items}: {
  label: string; selected: string; onSelect: (key: string) => void; items: TabItem[];
}) {
  const id = useId(), tabs = useRef<HTMLDivElement>(null);
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowLeft' ? (index + items.length - 1) % items.length
        : event.key === 'ArrowRight' ? (index + 1) % items.length : null;
    if (next === null) return;
    event.preventDefault(); onSelect(items[next]!.key);
    tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  return <>
    <div ref={tabs} className="re-studio-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => <button key={item.key} type="button" role="tab"
        id={`${id}-tab-${item.key}`} data-testid={item.testId} aria-selected={selected === item.key}
        aria-controls={`${id}-panel-${item.key}`} tabIndex={selected === item.key ? 0 : -1}
        onClick={() => onSelect(item.key)} onKeyDown={event => navigate(event, index)}>
        <WorkbenchIcon kind={item.icon}/>{item.label}
      </button>)}
    </div>
    {items.map(item => <div key={item.key} id={`${id}-panel-${item.key}`} role="tabpanel"
      aria-labelledby={`${id}-tab-${item.key}`} className="re-studio-panel" hidden={selected !== item.key}
      onFocusCapture={() => onSelect(item.key)}>{item.content}</div>)}
  </>;
}

function StudioSplitter({label, orientation, value, min, max, sign, testId, onChange}: {
  label: string; orientation: 'vertical' | 'horizontal'; value: number; min: number; max: number;
  sign: 1 | -1; testId: string; onChange: (value: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const drag = useRef<{pointerId: number; start: number; value: number} | null>(null);
  const bound = (next: number) => onChange(Math.max(min, Math.min(max, next)));
  const release = () => {
    const previous = drag.current; drag.current = null;
    if (previous && element.current?.hasPointerCapture(previous.pointerId)) {
      try { element.current.releasePointerCapture(previous.pointerId); } catch { /* Capture can end before cleanup. */ }
    }
  };
  useEffect(() => {
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); release(); };
  }, []);
  return <div ref={element} role="separator" tabIndex={0} aria-label={label} aria-orientation={orientation}
    aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)}
    data-testid={testId} className={`re-studio-splitter re-studio-splitter--${orientation}`}
    onPointerDown={event => {
      if (event.button !== 0) return;
      release(); event.currentTarget.focus();
      drag.current = {pointerId: event.pointerId, start: orientation === 'vertical' ? event.clientX : event.clientY, value};
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { drag.current = null; }
      event.preventDefault();
    }} onPointerMove={event => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      bound(current.value + sign * ((orientation === 'vertical' ? event.clientX : event.clientY) - current.start));
      event.preventDefault();
    }} onPointerUp={event => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      bound(current.value + sign * ((orientation === 'vertical' ? event.clientX : event.clientY) - current.start));
      release();
    }} onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') { event.preventDefault(); release(); return; }
      if (event.key === 'Home') { event.preventDefault(); bound(min); return; }
      if (event.key === 'End') { event.preventDefault(); bound(max); return; }
      const negative = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
      const positive = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
      if (event.key === negative || event.key === positive) {
        event.preventDefault(); bound(value + (event.key === positive ? 1 : -1) * sign * (event.shiftKey ? 24 : 8));
      }
    }}/>;
}

/** Layout state is local. Hidden panels retain the same authoring children. */
export function SourceStudioLayout(props: SourceStudioLayoutProps) {
  const root = useRef<HTMLDivElement>(null), center = useRef<HTMLDivElement>(null), side = useRef<HTMLElement>(null), timeline = useRef<HTMLDivElement>(null);
  const sourceToggle = useRef<HTMLButtonElement>(null), problemsToggle = useRef<HTMLButtonElement>(null);
  const [bounds, setBounds] = useState({width: 1280, centerHeight: 600, sideHeight: 600, timelineHeight: 0});
  const [sizes, setSizes] = useState({right: 260, outliner: 172, drawer: 220});
  const id = useId();
  useEffect(() => {
    const measure = () => {
      const next = {width: root.current?.clientWidth ?? 1280, centerHeight: center.current?.clientHeight ?? 600,
        sideHeight: side.current?.clientHeight ?? 600, timelineHeight: timeline.current?.clientHeight ?? 0};
      setBounds(previous => previous.width === next.width && previous.centerHeight === next.centerHeight && previous.sideHeight === next.sideHeight && previous.timelineHeight === next.timelineHeight ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    for (const element of [root.current, center.current, side.current, timeline.current]) if (element) observer.observe(element);
    measure(); return () => observer.disconnect();
  }, []);
  const rightMax = Math.max(220, Math.min(380, bounds.width - 38 - 4 - 360));
  const outlinerMax = Math.max(112, Math.min(360, bounds.sideHeight - 196));
  const drawerMax = Math.max(96, Math.min(360, bounds.centerHeight - 264 - 24 - bounds.timelineHeight));
  const right = Math.min(sizes.right, rightMax), outliner = Math.min(sizes.outliner, outlinerMax), drawer = Math.min(sizes.drawer, drawerMax);
  const style = {'--re-studio-right-width': `${right}px`, '--re-studio-outliner-height': `${outliner}px`,
    '--re-studio-drawer-height': `${drawer}px`} as CSSProperties;
  const toggle = (next: Exclude<Drawer, null>) => props.onDrawer(props.drawer === next ? null : next);
  return <div ref={root} className="re-editor re-editor--workbench re-source-studio" style={style} data-testid="source-studio-layout">
    <div className="re-studio-toolbar" aria-label="Scene authoring toolbar">
      <div className="re-studio-add-toolbar">{props.addToolbar}</div>
      <div className="re-studio-actions">{props.actions}</div>
    </div>
    <div className="re-studio-grid">
      <aside className="re-studio-tool-rail" aria-label="Transform tools" data-testid="source-studio-tool-rail">{props.toolRail}</aside>
      <div ref={center} className="re-studio-center">
        <div className="re-studio-viewport">{props.viewport}</div>
        <div ref={timeline} className="re-studio-timeline">{props.timeline}</div>
        <div className="re-studio-disclosures" aria-label="Bottom panels">
          <button ref={sourceToggle} type="button" data-testid="workbench-source-toggle" aria-expanded={props.drawer === 'source'}
            aria-controls={`${id}-source`} onClick={() => toggle('source')}><WorkbenchIcon kind="source"/>Source</button>
          <button ref={problemsToggle} type="button" data-testid="workbench-problems-toggle" aria-expanded={props.drawer === 'problems'}
            aria-controls={`${id}-problems`} onClick={() => toggle('problems')}><WorkbenchIcon kind="problems"/>Problems
            <span className={props.problemCount ? 're-studio-problem-count is-active' : 're-studio-problem-count'}>{props.problemCount}</span></button>
          {props.drawer && <button type="button" className="re-studio-close-drawer" aria-label="Close bottom panel" onClick={() => {
            const trigger = props.drawer === 'source' ? sourceToggle : problemsToggle;
            props.onDrawer(null); trigger.current?.focus();
          }}>×</button>}
        </div>
        <div className="re-studio-drawer" hidden={props.drawer === null}>
          <StudioSplitter label="Bottom panel height" orientation="horizontal" value={drawer} min={96} max={drawerMax} sign={-1}
            testId="workbench-source-splitter" onChange={drawer => setSizes(previous => ({...previous, drawer}))}/>
          <section id={`${id}-source`} className="re-studio-drawer-panel" data-testid="workbench-source-panel" hidden={props.drawer !== 'source'}>{props.source}</section>
          <section id={`${id}-problems`} className="re-studio-drawer-panel" data-testid="workbench-problems-panel" hidden={props.drawer !== 'problems'}>{props.problems}</section>
        </div>
      </div>
      <StudioSplitter label="Outliner and properties width" orientation="vertical" value={right} min={220} max={rightMax} sign={-1}
        testId="source-studio-right-splitter" onChange={right => setSizes(previous => ({...previous, right}))}/>
      <aside ref={side} className="re-studio-right" aria-label="Scene panels">
        <section className="re-studio-outliner" aria-label="Outliner" data-testid="source-studio-outliner">
          <div className="re-studio-region-heading"><WorkbenchIcon kind="projects"/><h2>Outliner</h2></div>
          <StudioTabs label="Outliner tabs" selected={props.browserTab} onSelect={key => props.onBrowserTab(key as BrowserTab)} items={[
            {key: 'scene', label: 'Scene', icon: 'sphere', testId: 'workbench-scene-tab', content: props.scene},
            {key: 'projects', label: 'Projects', icon: 'projects', testId: 'workbench-projects-tab', content: props.projects},
          ]}/>
        </section>
        <StudioSplitter label="Outliner height" orientation="horizontal" value={outliner} min={112} max={outlinerMax} sign={1}
          testId="source-studio-outliner-splitter" onChange={outliner => setSizes(previous => ({...previous, outliner}))}/>
        <section className="re-studio-properties" aria-label="Properties" data-testid="source-studio-properties">
          <div className="re-studio-region-heading"><h2>Properties</h2></div>
          <StudioTabs label="Inspector tabs" selected={props.inspectorTab} onSelect={key => props.onInspectorTab(key as InspectorTab)} items={[
            {key: 'object', label: 'Object', icon: 'sphere', testId: 'workbench-object-tab', content: props.object},
            {key: 'camera', label: 'Camera', icon: 'camera', testId: 'workbench-camera-tab', content: props.camera},
          ]}/>
        </section>
      </aside>
    </div>
  </div>;
}
