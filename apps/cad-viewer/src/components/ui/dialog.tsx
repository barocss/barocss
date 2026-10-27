// Local shadcn/ui source, shared in form with CAD Studio.
import type { ComponentProps } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;
const DialogClose = DialogPrimitive.Close;

function DialogContent({ className, overlayClassName, children, ...props }: ComponentProps<typeof DialogPrimitive.Content> & { overlayClassName?: string }) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay data-slot="dialog-overlay" className={cn('fixed inset-0 z-40 bg-black/40', overlayClassName)} />
    <DialogPrimitive.Content data-slot="dialog-content"
      className={cn('fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none', className)} {...props}>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>;
}

export { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose };
