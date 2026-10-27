import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// The studio's icon tool button in shadcn's way (G12f): a ghost icon button, its pressed state the primary fill. Its box —
// 34 px, smaller on a short window — stays styles.css's `.tool` (the rail's media rules), so no size here; `tool`, `on` and
// `off` stay its classes for the CSS of the icons inside it and for the flows.
const toolButtonVariants = cva(
  'tool inline-flex items-center justify-center rounded-md border-0 bg-transparent p-0 text-[color:var(--text-2)] cursor-pointer transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-default disabled:opacity-35',
  {
    variants: {
      state: { idle: '', on: 'on bg-primary text-primary-foreground hover:bg-primary', off: 'off opacity-40' },
      size: { default: '', tiny: 'tiny' },
    },
    defaultVariants: { state: 'idle', size: 'default' },
  },
);

function ToolIconButton({ className, state, size, ...props }: ComponentProps<'button'> & VariantProps<typeof toolButtonVariants>) {
  return <button data-slot="tool-button" type="button" className={cn(toolButtonVariants({ state, size }), className)} {...props} />;
}

export { ToolIconButton, toolButtonVariants };
