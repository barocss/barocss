// The dense panels' rows on shadcn (O16): a setting's label and its control on one line, the control at the right; a list
// row; a select or text field in a row; a tick. (Shared by the Library, the drawing's settings and the panels after them.)
export const FIELD = 'flex items-center justify-between gap-2 py-0.5 text-[11px] [&>span:first-child]:text-muted-foreground [&>span:first-child]:shrink-0';
export const ROW = 'flex items-center gap-1 py-0.5 [&>:first-child]:min-w-0 [&>:first-child]:flex-1 [&>:first-child]:truncate';
export const CONTROL = 'w-auto max-w-[62%]', TICK = 'size-3.5 accent-[var(--accent)]';
