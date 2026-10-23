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

export { CONTROL, FIELD, TICK } from '../panelStyles';
