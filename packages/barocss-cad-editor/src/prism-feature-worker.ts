import { createPrismFeatureEngine } from './prism-feature-engine.js';
import type { PrismFeatureCommand } from './prism-feature-types.js';
const run = createPrismFeatureEngine();
const scope = self as unknown as { onmessage: ((event: MessageEvent<PrismFeatureCommand>) => void) | null; postMessage(value: unknown): void };
scope.onmessage = event => scope.postMessage(run(event.data));
