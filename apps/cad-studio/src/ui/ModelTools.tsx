import type { Dispatch, SetStateAction, DragEvent } from 'react';
import type { Command } from '@barocss/cad-model/app/commands';
import type { SketchState } from '../viewport/Viewport';
import { TOOLS, switchTool, detachSketchLink } from '../app/sketchControls';
import { TOOL_GROUPS, GROUP_COMMANDS } from '../app/studioConstants';
import { CommandButtons, type commandStates } from './ToolButton';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';
interface ModelToolsProps {
  sketch: SketchState | null;
  setSketch: Dispatch<SetStateAction<SketchState | null>>;
  command: { groupStates: ReturnType<typeof commandStates>[]; activeId: string | null; startTool(command: Command): void; toolDragStart(command: Command, event: DragEvent): void; toolDragEnd(command: Command, event: DragEvent): void };
  panels: { bomOpen: boolean; setBomOpen: Dispatch<SetStateAction<boolean>>; rebuildOpen: boolean; setRebuildOpen: Dispatch<SetStateAction<boolean>>; variantsOpen: boolean; setVariantsOpen: Dispatch<SetStateAction<boolean>> };
}
export function ModelTools({ sketch, setSketch, command, panels }: ModelToolsProps) {
  const { groupStates, activeId, startTool, toolDragStart, toolDragEnd } = command;
  const { bomOpen, setBomOpen, rebuildOpen, setRebuildOpen, variantsOpen, setVariantsOpen } = panels;
  return <>
        {sketch ? (<>
          {TOOLS.map(t => (
            <ToolIconButton key={t.tool} state={sketch.tool === t.tool ? 'on' : 'idle'} data-tip={t.label} data-tip-key={t.key} data-tip-desc={t.hint} aria-label={t.label}
              onClick={() => setSketch(s => s && switchTool(s, t.tool))}><Icon name={t.icon} /></ToolIconButton>))}
          <div className="sep" />
          <ToolIconButton state={sketch.construct ? 'on' : 'idle'} data-tip="Construction" data-tip-key="X" data-tip-desc="Draw references: dashed shapes to snap to, not part of the profile" aria-label="Construction"
            onClick={() => setSketch(s => s && { ...s, construct: !s.construct })}><Icon name="cad-sk-construction" /></ToolIconButton>
          {(sketch.done ?? []).some(d => d.construction) && <ToolIconButton state={sketch.hideConstruction ? 'on' : 'idle'} data-tip={sketch.hideConstruction ? 'Show construction' : 'Hide construction'} data-tip-desc="The dashed reference shapes: hidden ones are not drawn or snapped to, and stay with the sketch" aria-label={sketch.hideConstruction ? 'Show construction' : 'Hide construction'}
            onClick={() => setSketch(s => s && { ...s, hideConstruction: !s.hideConstruction })}><Icon name={sketch.hideConstruction ? 'visibility_off' : 'visibility'} /></ToolIconButton>}
          <ToolIconButton data-tip="Clear profile" data-tip-desc="Remove every shape drawn in this sketch" aria-label="Clear profile" onClick={() => setSketch(s => s && { ...detachSketchLink(s), shape: null, done: [] })}><Icon name="ink_eraser" /></ToolIconButton>
        </>) : TOOL_GROUPS.map((g, gi) => (
          <div key={g} className="tool-group">
            {gi > 0 && <div className="sep" />}
            <CommandButtons list={GROUP_COMMANDS[gi]} {...groupStates[gi]} activeId={activeId} onStart={startTool} onDragStart={toolDragStart} onDragEnd={toolDragEnd} />
            {/* (O147: the BOM with the inspect tools, not on the top bar — O90's shapes strip keeps its room.) */}
            {g === 'inspect' && <ToolIconButton state={bomOpen ? 'on' : 'idle'} aria-label="BOM" data-tip="Bill of materials" data-tip-desc="The parts and bought elements, bought or made, and the purchase list" onClick={() => setBomOpen(v => !v)}><Icon name="cad-bom" /></ToolIconButton>}
            {g === 'inspect' && <ToolIconButton state={rebuildOpen ? 'on' : 'idle'} aria-label="Rebuild" data-tip="Rebuild" data-tip-desc="What the last rebuild cost: each feature built or reused, its time and kernel calls" onClick={() => { setBomOpen(false); setRebuildOpen(v => !v); }}><Icon name="cad-rebuild" /></ToolIconButton>}
            {g === 'inspect' && <ToolIconButton state={variantsOpen ? 'on' : 'idle'} aria-label="Variants" data-tip="Variants" data-tip-desc="The assembly's variants: its inputs and named sets of their values, one shown regenerated from the master" onClick={() => setVariantsOpen(v => !v)}><Icon name="tune" /></ToolIconButton>}
          </div>))}
  </>;
}
