import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui's Input, for the dense panels (O16). The studio's CSS (its element and panel rules for inputs) is in
// `@layer legacy`, so these utilities win over it (preflight is off, G12b).
function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn('h-6 min-w-0 rounded-md border border-input bg-transparent px-1.5 py-0 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 placeholder:text-muted-foreground', className)} {...props} />;
}

export { Input };
