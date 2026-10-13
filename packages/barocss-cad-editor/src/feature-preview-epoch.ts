/** Epoch qualification for a non-authoritative CAD extrusion preview.
 * This module never receives geometry and cannot commit an Editor candidate.
 */
export interface CadEditorPreviewEpoch {
  generation: number;
  displayGeneration: number;
  graphId: string;
  revision: number;
  selectedFeatureId: string;
}
export function captureCadEditorPreviewEpoch(input: CadEditorPreviewEpoch): Readonly<CadEditorPreviewEpoch> {
  if (!Number.isSafeInteger(input.generation) || input.generation < 0 ||
      !Number.isSafeInteger(input.displayGeneration) || input.displayGeneration < 0 ||
      !Number.isSafeInteger(input.revision) || input.revision < 0 ||
      typeof input.graphId !== 'string' || !input.graphId ||
      typeof input.selectedFeatureId !== 'string' || !input.selectedFeatureId) {
    throw new TypeError('A qualified accepted Editor preview epoch is required.');
  }
  return Object.freeze({
    generation: input.generation, displayGeneration: input.displayGeneration,
    graphId: input.graphId, revision: input.revision, selectedFeatureId: input.selectedFeatureId,
  });
}
export function isCadEditorPreviewEpochCurrent(
  captured: Readonly<CadEditorPreviewEpoch>, current: CadEditorPreviewEpoch,
): boolean {
  return captured.generation === current.generation &&
    captured.displayGeneration === current.displayGeneration &&
    captured.graphId === current.graphId &&
    captured.revision === current.revision &&
    captured.selectedFeatureId === current.selectedFeatureId;
}
