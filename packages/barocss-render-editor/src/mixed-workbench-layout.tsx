import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { WorkbenchIcon } from './mixed-workbench-icons.js';

interface DockItem { key: string; label: string; content: ReactNode; icon?: 'sphere' | 'projects' | 'camera'; testId: string }
function Dock({ label, selected, onSelect, items }: { label: string; selected: string; onSelect: (key: string) => void; items: DockItem[] }) {
  const id = useId(), buttons = useRef<HTMLDivElement>(null);
  const key = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowLeft' ? (index + items.length - 1) % items.length : event.key === 'ArrowRight' ? (index + 1) % items.length : null;
    if (next === null) return;
    event.preventDefault(); onSelect(items[next]!.key);
    buttons.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  return <>
    <div ref={buttons} className="re-workbench-tabs" role="tablist" aria-label={label}>{items.map((item, index) =>
      <button key={item.key} id={`${id}-tab-${item.key}`} type="button" role="tab" data-testid={item.testId}
        aria-selected={selected === item.key} tabIndex={selected === item.key ? 0 : -1} aria-controls={`${id}-panel-${item.key}`}
        onClick={() => onSelect(item.key)} onKeyDown={(event) => key(event, index)}>
        {item.icon && <WorkbenchIcon kind={item.icon} />}{item.label}</button>)}</div>
    {items.map((item) => <div key={item.key} id={`${id}-panel-${item.key}`} role="tabpanel" aria-labelledby={`${id}-tab-${item.key}`}
      className="re-workbench-dock-panel" hidden={selected !== item.key} aria-hidden={selected !== item.key} onFocusCapture={() => onSelect(item.key)}>{item.content}</div>)}
  </>;
}

function Splitter({ label, direction, value, min, max, sign, onChange, testId }: {
  label: string; direction: 'vertical' | 'horizontal'; value: number; min: number; max: number; sign: number;
  onChange: (value: number) => void; testId: string;
}) {
  const element = useRef<HTMLDivElement>(null), drag = useRef<{ id: number; start: number; value: number } | null>(null);
  const release = () => {
    const current = drag.current; drag.current = null;
    if (current && element.current?.hasPointerCapture(current.id)) {
      try { element.current.releasePointerCapture(current.id); } catch { /* Capture may already be released. */ }
    }
  };
  useEffect(() => release, []);
  const bounded = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return <div ref={element} role="separator" tabIndex={0} aria-label={label} aria-orientation={direction}
    aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)}
    data-testid={testId} className={`re-workbench-splitter re-workbench-splitter--${direction}`}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      release(); event.currentTarget.focus();
      drag.current = { id: event.pointerId, start: direction === 'vertical' ? event.clientX : event.clientY, value };
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { drag.current = null; }
      event.preventDefault();
    }} onPointerMove={(event) => {
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      bounded(current.value + sign * ((direction === 'vertical' ? event.clientX : event.clientY) - current.start));
      event.preventDefault();
    }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
    onKeyDown={(event) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Home') { event.preventDefault(); bounded(min); }
      else if (event.key === 'End') { event.preventDefault(); bounded(max); }
      else if (direction === 'vertical' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault(); bounded(value + (event.key === 'ArrowRight' ? 1 : -1) * sign * (event.shiftKey ? 24 : 8));
      } else if (direction === 'horizontal' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault(); bounded(value + (event.key === 'ArrowDown' ? 1 : -1) * sign * (event.shiftKey ? 24 : 8));
      } else if (event.key === 'Escape') { event.preventDefault(); release(); }
    }} />;
}

export interface MixedWorkbenchLayoutProps {
  scene: ReactNode; projects: ReactNode; object: ReactNode; camera: ReactNode;
  viewport: ReactNode; actions: ReactNode; source: ReactNode; problems: ReactNode;
  browserTab: 'scene' | 'projects'; onBrowserTab: (tab: 'scene' | 'projects') => void;
  inspectorTab: 'object' | 'camera'; onInspectorTab: (tab: 'object' | 'camera') => void;
  drawer: 'source' | 'problems' | null; onDrawer: (drawer: 'source' | 'problems' | null) => void; problemCount: number;
}

/** Local measured pane state. Every source, field, and canvas child stays mounted. */
export function MixedWorkbenchLayout(props: MixedWorkbenchLayoutProps) {
  const root = useRef<HTMLDivElement>(null), center = useRef<HTMLDivElement>(null);
  const sourceToggle = useRef<HTMLButtonElement>(null), problemsToggle = useRef<HTMLButtonElement>(null);
  const [bounds, setBounds] = useState({ width: 1000, height: 600 });
  const [sizes, setSizes] = useState({ left: 220, right: 280, source: 240 });
  useEffect(() => {
    const measure = () => {
      const width = root.current?.clientWidth ?? 1000, height = center.current?.clientHeight ?? 600;
      setBounds((current) => current.width === width && current.height === height ? current : { width, height });
    };
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    if (center.current) observer.observe(center.current);
    measure(); return () => observer.disconnect();
  }, []);
  const leftMax = Math.max(180, Math.min(300, bounds.width - sizes.right - 328));
  const left = Math.min(sizes.left, leftMax);
  const rightMax = Math.max(240, Math.min(360, bounds.width - left - 328));
  const right = Math.min(sizes.right, rightMax);
  // Header 54 + disclosure strip 30 leave a real canvas height of at least220.
  const sourceMax = Math.max(160, Math.min(360, bounds.height - 304));
  const sourceHeight = Math.min(sizes.source, sourceMax);
  const styles = { '--re-left-width': `${left}px`, '--re-right-width': `${right}px`, '--re-drawer-height': `${sourceHeight}px` } as CSSProperties;
  const id = useId();
  const toggle = (drawer: 'source' | 'problems') => props.onDrawer(props.drawer === drawer ? null : drawer);
  return <div ref={root} className="re-editor re-editor--workbench" style={styles} data-testid="mixed-workbench">
    <div className="re-editor-workspace re-workbench-grid">
      <aside className="re-left re-workbench-left" aria-label="Scene and projects"><Dock label="Browser tabs" selected={props.browserTab}
        onSelect={(key) => props.onBrowserTab(key as 'scene' | 'projects')} items={[
          { key: 'scene', label: 'Scene', icon: 'sphere', testId: 'workbench-scene-tab', content: props.scene },
          { key: 'projects', label: 'Projects', icon: 'projects', testId: 'workbench-projects-tab', content: props.projects },
        ]} /></aside>
      <Splitter label="Scene panel width" direction="vertical" value={left} min={180} max={leftMax} sign={1}
        testId="workbench-left-splitter" onChange={(left) => setSizes((current) => ({ ...current, left }))} />
      <div ref={center} className="re-center re-workbench-center">
        <div className="re-workbench-viewport-slot">{props.viewport}<div className="re-workbench-actions">{props.actions}</div></div>
        <div className="re-workbench-bottom-strip" aria-label="Bottom panels">
          <button ref={sourceToggle} type="button" data-testid="workbench-source-toggle" aria-expanded={props.drawer === 'source'} aria-controls={`${id}-source`}
            onClick={() => toggle('source')}><WorkbenchIcon kind="source" />Source</button>
          <button ref={problemsToggle} type="button" data-testid="workbench-problems-toggle" aria-expanded={props.drawer === 'problems'} aria-controls={`${id}-problems`}
            onClick={() => toggle('problems')}><WorkbenchIcon kind="problems" />Problems<span className={props.problemCount ? 're-workbench-problem-count is-active' : 're-workbench-problem-count'}>{props.problemCount}</span></button>
          {props.drawer && <button type="button" className="re-workbench-close-drawer" aria-label="Close bottom panel" onClick={() => {
            const focus = props.drawer === 'source' ? sourceToggle : problemsToggle;
            props.onDrawer(null); focus.current?.focus();
          }}>×</button>}
        </div>
        <div className="re-workbench-bottom-drawer" hidden={props.drawer === null}>
          <Splitter label="Bottom panel height" direction="horizontal" value={sourceHeight} min={160} max={sourceMax} sign={-1}
            testId="workbench-source-splitter" onChange={(source) => setSizes((current) => ({ ...current, source }))} />
          <section id={`${id}-source`} className="re-workbench-drawer-panel" data-testid="workbench-source-panel" hidden={props.drawer !== 'source'} aria-hidden={props.drawer !== 'source'}>{props.source}</section>
          <section id={`${id}-problems`} className="re-workbench-drawer-panel" data-testid="workbench-problems-panel" hidden={props.drawer !== 'problems'} aria-hidden={props.drawer !== 'problems'}>{props.problems}</section>
        </div>
      </div>
      <Splitter label="Properties panel width" direction="vertical" value={right} min={240} max={rightMax} sign={-1}
        testId="workbench-right-splitter" onChange={(right) => setSizes((current) => ({ ...current, right }))} />
      <aside className="re-right re-workbench-right" aria-label="Properties"><Dock label="Inspector tabs" selected={props.inspectorTab}
        onSelect={(key) => props.onInspectorTab(key as 'object' | 'camera')} items={[
          { key: 'object', label: 'Object', icon: 'sphere', testId: 'workbench-object-tab', content: props.object },
          { key: 'camera', label: 'Camera', icon: 'camera', testId: 'workbench-camera-tab', content: props.camera },
        ]} /></aside>
    </div>
  </div>;
}
