import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../ui/atoms';
import { CHAT_STRIP } from './useLayout';

/** Whether the column shows (else its strip, laid over the stage's left edge so the canvas keeps its width). */
export const columnShown = (chat: boolean, openProposals: number, decided: number, decidedShown: boolean) =>
  chat || openProposals > 0 || (decidedShown && decided > 0);

/**
 * The left column (G12a): the chat full height — its proposals over the conversation, the input at its bottom — its
 * width dragged at the right edge, or a strip of icons when collapsed. While a proposal is open the column shows it,
 * the chat open or not. `content` is null where the chat cannot show (the Render and Drawing workspaces).
 */
export function ChatColumn({ open, width, onOpen, onWidth, openProposals, decided, decidedShown, onShowDecided, proposals, content }: {
  open: boolean; width: number; onOpen(open: boolean): void; onWidth(width: number): void;
  /** Proposals open, decided (accepted or rejected), and whether the decided ones are shown (they then show the column). */
  openProposals: number; decided: number; decidedShown: boolean; onShowDecided(): void;
  proposals: ReactNode; content: ReactNode;
}) {
  const chat = open && content !== null, shown = columnShown(chat, openProposals, decided, decidedShown);
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget, x0 = e.clientX, w0 = width;
    handle.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => onWidth(w0 + m.clientX - x0);
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
  };
  const openButton = <button className="tool" aria-label="Open chat" title={content === null ? 'The chat opens in Model view' : 'Open the chat'} disabled={content === null} onClick={() => onOpen(true)}><Icon name="chat" /></button>;
  return <aside className={'chat-col' + (shown ? ' open' : '')} style={{ width: shown ? width : CHAT_STRIP }} aria-label="Chat column">
    {shown ? <>
      {proposals}
      {chat ? <div className="chat-col-chat">{content}</div> : <div className="chat-col-closed">{openButton}<span className="muted">The chat is closed.</span></div>}
      <div className="chat-resize" role="separator" aria-orientation="vertical" aria-label="Resize chat" aria-valuenow={width} onPointerDown={drag} />
    </> : <div className="chat-strip">{openButton}
      {decided > 0 && <button className="tool" aria-label="Show decided proposals" title="Show the accepted and rejected proposals" onClick={onShowDecided}><Icon name="history" /></button>}</div>}
  </aside>;
}
