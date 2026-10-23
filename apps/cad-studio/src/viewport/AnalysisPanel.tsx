import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { MapKind } from './scalarMaps';

export type SurfaceAnalysis = 'zebra' | 'curvature' | 'overhang';
export type AnalysisMap = MapKind | 'parting' | 'halves';

/**
 * The Analysis preview's settings (G12e): the surface analysis and the analysis map, the same choices the view bar's
 * Analyse and Maps buttons step through. Overhang needs a printing process, draft and the mould's line and halves a pull;
 * the maps are drawn with WebGPU (`mapsReason` otherwise). Both off leaves the Analysis preview.
 */
export function AnalysisPanel({ analysis, onAnalysis, map, onMap, printing, pull, mapsReason }: {
  analysis: SurfaceAnalysis | null; onAnalysis(value: SurfaceAnalysis | null): void;
  map: AnalysisMap | null; onMap(value: AnalysisMap | null): void;
  printing: boolean; pull: boolean; mapsReason?: string;
}) {
  const surfaces: [SurfaceAnalysis, string][] = [['zebra', 'Zebra'], ['curvature', 'Curvature'], ...(printing ? [['overhang', 'Overhang'] as [SurfaceAnalysis, string]] : [])];
  const maps: [AnalysisMap, string][] = [['thickness', 'Thickness'], ...(pull ? [['draft', 'Draft'] as [AnalysisMap, string]] : []), ['access', 'Access'],
    ...(pull ? [['parting', 'Parting'], ['halves', 'Halves']] as [AnalysisMap, string][] : [])];
  return <div className="card" aria-label="Analysis" style={{ padding: '6px 10px', maxWidth: 420 }}>
    <div className="analysis-row"><span className="muted">Surface</span>
      <ToggleGroup type="single" value={analysis ?? ''} onValueChange={v => onAnalysis((v || null) as SurfaceAnalysis | null)} aria-label="Surface analysis kind">
        {surfaces.map(([id, label]) => <ToggleGroupItem key={id} value={id} aria-label={'Surface: ' + label}>{label}</ToggleGroupItem>)}
      </ToggleGroup></div>
    <div className="analysis-row"><span className="muted">Map</span>
      <ToggleGroup type="single" value={map ?? ''} disabled={!!mapsReason} onValueChange={v => onMap((v || null) as AnalysisMap | null)} aria-label="Analysis map kind">
        {maps.map(([id, label]) => <ToggleGroupItem key={id} value={id} aria-label={'Map: ' + label}>{label}</ToggleGroupItem>)}
      </ToggleGroup></div>
    {mapsReason && <div className="muted">{mapsReason}</div>}
  </div>;
}
