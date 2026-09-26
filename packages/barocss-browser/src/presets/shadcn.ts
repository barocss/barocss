/**
 * shadcn/ui theme preset for the BaroCSS browser runtime.
 *
 * Use it next to a Tailwind-4 shadcn build so runtime-generated classes
 * (`bg-primary`, `bg-primary/90`, `rounded-lg`, ...) resolve to the app's theme:
 *
 *   baroStart({ config: { theme: { extend: shadcnTheme } } });
 *
 * It references the RAW `:root` variables shadcn defines (`--primary`, `--radius`),
 * not `--color-*`: `@theme inline` does not emit `--color-*` / `--radius-*` to the page.
 * Custom tokens must be added by extending the colors yourself.
 */
const SHADCN_COLOR_NAMES = [
  'background', 'foreground',
  'card', 'card-foreground', 'popover', 'popover-foreground',
  'primary', 'primary-foreground', 'secondary', 'secondary-foreground',
  'muted', 'muted-foreground', 'accent', 'accent-foreground',
  'destructive', 'border', 'input', 'ring',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
  'sidebar', 'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground',
  'sidebar-accent', 'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring',
] as const;

export const shadcnTheme = {
  colors: Object.fromEntries(SHADCN_COLOR_NAMES.map((n) => [n, `var(--${n})`])) as Record<string, string>,
  borderRadius: {
    sm: 'calc(var(--radius) - 4px)',
    md: 'calc(var(--radius) - 2px)',
    lg: 'var(--radius)',
    xl: 'calc(var(--radius) + 4px)',
  } as Record<string, string>,
};
