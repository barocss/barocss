import type { ComponentProps } from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui's ToggleGroup, its item's look kept here (no separate Toggle): a segmented choice, one on at a time with
// type="single".
const toggleVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-md border-0 bg-transparent cursor-pointer px-2 h-6 text-[11px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
);

function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root data-slot="toggle-group" className={cn('inline-flex flex-wrap items-center gap-0.5 rounded-md border border-border p-0.5', className)} {...props} />;
}

function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item data-slot="toggle-group-item" className={cn(toggleVariants(), className)} {...props} />;
}

export { ToggleGroup, ToggleGroupItem, toggleVariants };
