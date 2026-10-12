import {
  tessellateConvexPlanarSolid, updateXYAffinePrismFeatureDocument,
  serializeXYAffinePrismFeatureDocument, parseXYAffinePrismFeatureDocument,
} from '@barocss/cad';
import type { XYAffinePrismFeatureResult } from '@barocss/cad';
import type { PrismDisplayPacket, PrismDisplayComponent } from './prism-feature-scene.js';
import type { PrismFeatureCommand, PrismFeatureReply } from './prism-feature-types.js';

/** Dedicated worker only. Never return retained native geometry to the UI thread. */
export function createPrismFeatureEngine() {
  let accepted: XYAffinePrismFeatureResult | null = null;
  return (command: PrismFeatureCommand): PrismFeatureReply => {
    try {
      let candidate: XYAffinePrismFeatureResult;
      if (command.kind === 'open') {
        if (typeof command.text !== 'string' || command.text.length > 262144)
          throw new Error('Authored input exceeds 262144 characters.');
        candidate = parseXYAffinePrismFeatureDocument(command.text);
      } else {
        if (!accepted) throw new Error('Open an authored document first.');
        candidate = updateXYAffinePrismFeatureDocument(accepted, {
          expectedRevision: command.expectedRevision, revision: command.expectedRevision + 1,
          parameterEdits: command.edits,
        }).result;
      }
      // Codec validation is part of acceptance; failure cannot advance worker authority.
      const text = serializeXYAffinePrismFeatureDocument(candidate.document);
      const summary = {
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
        if (component.outcome.kind === 'solid') append(role, component.outcome.solid, component.lineage);
      }
      const display: PrismDisplayPacket = { documentId: candidate.document.id, revision: candidate.document.revision,
        components, outcomes: structuredClone(candidate.report.componentRoles) };
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
