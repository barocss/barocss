/// <reference lib="webworker" />
// Reads parts' mate faces off the main thread (beside the engine worker, which evaluates for display).
import { faceTableOf } from '@barocss/cad-model/assembly/faces';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';

self.onmessage = (event: MessageEvent<{ id: number; doc: StudioDoc }>) => {
  (self as unknown as Worker).postMessage({ id: event.data.id, table: faceTableOf(event.data.doc) });
};
