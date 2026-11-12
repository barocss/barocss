import { useEffect, useState, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import { findOverlaidLines, OVERLAID_LINE_SCAN_LIMIT, type OverlaidLinesReport } from './overlaidLines';

interface Scan {
  doc: StudioDoc;
  generation: number;
  plane: SketchState['plane'];
  shape: SketchState['shape'];
  done: SketchState['done'];
  report: OverlaidLinesReport;
  selected?: { group: number; occurrence?: number };
}

export function useOverlaidLines(doc: StudioDoc, sketch: SketchState | null, docNow: RefObject<StudioDoc>, generation: RefObject<number>) {
  const [scan, setScan] = useState<Scan | null>(null);
  const enabled = sketch?.tool === 'select';
  const visible = enabled && scan && scan.doc === doc && scan.generation === generation.current &&
    scan.plane === sketch.plane && scan.shape === sketch.shape && scan.done === sketch.done ? scan : null;
  useEffect(() => { if (scan && !visible) setScan(null); }, [scan, visible]);
  const selection = visible?.selected;
  const highlight = visible && selection && visible.report.status === 'complete'
    ? visible.report.groups[selection.group]?.[selection.occurrence ?? 0] : undefined;
  return {
    enabled, report: visible?.report, selection, highlight,
    start() {
      if (!enabled || docNow.current !== doc) return;
      const { plane, shape, done } = sketch;
      const report: OverlaidLinesReport = (done?.length ?? 0) + Number(!!shape) > OVERLAID_LINE_SCAN_LIMIT
        ? { status: 'scan-limit' } : findOverlaidLines([...(done ?? []), ...(shape ? [shape] : [])]);
      setScan({ doc, generation: generation.current, plane, shape, done, report });
    },
    choose(group: number, occurrence?: number) {
      if (visible && docNow.current === doc && visible.generation === generation.current) {
        setScan({ ...visible, selected: { group, occurrence } });
      }
    },
    close() {
      if (!visible) return false;
      setScan(null);
      return true;
    },
  };
}
