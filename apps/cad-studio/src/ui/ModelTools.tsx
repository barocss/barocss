import { useId, useState, type Dispatch, type SetStateAction, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
import type { Command, Ctx } from '@barocss/cad-model/app/commands';
import type { SketchState } from '../viewport/Viewport';
import { TOOLS, switchTool } from '../app/sketchControls';
import { TOOL_GROUPS, GROUP_COMMANDS, PLACE_COMMANDS } from '../app/studioConstants';
import { contextualModelCommand, primaryModelCommands } from '../app/modelRail';
import { CommandButtons, ToolButton, commandStates } from './ToolButton';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';

interface ModelToolsProps {
  sketch: SketchState | null;
  setSketch: Dispatch<SetStateAction<SketchState | null>>;
  clearSketchProfile(): void;
  sketchWorkspace: {
    request(event: MouseEvent<HTMLButtonElement>): void;
    rememberFocus(event: PointerEvent<HTMLButtonElement>): void;
  };
  command: {
    ctx: Ctx; current: boolean; activeId: string | null; startTool(command: Command): void;
    toolDragStart(command: Command, event: DragEvent): void; toolDragEnd(command: Command, event: DragEvent): void;
  };
  panels: {
    bomOpen: boolean; setBomOpen: Dispatch<SetStateAction<boolean>>;
    rebuildOpen: boolean; setRebuildOpen: Dispatch<SetStateAction<boolean>>;
    variantsOpen: boolean; setVariantsOpen: Dispatch<SetStateAction<boolean>>;
  };
}

const LABELS = { shapes: 'Shapes', create: 'Create', modify: 'Modify', pattern: 'Pattern', combine: 'Combine', inspect: 'Inspect' } as const;
const GROUPS = [
  { name: 'shapes', list: PLACE_COMMANDS } as const,
  ...TOOL_GROUPS.map((name, index) => ({ name, list: GROUP_COMMANDS[index] })),
];

function InspectButtons({ bomOpen, setBomOpen, rebuildOpen, setRebuildOpen, variantsOpen, setVariantsOpen }: ModelToolsProps['panels']) {
  return <>
    <ToolIconButton state={bomOpen ? 'on' : 'idle'} aria-label="BOM" data-tip="Bill of materials" data-tip-desc="The parts and bought elements, bought or made, and the purchase list"
      onClick={() => setBomOpen(v => !v)}><Icon name="cad-bom" /></ToolIconButton>
    <ToolIconButton state={rebuildOpen ? 'on' : 'idle'} aria-label="Rebuild" data-tip="Rebuild" data-tip-desc="What the last rebuild cost: each feature built or reused, its time and kernel calls"
      onClick={() => { setBomOpen(false); setRebuildOpen(v => !v); }}><Icon name="cad-rebuild" /></ToolIconButton>
    <ToolIconButton state={variantsOpen ? 'on' : 'idle'} aria-label="Variants" data-tip="Variants" data-tip-desc="The assembly's variants: its inputs and named sets of their values, one shown regenerated from the master"
      onClick={() => setVariantsOpen(v => !v)}><Icon name="tune" /></ToolIconButton>
  </>;
}

function ModelCommandRail({ command, panels, sketchWorkspace }: Pick<ModelToolsProps, 'command' | 'panels' | 'sketchWorkspace'>) {
  const [expanded, setExpanded] = useState<keyof typeof LABELS | null>(null);
  const groupId = useId();
  const { ctx, current, activeId, startTool, toolDragStart, toolDragEnd } = command;
  const handlers = { onStart: startTool, onDragStart: toolDragStart, onDragEnd: toolDragEnd };
  const contextual = contextualModelCommand(ctx, current);
  const named = contextual ? [...primaryModelCommands, contextual] : primaryModelCommands;
  return <div className="model-command-rail" onKeyDown={event => {
    // Enter activates the focused rail button. The workspace handler applies a draft from the canvas.
    if (event.key === 'Enter' && event.target instanceof Element && event.target.closest('button')) event.stopPropagation();
  }}>
    <div className="model-commands" role="group" aria-label="Model commands">
      {named.map(c => {
        const available = c.available(ctx);
        return <ToolButton key={c.id} c={c} ok={available.ok} reason={available.ok ? '' : available.reason}
          on={activeId === c.id} showLabel {...handlers}
          onStart={c.id === 'sketch' ? (_, event) => sketchWorkspace.request(event) : startTool}
          onPointerDown={c.id === 'sketch' ? sketchWorkspace.rememberFocus : undefined} />;
      })}
    </div>
    <div className="model-command-groups">
      {GROUPS.map(({ name, list }) => {
        const open = expanded === name, label = LABELS[name], id = groupId + '-' + name;
        return <div key={name}>
          <ToolIconButton className="model-group-trigger justify-between px-1.5" aria-expanded={open} aria-controls={id}
            onClick={() => setExpanded(open ? null : name)}>
            <span>{label}</span><Icon name={open ? 'expand_more' : 'chevron_right'} small />
          </ToolIconButton>
          <div id={id} className="tool-group" role="group" aria-label={label} hidden={!open}>
            {open && <>
              <CommandButtons list={list} {...commandStates(list, ctx)} activeId={activeId} {...handlers} />
              {name === 'inspect' && <InspectButtons {...panels} />}
            </>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

export function ModelTools({ sketch, setSketch, clearSketchProfile, command, panels, sketchWorkspace }: ModelToolsProps) {
  if (!sketch) return <ModelCommandRail command={command} panels={panels} sketchWorkspace={sketchWorkspace} />;
  return <>
    {TOOLS.map(t => (
      <ToolIconButton key={t.tool} state={sketch.tool === t.tool ? 'on' : 'idle'} data-tip={t.label} data-tip-key={t.key} data-tip-desc={t.hint} aria-label={t.label}
        onClick={() => setSketch(s => s && switchTool(s, t.tool))}><Icon name={t.icon} /></ToolIconButton>))}
    <div className="sep" />
    <ToolIconButton state={sketch.construct ? 'on' : 'idle'} data-tip="Construction" data-tip-key="X" data-tip-desc="Draw references: dashed shapes to snap to, not part of the profile" aria-label="Construction"
      onClick={() => setSketch(s => s && { ...s, construct: !s.construct })}><Icon name="cad-sk-construction" /></ToolIconButton>
    {(sketch.done ?? []).some(d => d.construction) && <ToolIconButton state={sketch.hideConstruction ? 'on' : 'idle'} data-tip={sketch.hideConstruction ? 'Show construction' : 'Hide construction'} data-tip-desc="The dashed reference shapes: hidden ones are not drawn or snapped to, and stay with the sketch" aria-label={sketch.hideConstruction ? 'Show construction' : 'Hide construction'}
      onClick={() => setSketch(s => s && { ...s, hideConstruction: !s.hideConstruction })}><Icon name={sketch.hideConstruction ? 'visibility_off' : 'visibility'} /></ToolIconButton>}
    <ToolIconButton data-tip="Clear profile" data-tip-desc="Remove every shape drawn in this sketch" aria-label="Clear profile" onClick={clearSketchProfile}><Icon name="ink_eraser" /></ToolIconButton>
  </>;
}
