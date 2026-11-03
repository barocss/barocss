// What the drawing workspace hands up when settings change: the same canonical form Open reads, so an authored
// drawing equals its reopened self as JSON (key order included).
import { readDrawing, type DrawingSettings } from '@barocss/cad-model/drawing/types';
import { forSheet, mergeSheet } from '@barocss/cad-model/drawing/sheets';
import type { DrawingScope } from '@barocss/cad-model/drawing/scope';

export const committedSettings = (next: DrawingSettings, scope: DrawingScope): DrawingSettings => readDrawing({ ...next, scope: next.scope ?? scope });

/** The active sheet after the workspace's merge and canonical commit; also the identity a Fix round waits for. */
export const committedSheetSettings = (whole: DrawingSettings, current: number, next: DrawingSettings, scope: DrawingScope): DrawingSettings =>
  forSheet(committedSettings(mergeSheet(whole, current, next), scope), current);
