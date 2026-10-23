import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui's Table, for the dense panels (O16): fixed column widths (`table-fixed`), so a table fits the dock and its
// cells truncate rather than wrap.
function Table({ className, ...props }: ComponentProps<'table'>) {
  return <table data-slot="table" className={cn('w-full table-fixed caption-bottom border-collapse text-[11px]', className)} {...props} />;
}
function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b [&_tr]:border-border', className)} {...props} />;
}
function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}
function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={cn('border-b border-border hover:bg-accent/50', className)} {...props} />;
}
function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return <th data-slot="table-head" className={cn('h-6 px-1 text-left align-middle font-medium text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis', className)} {...props} />;
}
function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('h-6 px-1 align-middle whitespace-nowrap overflow-hidden text-ellipsis', className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
