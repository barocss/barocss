// QA probe: dumps the STEP text the studio writes for one torus (to read its surface entities).
import { stepFor } from '../../src/engine/evaluate';
import { emptyDoc, withNode } from '../../src/engine/doc';
const d = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [30, 10], radius: 5 }), { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
const s = stepFor(d, 'torus'); console.log('text' in s ? s.text : s.error);
