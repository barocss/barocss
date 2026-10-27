import type { ComponentProps } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '@/lib/utils';

// shadcn/ui's Command (cmdk): a searchable list with keyboard selection. The studio ranks its own list (paletteList), so
// the palette passes shouldFilter={false}.
function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn('flex flex-col overflow-hidden text-popover-foreground', className)} {...props} />;
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return <CommandPrimitive.Input data-slot="command-input" className={cn('flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] placeholder:text-muted-foreground', className)} {...props} />;
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn('overflow-y-auto overflow-x-hidden', className)} {...props} />;
}

function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="px-3 py-4 text-center text-[12px] text-muted-foreground" {...props} />;
}

function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return <CommandPrimitive.Item data-slot="command-item"
    className={cn('relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none data-[selected=true]:bg-accent', className)} {...props} />;
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandItem };
