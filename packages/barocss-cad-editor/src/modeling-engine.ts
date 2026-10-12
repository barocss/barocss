import { cad, tessellateConvexPlanarSolid } from '@barocss/cad';
import type { CadModelSnapshot } from '@barocss/cad';
import { createPrismFeatureEngine } from './prism-feature-engine.js';
import type { CadEditorPrismFeatureSummary } from './prism-feature-types.js';
import type { PrismDisplayPacket } from './prism-feature-scene.js';

export interface CadEditorModelingSummary {
  documentId: string; revision: number; source: 'model' | 'legacy';
  parameters: Record<string, number>;
  features: { kind: string; index: number; dependencies: number[] }[];
  outputs: { name: string; solidId: string; volumeMM3: { numerator: string; denominator: string } | null }[];
}
export type CadEditorModelingExample = 'cut-chamfer' | 'intersection' | 'horizontal-split';
export type ModelingCommand = { id: number } & (
  { kind: 'example'; example?: CadEditorModelingExample } | { kind: 'open'; text: string; revision?: number }
  | { kind: 'apply'; expectedRevision: number; parameters: Record<string, number> }
);
export type ModelingReply = { id: number } & (
  { ok: true; text: string; summary: CadEditorModelingSummary; display: PrismDisplayPacket; compatibility?: CadEditorPrismFeatureSummary }
  | { ok: false; message: string }
);

/** The example is ordinary public authoring, never hand-written provider JSON. */
export function createCadEditorSampleModel(): CadModelSnapshot {
  const model = cad.model();
  const height = model.parameter('height', 8), rearX = model.parameter('rearX', 16);
  const upperX = model.parameter('upperX', 16), setback = model.parameter('setback', 1);
  const blank = model.sketch.polygon([[0, 0], [32, 0], [32, 16], [rearX, 32], [0, 32]]).extrude(height);
  const tool = model.sketch.rectangle({ min: [8, -16], max: [upperX, 48] }).extrude(8);
  const cut = blank.cut(tool, { axis: 'x' });
  const front = cut.positive.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one();
  return model.build({ part: cut.positive.chamfer(front, setback), other: cut.negative });
}

/** A positive-volume overlap, authored through the same public handle API. */
export function createCadEditorIntersectionModel(): CadModelSnapshot {
  const model = cad.model();
  const rearX = model.parameter('rearX', 16), leftX = model.parameter('leftX', 8), rightX = model.parameter('rightX', 40);
  const lowY = model.parameter('lowY', -8), highY = model.parameter('highY', 24), height = model.parameter('height', 4);
  const blank = model.sketch.polygon([[-0, 0], [32, 0], [32, 16], [rearX, 32], [0, 32]]).extrude(8);
  const tool = model.sketch.rectangle({ min: [leftX, lowY], max: [rightX, highY] }).extrude(height);
  return model.build({ overlap: blank.intersect(tool) });
}

/** Two closed named outputs from one editable horizontal split. */
export function createCadEditorSplitModel(): CadModelSnapshot {
  const model = cad.model();
  const height = model.parameter('height', 8), splitHeight = model.parameter('splitHeight', 2);
  const blank = model.sketch.polygon([[-0, 0], [32, 0], [32, 16], [16, 32], [0, 32]]).extrude(height);
  const halves = blank.split({ axis: 'z', at: splitHeight });
  return model.build({ lower: halves.negative, upper: halves.positive });
}

/** Inspect only the envelope. The chosen native codec validates every remaining field. */
export function modelingSourceKind(text: string): 'model' | 0 | 2 {
  if (typeof text !== 'string' || text.length > 262144 || new TextEncoder().encode(text).length > 262144)
    throw new Error('Authored input exceeds 262144 UTF-8 bytes or characters.');
  const input: unknown = JSON.parse(text);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A saved CAD model object is required.');
  const data = input as Record<string, unknown>;
  if (data.format === 'barocss-cad-model') {
    if (data.schema !== 1 || data.units !== 'mm') throw new Error('Unsupported CAD model file schema or units.');
    return 'model';
  }
  if (data.format === 'barocss-xy-affine-prism-feature-document') {
    if (data.version === 0 || data.version === 2) return data.version;
    throw new Error('This editor supports legacy prism files v0 and v2. Legacy v1 is not supported; use its original API reader.');
  }
  throw new Error('Unsupported saved CAD format. The file was not converted or reinterpreted.');
}

function legacySummary(summary: CadEditorPrismFeatureSummary): CadEditorModelingSummary {
  const { document } = summary;
  return { documentId: document.id, revision: document.revision, source: 'legacy',
    parameters: Object.fromEntries(document.parameters.map(p => [p.id, p.valueMM])),
    features: document.nodes.map((node, index) => ({ kind: node.kind, index,
      dependencies: (summary.dependencies.find(d => d.nodeId === node.id)?.dependsOn ?? []).map(id => document.nodes.findIndex(n => n.id === id)) })),
    outputs: summary.components.filter(c => c.status === 'solid').map(c => ({ name: c.role, solidId: c.solidId,
      volumeMM3: c.role === 'second' && summary.serial ? summary.serial.volumes.negative : summary.volumes[c.role] })) };
}

/** Worker-only native authority. Public snapshots and full native results never cross the transport. */
export function createModelingEngine() {
  let accepted: { source: 'model'; snapshot: CadModelSnapshot; revision: number }
    | { source: 'legacy'; summary: CadEditorPrismFeatureSummary } | null = null;
  const legacy = createPrismFeatureEngine();
  return (command: ModelingCommand): ModelingReply => {
    try {
      if (!command || !Number.isSafeInteger(command.id) || command.id < 1) throw new Error('A current worker request is required.');
      if (command.kind === 'example' && command.example !== undefined && command.example !== 'cut-chamfer' && command.example !== 'intersection' && command.example !== 'horizontal-split')
        throw new Error('Choose an available modeling example.');
      if (command.kind === 'open' && command.revision !== undefined && (!Number.isSafeInteger(command.revision) || command.revision < 0))
        throw new Error('Invalid worker reconstruction revision.');
      if (command.kind === 'apply') {
        const revision = accepted?.source === 'model' ? accepted.revision : accepted?.summary.document.revision;
        if (!accepted || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision !== revision)
          throw new Error('The model edit is stale.');
      }
      const source = command.kind === 'open' ? modelingSourceKind(command.text)
        : command.kind === 'example' ? 'model' : accepted?.source;
      if (source === 0 || source === 2 || source === 'legacy') {
        const reply = command.kind === 'open'
          ? legacy({ id: command.id, kind: 'open', text: command.text, version: source as 0 | 2 })
          : command.kind === 'apply'
            ? legacy({ id: command.id, kind: 'apply', expectedRevision: command.expectedRevision,
              edits: Object.entries(command.parameters).map(([parameterId, valueMM]) => ({ parameterId, valueMM })) })
            : null;
        if (!reply) throw new Error('Unsupported legacy command.');
        if (!reply.ok) return reply;
        const summary = legacySummary(reply.summary);
        accepted = { source: 'legacy', summary: reply.summary };
        return { id: command.id, ok: true, text: reply.text, summary, display: reply.display, compatibility: reply.summary };
      }
      if (source !== 'model') throw new Error('Open a saved model first.');
      const snapshot = command.kind === 'example' ? (command.example === 'intersection' ? createCadEditorIntersectionModel()
        : command.example === 'horizontal-split' ? createCadEditorSplitModel() : createCadEditorSampleModel())
        : command.kind === 'open' ? cad.load(command.text)
          : accepted?.source === 'model' ? accepted.snapshot.withParameters(command.parameters) : null;
      if (!snapshot) throw new Error('Open a saved model first.');
      const revision = command.kind === 'apply' ? command.expectedRevision + 1 : command.kind === 'open' ? command.revision ?? 0 : 0;
      const text = snapshot.save();
      // The codec owns canonical key order. Keep initial and reopened display inventories identical.
      const outputs = Object.keys(JSON.parse(text).outputs).map(name => [name, snapshot.bodies[name]] as const);
      const summary: CadEditorModelingSummary = { documentId: 'cad_model', revision, source: 'model',
        parameters: { ...snapshot.parameters },
        features: snapshot.features.map(f => ({ kind: f.kind, index: f.index, dependencies: [...f.dependencies] })),
        outputs: outputs.map(([name, body]) => ({ name, solidId: body.report.solidId,
          volumeMM3: { ...body.certificate.volumeMM3 } })) };
      const display: PrismDisplayPacket = { profile: 'model-outputs', documentId: summary.documentId, revision,
        components: outputs.map(([name, body]) => {
          const { mesh, boundaries, internalDiagonals, report } = tessellateConvexPlanarSolid(body, { maximumFanTriangles: 40 });
          return { role: name, mesh, boundaries, internalDiagonals, report,
            lineage: { kind: 'model-output', name, solidId: body.report.solidId,
              graph: structuredClone({ vertices: body.graph.vertices, faces: body.graph.faces,
                edges: body.graph.edges.map(({ id, vertexIds, uses }) => ({ id, vertexIds, uses })) }) } };
        }),
        outcomes: summary.outputs.map(o => ({ role: o.name, solidId: o.solidId, status: 'solid' })) };
      if (JSON.stringify(display).length > 2 * 1024 * 1024) throw new Error('Model display exceeds 2 MiB.');
      accepted = { source: 'model', snapshot, revision };
      return { id: command.id, ok: true, text, summary, display };
    } catch (cause) {
      return { id: command?.id, ok: false, message: (cause instanceof Error ? cause.message : 'CAD modeling refused.').slice(0, 2048) };
    }
  };
}
