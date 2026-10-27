import { Button } from './components/ui/button';

export type MeasurementPoint = {
  label: string;
  kind: 'surface' | 'curve';
  pointMM: number[];
  parameterLabel: string;
};

export type DistanceMeasurement = {
  active: boolean;
  points: MeasurementPoint[];
  result: null | { distanceMM: number };
  error: string;
};

type DistancePanelProps = {
  measurement: DistanceMeasurement;
  onStart: () => void;
  onCancel: () => void;
  onClear: () => void;
};

function formatMM(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const fixed = value.toFixed(6);
  const rounded = fixed.includes('.') && !fixed.includes('e') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return rounded === '-0' ? '0' : rounded;
}

export function DistancePanel({ measurement, onStart, onCancel, onClear }: DistancePanelProps) {
  const { active, points, result, error } = measurement;
  const distance = result && Number.isFinite(result.distanceMM) ? result.distanceMM : null;

  return <section className="inspector-section distance-section" aria-labelledby="measure-heading">
    <div className="section-heading distance-heading">
      <h3 id="measure-heading">Distance</h3>
      <span className="distance-mode">Point to point</span>
    </div>
    <div className="distance-actions">
      {active
        ? <Button id="measure-cancel" type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        : <Button id="measure-start" type="button" variant="outline" size="sm" onClick={onStart}>Start</Button>}
      <Button id="measure-clear" type="button" variant="ghost" size="sm" onClick={onClear}
        disabled={points.length === 0 && result === null}>Clear</Button>
    </div>
    {active && <p className="distance-instruction" role="status">{points.length === 0 ? 'Point A' : 'Point B'}</p>}
    <div className="distance-points">
      {(['A', 'B'] as const).map((endpoint, index) => {
        const point = points[index];
        return <div className="distance-point" key={endpoint} data-endpoint={endpoint}>
          <span className="distance-point-marker" aria-hidden="true">{endpoint}</span>
          <div className="distance-point-details">
            <div className="distance-point-source">
              <span className="distance-point-label">{endpoint}: {point?.label || 'Not set'}</span>
              {point && <span className="distance-point-kind">{point.kind === 'surface' ? 'Surface' : 'Curve'}</span>}
            </div>
            {point && <>
              <p className="distance-point-parameter">{point.parameterLabel}</p>
              <dl className="distance-coordinates" aria-label={`Point ${endpoint} coordinates in millimeters`}>
                {(['X', 'Y', 'Z'] as const).map((axis, axisIndex) => <div key={axis}>
                  <dt>{axis}</dt><dd>{formatMM(point.pointMM[axisIndex])}</dd>
                </div>)}
              </dl>
              <span className="distance-coordinate-unit">mm</span>
            </>}
          </div>
        </div>;
      })}
    </div>
    <div className="distance-result" aria-live="polite" aria-atomic="true">
      <span className="distance-result-label">Straight-line distance</span>
      <div><output id="measure-distance" aria-label="Straight-line distance in millimeters">{distance === null ? '—' : formatMM(distance)}</output>
        {distance !== null && <span className="distance-unit">mm</span>}</div>
    </div>
    {error && <p id="measure-error" className="distance-error" role="alert">{error}</p>}
  </section>;
}

export type ProjectedMeasurementPoint = { label: 'A' | 'B'; xCss: number; yCss: number };

export function MeasurementOverlay({ points, width, height }: {
  points: ProjectedMeasurementPoint[];
  width: number;
  height: number;
}) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const visiblePoints = points.filter(point => Number.isFinite(point.xCss) && Number.isFinite(point.yCss));
  const [first, second] = visiblePoints;
  const labelInsetX = Math.min(10, width / 2);
  const labelInsetY = Math.min(14, height / 2);

  return <svg className="measurement-overlay" data-testid="measure-overlay" viewBox={`0 0 ${width} ${height}`}
    width={width} height={height} preserveAspectRatio="none" aria-hidden="true" focusable="false"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
    {first && second && <g>
      <line className="measurement-line-underlay" x1={first.xCss} y1={first.yCss} x2={second.xCss} y2={second.yCss} />
      <line className="measurement-line" x1={first.xCss} y1={first.yCss} x2={second.xCss} y2={second.yCss} />
    </g>}
    {visiblePoints.map(point => <g key={point.label}>
      <circle className="measurement-point" cx={point.xCss} cy={point.yCss} r="4" />
      <text className="measurement-point-text" x={Math.max(labelInsetX, Math.min(width - labelInsetX, point.xCss + 10))}
        y={Math.max(labelInsetY, Math.min(height - labelInsetY, point.yCss - 10))}>{point.label}</text>
    </g>)}
  </svg>;
}
