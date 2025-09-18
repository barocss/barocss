import React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger
const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className = '', ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-[80] bg-black/80 transition-opacity duration-150 
      data-[state=open]:opacity-100 
      data-[state=closed]:opacity-0 data-[state=closed]:pointer-events-none data-[state=closed]:hidden ${className}`}
    {...props}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className = '', children, ...props }, ref) => (
  <AlertDialogPortal container={typeof document !== 'undefined' ? document.body : undefined}>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={`fixed left-1/2 top-1/2 z-[90] grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl 
        transition-all duration-150 ease-out 
        data-[state=open]:opacity-100 data-[state=open]:scale-100 
        data-[state=closed]:opacity-0 data-[state=closed]:scale-95 data-[state=closed]:pointer-events-none data-[state=closed]:hidden ${className}`}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Content>
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 text-left ${className}`} {...props} />
)
AlertDialogHeader.displayName = 'AlertDialogHeader'

const AlertDialogFooter = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex justify-end gap-2 ${className}`} {...props} />
)
AlertDialogFooter.displayName = 'AlertDialogFooter'

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className = '', ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={`text-base font-semibold ${className}`} {...props} />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className = '', ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={`text-sm text-gray-600 ${className}`} {...props} />
))
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className = '', ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={`inline-flex h-9 items-center rounded-md bg-gray-900 px-3 text-sm text-white hover:bg-gray-800 transition-colors ${className}`} {...props} />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className = '', ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={`inline-flex h-9 items-center rounded-md bg-gray-100 px-3 text-sm text-gray-900 hover:bg-gray-200 transition-colors ${className}`} {...props} />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}


