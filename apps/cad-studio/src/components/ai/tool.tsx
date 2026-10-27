import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// One tool call in the chat, after shadcn's AI Tool (O17): its name and the result's summary in one line, its input
// below when opened. A failed call is marked by its icon and the `err` state (a chip-like tint, never a left border).
function Tool({ failed, label, summary, icon, className, children, ...props }: ComponentProps<'details'> & { failed: boolean; label: string; summary: string; icon: ReactNode }) {
  return <details data-slot="tool" data-state={failed ? 'error' : 'done'} className={cn('chat-tool', failed && 'err', className)} {...props}>
    <summary>{icon}<span className="mono">{label}</span> <span className="chat-sum">{summary}</span></summary>
    {children}
  </details>;
}

export { Tool };
