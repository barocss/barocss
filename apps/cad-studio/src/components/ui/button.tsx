import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui's Button, sized for the studio's dense panels (O16): `sm` the panels' small action, `xs` a row's own. (Preflight
// is off, G12b: the browser's own button border is set transparent here, and the type is important — styles.css's unlayered
// `button { font: inherit }` would win over a layer — so every variant, and a label as a Button, matches.)
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent font-medium! leading-none! transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        outline: 'border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
        ghost: 'bg-transparent hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
      },
      size: { default: 'h-7 px-2.5 text-xs!', sm: 'h-6 px-2 text-[11px]!', xs: 'h-5 px-1.5 text-[10px]!' },
    },
    defaultVariants: { variant: 'outline', size: 'sm' },
  },
);

function Button({ className, variant, size, asChild = false, ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
