import { parseBooleanExtrusionFeatureGraph } from '@barocss/cad';
import type { BooleanExtrusionFeatureGraphOptions, BooleanExtrusionFeatureGraphResult } from '@barocss/cad';

export interface BaroCadBooleanExtrusionFeatureGraphRead {
  readonly authoredText: string;
  readonly native: BooleanExtrusionFeatureGraphResult;
}

/** Preserve the authored text while the CAD parser admits and evaluates its own graph. */
export function readBaroCadBooleanExtrusionFeatureGraph(
  text: string,
  options: BooleanExtrusionFeatureGraphOptions,
): BaroCadBooleanExtrusionFeatureGraphRead {
  const native = parseBooleanExtrusionFeatureGraph(text, options);
  return Object.freeze({ authoredText: text, native });
}
