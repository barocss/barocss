import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// The model's thinking in the chat, after shadcn's AI Reasoning (O17c): one line, "Thinking…", collapsed by default,
// its text when opened. Only when the CLI streams thinking (its `thinking_delta`): with none, nothing is drawn.
function Reasoning({ text, className, ...props }: ComponentProps<'details'> & { text: string }) {
  return <details data-slot="reasoning" className={cn('chat-thinking', 'text-muted-foreground', className)} {...props}>
    <summary className="cursor-pointer select-none">Thinking…</summary>
    <div className="whitespace-pre-wrap">{text}</div>
  </details>;
}

export { Reasoning };
