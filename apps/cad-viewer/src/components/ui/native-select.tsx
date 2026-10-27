// Local shadcn/ui source, shared in form with CAD Studio.
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="native-select" className={cn('h-5 w-full min-w-0 rounded-md border border-input bg-transparent px-1 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', className)} {...props} />;
}

export { NativeSelect };
