import type { Dispatch, SetStateAction } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { ToolIconButton } from '@/components/ui/tool-button';
import { whenOf } from '../app/studioConstants';
import { Icon } from './atoms';
interface DesignHistoryProps { doc: StudioDoc; historyOpen: boolean; setHistoryOpen: Dispatch<SetStateAction<boolean>>; saveShared(): void }
export function DesignHistory({ doc, historyOpen, setHistoryOpen, saveShared }: DesignHistoryProps) {
  return <>
        {!!doc.history?.length && <><div className="ol-head req-head">Design history <span className="muted">{doc.history.length}</span>
          <ToolIconButton size="tiny" state={historyOpen ? 'on' : 'idle'} aria-label="Show design history" data-tip={historyOpen ? 'Hide' : 'Show'} onClick={() => setHistoryOpen(f => !f)}><Icon name={historyOpen ? 'expand_less' : 'expand_more'} small /></ToolIconButton></div>
        <div className="empty history-note">Saved with the part, chat messages included. <button className="link" onClick={saveShared}>Save a copy without it</button> to share.</div>
        {historyOpen && doc.history.slice(-40).reverse().map(h => <div key={h.id} className={'hist ' + h.kind} title={h.prompt ?? h.plan ?? h.summary}>
          <span className="mono muted">{h.kind}</span> {h.kind === 'prompt' ? `“${(h.prompt ?? '').slice(0, 80)}${(h.prompt?.length ?? 0) > 80 ? '…' : ''}”` : h.summary}
          {h.kind === 'prompt' && h.summary && <span className="muted"> → {h.summary}</span>}
          <span className="muted"> · {h.by.agent}{h.by.model ? ` (${h.by.model})` : ''} · {whenOf(h.at)}</span></div>)}</>}
  </>;
}
