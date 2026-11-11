import type { FeatureFailure } from '../app/failedFeature';

export function FeatureFailureNotice({ error }: { error: FeatureFailure }) {
  return <div className="hud-error" role="status">
    <div className="hud-error-title">{error.title}</div>
    <div>{error.hint}</div>
    {error.failedFeature && <div className="hud-error-feature">Failed feature · {error.failedFeature}</div>}
    {error.detail && <details><summary onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}>Kernel detail</summary><code>{error.detail}</code></details>}
  </div>;
}
