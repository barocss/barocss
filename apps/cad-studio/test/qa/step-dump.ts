// QA probe: dumps the STEP text the studio writes for one torus (to read its surface entities).
import { exportStudioStep } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';

/** The STEP file, or the refusal's words, as the probe reports them (R7.3c: exportStudioStep throws). */
const stepOr = (doc: StudioDoc, name: string): ReturnType<typeof exportStudioStep> | { error: string } => { try { return exportStudioStep(doc, { name }); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; } };
const d = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [30, 10], radius: 5 }), { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
const s = stepOr(d, 'torus'); console.log('text' in s ? s.text : s.error);
