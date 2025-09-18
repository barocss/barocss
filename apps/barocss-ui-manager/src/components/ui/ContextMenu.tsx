import React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className = '', sideOffset = 4, ...props }, ref) => (
  <ContextMenuPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
    <ContextMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={`z-[40] min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-md
        transition-all duration-150 ease-out
        data-[state=open]:opacity-100 data-[state=open]:scale-100
        data-[state=closed]:opacity-0 data-[state=closed]:scale-95 data-[state=closed]:pointer-events-none data-[state=closed]:hidden
        ${className}`}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className = '', ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={`relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors
      focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
    {...props}
  />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className = '', ...props }, ref) => (
  <ContextMenuPrimitive.Separator ref={ref} className={`-mx-1 my-1 h-px bg-gray-100 ${className}`} {...props} />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
}


