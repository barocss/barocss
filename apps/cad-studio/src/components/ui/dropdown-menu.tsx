import type { ComponentProps } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

// shadcn/ui's DropdownMenu, the studio's dense sizes: the shell's menus (a right-click's, More tools, More shapes), keyboard
// navigation and dismissal Radix's.
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

/** `portal`: off to render it where it is used (a bar's menu its flows find inside the bar). */
function DropdownMenuContent({ className, sideOffset = 4, collisionPadding = 8, portal = true, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Content> & { portal?: boolean }) {
  const content = <DropdownMenuPrimitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} collisionPadding={collisionPadding}
    className={cn('z-30 min-w-[180px] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-[12px] text-popover-foreground shadow-md', className)} {...props} />;
  return portal ? <DropdownMenuPrimitive.Portal>{content}</DropdownMenuPrimitive.Portal> : content;
}

function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item data-slot="dropdown-menu-item"
    className={cn('relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props} />;
}

function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return <DropdownMenuPrimitive.Label data-slot="dropdown-menu-label" className={cn('px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground', className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator };
