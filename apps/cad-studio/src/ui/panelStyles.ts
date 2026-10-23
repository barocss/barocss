// The dense panels' rows on shadcn (O16): a setting's label and its control on one line, the control at the right; a list
// row; a select or text field in a row; a tick. (Shared by the Library, the drawing's settings and the panels after them.)
export const FIELD = 'flex items-center justify-between gap-2 py-0.5 text-[11px] [&>span:first-child]:text-muted-foreground [&>span:first-child]:shrink-0';
export const ROW = 'flex items-center gap-1 py-0.5 [&>:first-child]:min-w-0 [&>:first-child]:flex-1 [&>:first-child]:truncate';
export const CONTROL = 'w-auto max-w-[62%]', TICK = 'size-3.5 accent-[var(--accent)]';
/** A number box with its unit inside it at the right (was styles.css `.field .num`). */
export const NUM = 'relative block w-28 [&>input]:w-full [&>input]:pr-7! [&>em]:absolute [&>em]:right-1.5 [&>em]:top-1/2 [&>em]:-translate-y-1/2 [&>em]:text-[10px] [&>em]:not-italic [&>em]:font-mono [&>em]:text-muted-foreground [&>em]:pointer-events-none';
/** A range input and its value (was `.field .slider`). */
export const SLIDER = 'grid w-[62%] grid-cols-[minmax(0,1fr)_36px] items-center gap-1.5 [&>input]:h-[18px] [&>input]:p-0 [&>input]:accent-[var(--accent)] [&>em]:not-italic [&>em]:font-mono [&>em]:text-[11px] [&>em]:text-muted-foreground [&>em]:text-right';
