// What the drawing's SHEET settings and the workspace share (O16): the front view's sides as named, a source's table on or off.
import type { Orientation } from '@barocss/cad-model/drawing/views';
import type { DrawingSettings } from '@barocss/cad-model/drawing/types';

/** The front view's sides, as the SHEET card names them (R14.3b). */
export const SIDE_NAMES: Record<Orientation, string> = { 'y-': '−Y (default)', 'x+': '+X', 'y+': '+Y', 'x-': '−X' };
/** The settings with a source's table on or off (its id the source's name); no tables left, none kept. */
export function withTable(settings: DrawingSettings, from: string, on: boolean): DrawingSettings {
  const rest = (settings.tables ?? []).filter(x => x.from !== from), tables = on ? [...rest, { id: from, from }] : rest;
  const { tables: _t, ...base } = settings; void _t;
  return tables.length ? { ...base, tables } : base;
}

/** The settings rows' look on shadcn (O16): a label and its control on one line, the control at the right. */
export const FIELD = 'flex items-center justify-between gap-2 py-0.5 text-[11px] [&>span:first-child]:text-muted-foreground [&>span:first-child]:shrink-0';
/** A select or text field in a row, and a tick. */
export const CONTROL = 'w-auto max-w-[62%]', TICK = 'size-3.5 accent-[var(--accent)]';
