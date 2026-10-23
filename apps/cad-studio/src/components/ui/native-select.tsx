import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui's NativeSelect: the browser's own select, styled as the other inputs (O16; Radix's Select is not a dependency).
function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="native-select" className={cn('h-5 w-full min-w-0 rounded-md border border-input bg-transparent px-1 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', className)} {...props} />;
}

export { NativeSelect };
