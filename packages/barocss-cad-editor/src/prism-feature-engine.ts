import {
  tessellateConvexPlanarSolid, updateXYAffinePrismFeatureDocument,
  serializeXYAffinePrismFeatureDocument, parseXYAffinePrismFeatureDocument,
  parseXYAffinePrismFeatureDocumentV2, serializeXYAffinePrismFeatureDocumentV2, updateXYAffinePrismFeatureDocumentV2,
} from '@barocss/cad';
import type { XYAffinePrismFeatureResult, XYAffinePrismFeatureResultV2 } from '@barocss/cad';
import type { PrismDisplayPacket, PrismDisplayComponent } from './prism-feature-scene.js';
import type { PrismFeatureCommand, PrismFeatureReply, CadEditorPrismFeatureSummary } from './prism-feature-types.js';

type NativeResult = XYAffinePrismFeatureResult | XYAffinePrismFeatureResultV2;
const serial = (result: NativeResult): result is XYAffinePrismFeatureResultV2 => result.document.version === 2;
/** Dedicated worker only. Never return retained native geometry to the UI thread. */
export function createPrismFeatureEngine() {
  let accepted: NativeResult | null = null;
  return (command: PrismFeatureCommand): PrismFeatureReply => {
    try {
      let candidate: NativeResult;
      if (command.kind === 'open') {
        if (typeof command.text !== 'string' || command.text.length > 262144)
          throw new Error('Authored input exceeds 262144 characters.');
        if (command.version !== undefined && command.version !== 0 && command.version !== 2) throw new Error('Unsupported explicit document profile.');
        candidate = command.version === 2 ? parseXYAffinePrismFeatureDocumentV2(command.text) : parseXYAffinePrismFeatureDocument(command.text);
      } else {
        if (!accepted) throw new Error('Open an authored document first.');
        const edits = {
          expectedRevision: command.expectedRevision, revision: command.expectedRevision + 1,
          parameterEdits: command.edits,
        };
        candidate = serial(accepted) ? updateXYAffinePrismFeatureDocumentV2(accepted, edits).result : updateXYAffinePrismFeatureDocument(accepted, edits).result;
      }
      // Codec validation is part of acceptance; failure cannot advance worker authority.
      const text = serial(candidate) ? serializeXYAffinePrismFeatureDocumentV2(candidate.document) : serializeXYAffinePrismFeatureDocument(candidate.document);
      const summary: CadEditorPrismFeatureSummary = {
        document: candidate.document, dependencies: candidate.report.dependencies,
        components: candidate.report.componentRoles, volumes: candidate.subtraction.report.volumeMM3,
        selectedWalls: candidate.walls.map(wall => wall.reference),
      };
      const components: PrismDisplayComponent[] = [];
      const append = (role: PrismDisplayComponent['role'], solid: XYAffinePrismFeatureResult['prisms'][number]['solid'], lineage: PrismDisplayComponent['lineage']) => {
        const { mesh, boundaries, internalDiagonals, report } = tessellateConvexPlanarSolid(solid, { maximumFanTriangles: 40 });
        components.push({ role, mesh, boundaries, internalDiagonals, report, lineage: structuredClone(lineage) });
      };
      append('source', candidate.prisms[0].solid, candidate.prisms[0].lineage);
      for (const role of ['first', 'second'] as const) {
        const component = candidate.subtraction[role];
        if (role === 'second' && serial(candidate)) {
          const retained = candidate.chamfer.split.negative;
          if (retained.kind !== 'solid') throw new Error('Serial part requires a final retained solid.');
          const parentSolidId = candidate.document.nodes[5].parent.solidId, finalSolidId = retained.solid.request.options.solidId;
          append(role, retained.solid, { kind: 'serial-part-v2', parentSolidId, finalSolidId,
            original: candidate.prisms[0].lineage, subtraction: component.lineage,
            chamfer: candidate.chamfer.lineage, split: candidate.chamfer.split.lineage, resolution: candidate.chamferResolution });
          summary.serial = { parentSolidId, finalSolidId, resolution: structuredClone(candidate.chamferResolution),
            volumes: structuredClone(candidate.chamfer.split.report.volumeMM3) };
          summary.components = summary.components.map(c => c.role === 'second' ? { ...c, solidId: finalSolidId, status: 'solid' } : c);
        } else if (component.outcome.kind === 'solid') append(role, component.outcome.solid, component.lineage);
      }
      const display: PrismDisplayPacket = { documentId: candidate.document.id, revision: candidate.document.revision,
        components, outcomes: structuredClone(summary.components) };
      if (JSON.stringify(display).length > 2 * 1024 * 1024) throw new Error('Prism display exceeds 2 MiB.');
      accepted = candidate;
      return { id: command.id, ok: true, text, summary, display };
    } catch (cause) {
      const detail = cause as { message?: string; stage?: string; nodeId?: string };
      const context = [detail?.stage, detail?.nodeId].filter(Boolean).join(' / ');
      return { id: command.id, ok: false,
        message: ((context ? context + ': ' : '') + (detail?.message ?? 'Native operation refused.')).slice(0, 2048) };
    }
  };
}
