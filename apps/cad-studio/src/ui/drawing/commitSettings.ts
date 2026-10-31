// What the drawing workspace hands up when settings change: the same canonical form Open reads, so an authored
// drawing equals its reopened self as JSON (key order included).
import { readDrawing, type DrawingSettings } from '@barocss/cad-model/drawing/types';
import type { DrawingScope } from '@barocss/cad-model/drawing/scope';

export const committedSettings = (next: DrawingSettings, scope: DrawingScope): DrawingSettings => readDrawing({ ...next, scope: next.scope ?? scope });
