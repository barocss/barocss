import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createMeshImportController, type MeshImportOptions } from './meshImportController';
export type { MeshQuestion, MeshOpenInput, RepairQuestion, MeshImportOptions, MeshImportController } from './meshImportController';

/** Keep workflow ownership synchronous while React schedules its next render. */
export function useMeshImport(options: MeshImportOptions) {
  const latest = useRef(options); latest.current = options;
  const controller = useMemo(() => createMeshImportController(() => latest.current), []);
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => () => controller.invalidate(), [controller]);
  return controller;
}
