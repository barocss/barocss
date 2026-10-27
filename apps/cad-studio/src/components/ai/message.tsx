import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// The chat's messages, after shadcn's AI Message (O17): a row per part. The studio's chat classes (chat-msg and its
// role) stay on it — the flow and the studio's CSS read them — with the role as data for the components' own styling.
function Message({ from, className, ...props }: ComponentProps<'div'> & { from: 'user' | 'assistant' | 'notice' }) {
  return <div data-slot="message" data-role={from} className={cn('chat-msg', from, className)} {...props} />;
}

export { Message };
