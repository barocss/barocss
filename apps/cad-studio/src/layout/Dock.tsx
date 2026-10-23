import type { ReactNode } from 'react';
import { Icon } from '../ui/atoms';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CHAT_STRIP } from './useLayout';

/**
 * The right dock (G12b): the Browser, then the inspector (the part or the selection, measure, joints, mates…, the
 * running command, Rebuild), BOM and the other on-demand panels, one under another in one scrolling column — nothing
 * floats over another panel. Where the window has no room for it beside the centre it is a strip at the stage's right
 * edge, and its button opens it as a sheet over the viewport (over no other panel).
 */
export function Dock({ width, docked, sheet, onSheet, children }: {
  width: number; docked: boolean; sheet: boolean; onSheet(open: boolean): void; children: ReactNode;
}) {
  const body = <ScrollArea className="dock-scroll"><div className="dock-body">{children}</div></ScrollArea>;
  if (docked) return <aside className="dock" style={{ width }} aria-label="Dock">{body}</aside>;
  return <>
    <div className="dock-strip" style={{ width: CHAT_STRIP }}>
      <button className={'tool' + (sheet ? ' on' : '')} aria-label={sheet ? 'Close the dock' : 'Open the dock'} title={sheet ? 'Close the dock' : 'The Browser, the inspector and the panels'} onClick={() => onSheet(!sheet)}>
        <Icon name={sheet ? 'right_panel_close' : 'right_panel_open'} /></button>
    </div>
    {sheet && <aside className="dock sheet" style={{ width, right: CHAT_STRIP }} aria-label="Dock">{body}</aside>}
  </>;
}
