import { createModelingEngine } from './modeling-engine.js';
import type { ModelingCommand } from './modeling-engine.js';
const run = createModelingEngine();
const scope = self as unknown as { onmessage: ((event: MessageEvent<ModelingCommand>) => void) | null; postMessage(value: unknown): void };
scope.onmessage = event => scope.postMessage(run(event.data));
