import { cad, tessellateConvexPlanarSolid, tessellateOwnPlateCircularHole, tessellateSurface, tessellateXYCirclePrismShell } from '@barocss/cad';
import type { CadModelSnapshot } from '@barocss/cad';
import { isModelingCompositionGraph, preflightModelingComposition, projectModelingComposition } from './modeling-composition.js';
import type { ModelingUnionDisplayComponent } from './modeling-union.js';
import { preflightModelingCircle, projectModelingCircle } from './modeling-circle.js';
import { preflightModelingUnion, projectModelingUnion } from './modeling-union.js';
import { createPrismFeatureEngine } from './prism-feature-engine.js';
import type { CadEditorPrismFeatureSummary } from './prism-feature-types.js';
import type { PrismDisplayComponent } from './prism-feature-scene.js';
import type { ModelingDisplayPacket, ModelingHoleDisplayComponent } from './modeling-scene.js';

export interface CadEditorModelingSummary {
  documentId: string; revision: number; source: 'model' | 'legacy';
  parameters: Record<string, number>;
  suppression?: Record<string, boolean>;
  features: { kind: string; index: number; dependencies: number[]; name?: string; suppressed?: boolean }[];
  outputs: { name: string; solidId: string; family?: 'convex-planar' | 'stored-rational-plate-hole' | 'orthogonal-cell' | 'stored-rational-circle-prism'; volumeMM3: { numerator: string; denominator: string } | null }[];
}
export type CadEditorModelingSplitAxis = 'x' | 'y' | 'z';
/** The split example ID is retained for compatibility; splitAxis defaults to Z. */
export type CadEditorModelingExample = 'cut-chamfer' | 'intersection' | 'horizontal-split' | 'two-chamfer' | 'chamfer-split' | 'derived-split' | 'miter-split' | 'configurable-finishes' | 'mounting-plate' | 'union-bracket' | 'underside-pocket' | 'top-entry-pocket' | 'round-post' | 'slotted-bracket';
export type ModelingCommand = { id: number; taskToken?: string } & (
  { kind: 'example'; example?: CadEditorModelingExample; splitAxis?: CadEditorModelingSplitAxis } | { kind: 'open'; text: string; revision?: number }
  | { kind: 'apply'; expectedRevision: number; parameters: Record<string, number> }
  | { kind: 'suppression'; expectedRevision: number; suppression: Record<string, boolean> }
);
export type ModelingReply = { id: number } & (
  { ok: true; text: string; summary: CadEditorModelingSummary; display: ModelingDisplayPacket; compatibility?: CadEditorPrismFeatureSummary }
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

/** Each chamfer selection is owned by the exact shape it modifies. */
export function createCadEditorChamferChainModel(): CadModelSnapshot {
  const model = cad.model();
  const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
  const backY = model.parameter('backY', 24);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const part = front.chamfer(front.edges({ parallelTo: 'x', at: { y: backY, z: 'max' } }).one(), backDistance);
  return model.build({ part });
}

/** The same qualified mounting-plate recipe as the measured primary provider fixture. */
export function createCadEditorMountingPlateModel(): CadModelSnapshot {
  const model = cad.model();
  const width = model.parameter('width', 80), depth = model.parameter('depth', 40), height = model.parameter('height', 8);
  const centerX = model.parameter('centerX', 40), centerY = model.parameter('centerY', 20), radius = model.parameter('radius', 5);
  const blank = model.sketch.rectangle({ width, height: depth }).extrude(height);
  const plate = blank.hole({ center: [centerX, centerY], radius });
  return model.build({ blank, plate });
}

/** Exact owned diameter-driven circle recipe; the provider retains its rational boundary. */
export function createCadEditorRoundPostModel(): CadModelSnapshot {
  const model = cad.model();
  const centerX = model.parameter('centerX', 2), centerY = model.parameter('centerY', -3);
  const diameter = model.parameter('diameter', 8), height = model.parameter('height', 6);
  const post = model.sketch.circle({ center: [centerX, centerY], radius: model.dimension.scale(diameter, 0.5) }).extrude(height);
  return model.build({ post });
}

/** Exact adopted underside-pocket recipe; numeric depth enters from Z=0. */
export function createCadEditorPocketModel(): CadModelSnapshot {
  const model = cad.model();
  const toolX = model.parameter('toolX', 8), toolY = model.parameter('toolY', 8);
  const toolWidth = model.parameter('toolWidth', 16), toolSpanY = model.parameter('toolSpanY', 8), depth = model.parameter('depth', 4);
  const plate = model.sketch.rectangle({ min: [-0, 0], max: [32, 24] }).extrude(8);
  const tool = model.sketch.rectangle({ min: [toolX, toolY],
    max: [model.dimension.add(toolX, toolWidth), model.dimension.add(toolY, toolSpanY)] }).extrude(depth);
  const part = plate.cut(tool);
  return model.build({ plate, tool, part });
}

/** Exact top-entry pocket: tool starts at Z = 8 - depth, plate remains Z=0..8. */
export function createCadEditorTopPocketModel(): CadModelSnapshot {
  const model = cad.model();
  const depth = model.parameter('depth', 4), toolY = model.parameter('toolY', 8);
  const toolSpanY = model.parameter('toolSpanY', 8);
  const plate = model.sketch.rectangle({ min: [-0, 0], max: [32, 24] }).extrude(8);
  const from = model.dimension.add(8, model.dimension.scale(depth, -1));
  const tool = model.sketch.rectangle({
    min: [8, toolY], max: [24, model.dimension.add(toolY, toolSpanY)],
  }).extrude(depth, { from });
  const part = plate.cut(tool);
  return model.build({ plate, tool, part });
}

/** Exact owned rectangular union recipe from the measured provider fixture. */
export function createCadEditorUnionBracketModel(): CadModelSnapshot {
  const model = cad.model(), legMinX = model.parameter('legMinX', -0), legMinY = model.parameter('legMinY', -0);
  const legWidth = model.parameter('legWidth', 8), legHeight = model.parameter('legHeight', 8);
  const base = model.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
  const leg = model.sketch.rectangle({ min: [legMinX, legMinY], max: [model.dimension.add(legMinX, legWidth), 24] }).extrude(legHeight);
  const bracket = base.union(leg);
  return model.build({ base, leg, bracket });
}

/** Exact eight-node union then slot recipe, retaining both owned named results. */
export function createCadEditorSlottedBracketModel(): CadModelSnapshot {
  const model = cad.model(), legWidth = model.parameter('legWidth', 8);
  const slotX = model.parameter('slotX', 16), slotY = model.parameter('slotY', 2);
  const slotWidth = model.parameter('slotWidth', 8), slotSpanY = model.parameter('slotSpanY', 4);
  const base = model.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
  const leg = model.sketch.rectangle({ min: [-0, 0], max: [legWidth, 24] }).extrude(8);
  const bracket = base.union(leg);
  const tool = model.sketch.rectangle({ min: [slotX, slotY],
    max: [model.dimension.add(slotX, slotWidth), model.dimension.add(slotY, slotSpanY)] }).extrude(8);
  return model.build({ bracket, slotted: bracket.cut(tool) });
}

/** Named finishing operations keep exact result-owned selectors and a fixed X split. */
export function createCadEditorConfigurableFinishesModel(): CadModelSnapshot {
  const model = cad.model();
  const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
  const backY = model.parameter('backY', 24);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance, { name: 'frontFinish' });
  const back = front.chamfer(front.edges({ parallelTo: 'x', at: { y: backY, z: 'max' } }).one(), backDistance, { name: 'backFinish' });
  const parts = back.split({ axis: 'x', at: 16 });
  return model.build({ negative: parts.negative, positive: parts.positive });
}

/** Divide the actual second chamfer result; this preset matches measured X/Z cases. */
export function createCadEditorChamferSplitModel(axis: 'x' | 'z' = 'x'): CadModelSnapshot {
  const model = cad.model();
  const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
  const splitAt = model.parameter('splitAt', axis === 'z' ? 4 : 16);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const finished = front.chamfer(front.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), backDistance);
  const parts = finished.split({ axis, at: splitAt });
  return model.build({ negative: parts.negative, positive: parts.positive });
}

/** Keep the X split centered on an editable width, with an independent numeric offset. */
export function createCadEditorDerivedSplitModel(): CadModelSnapshot {
  const model = cad.model();
  const width = model.parameter('width', 32), offset = model.parameter('offset', 0);
  const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
  const at = model.dimension.add(model.dimension.scale(width, 0.5), offset);
  const blank = model.sketch.rectangle({ width, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const finished = front.chamfer(front.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), backDistance);
  const parts = finished.split({ axis: 'x', at });
  return model.build({ negative: parts.negative, positive: parts.positive });
}

/** A fixed 45-degree XY plane; the driving length is an X + Y coordinate sum. */
export function createCadEditorMiterModel(): CadModelSnapshot {
  const model = cad.model(), cutPosition = model.parameter('cutPosition', 24);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const parts = blank.split({ plane: 'x+y', at: cutPosition });
  return model.build({ negative: parts.negative, positive: parts.positive });
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

/** The same split sample with a cardinal X/Y recipe and explicit coordinate-side names. */
export function createCadEditorCardinalSplitModel(axis: 'x' | 'y'): CadModelSnapshot {
  const model = cad.model();
  const splitAt = model.parameter('splitAt', 16), rearX = model.parameter('rearX', 16);
  const height = model.parameter('height', 8);
  const blank = model.sketch.polygon([[-0, 0], [32, 0], [32, 16], [rearX, 32], [0, 32]]).extrude(height);
  const parts = blank.split({ axis, at: splitAt });
  return model.build({ negative: parts.negative, positive: parts.positive });
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
      if (command.taskToken !== undefined && (typeof command.taskToken !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(command.taskToken)))
        throw new Error('A bounded current display task token is required.');
      if (command.kind === 'example' && command.example !== undefined && command.example !== 'cut-chamfer' && command.example !== 'intersection' && command.example !== 'horizontal-split' && command.example !== 'two-chamfer' && command.example !== 'chamfer-split' && command.example !== 'derived-split' && command.example !== 'miter-split' && command.example !== 'configurable-finishes' && command.example !== 'mounting-plate' && command.example !== 'union-bracket' && command.example !== 'underside-pocket' && command.example !== 'top-entry-pocket' && command.example !== 'round-post' && command.example !== 'slotted-bracket')
        throw new Error('Choose an available modeling example.');
      if (command.kind === 'example' && command.splitAxis !== undefined
        && (command.example === 'chamfer-split' ? !['x', 'z'].includes(command.splitAxis)
          : command.example !== 'horizontal-split' || !['x', 'y', 'z'].includes(command.splitAxis)))
        throw new Error('Choose an available split axis: X/Z for the beveled part, X/Y/Z for the plain part.');
      if (command.kind === 'open' && command.revision !== undefined && (!Number.isSafeInteger(command.revision) || command.revision < 0))
        throw new Error('Invalid worker reconstruction revision.');
      if (command.kind === 'apply' || command.kind === 'suppression') {
        const revision = accepted?.source === 'model' ? accepted.revision : accepted?.summary.document.revision;
        if (!accepted || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision !== revision)
          throw new Error('The model edit is stale.');
      }
      if (command.kind === 'suppression') {
        const changes = command.suppression;
        if (accepted?.source !== 'model' || !changes || Object.getPrototypeOf(changes) !== Object.prototype
          || Reflect.ownKeys(changes).length > 6) throw new Error('Use a plain named finishing configuration.');
        for (const name of Reflect.ownKeys(changes)) {
          const descriptor = Object.getOwnPropertyDescriptor(changes, name)!;
          if (typeof name !== 'string' || !Object.hasOwn(accepted.snapshot.suppression, name)
            || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'boolean')
            throw new Error('Use known finishing names and own boolean values.');
        }
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
        : command.example === 'slotted-bracket' ? createCadEditorSlottedBracketModel()
        : command.example === 'round-post' ? createCadEditorRoundPostModel()
        : command.example === 'underside-pocket' ? createCadEditorPocketModel()
        : command.example === 'top-entry-pocket' ? createCadEditorTopPocketModel()
        : command.example === 'union-bracket' ? createCadEditorUnionBracketModel()
        : command.example === 'mounting-plate' ? createCadEditorMountingPlateModel()
        : command.example === 'configurable-finishes' ? createCadEditorConfigurableFinishesModel()
        : command.example === 'miter-split' ? createCadEditorMiterModel()
        : command.example === 'derived-split' ? createCadEditorDerivedSplitModel()
        : command.example === 'chamfer-split' ? createCadEditorChamferSplitModel(command.splitAxis === 'z' ? 'z' : 'x')
        : command.example === 'horizontal-split' ? (command.splitAxis === 'x' || command.splitAxis === 'y'
          ? createCadEditorCardinalSplitModel(command.splitAxis) : createCadEditorSplitModel()) : command.example === 'two-chamfer' ? createCadEditorChamferChainModel() : createCadEditorSampleModel())
        : command.kind === 'open' ? cad.load(command.text)
          : accepted?.source === 'model' ? (command.kind === 'suppression' ? accepted.snapshot.withSuppression(command.suppression) : accepted.snapshot.withParameters(command.parameters)) : null;
      if (!snapshot) throw new Error('Open a saved model first.');
      const revision = command.kind === 'apply' || command.kind === 'suppression' ? command.expectedRevision + 1 : command.kind === 'open' ? command.revision ?? 0 : 0;
      const text = snapshot.save();
      // The codec owns canonical key order. Keep initial and reopened display inventories identical.
      const authored = JSON.parse(text) as { nodes: { kind: string; profile?: string; sketch?: number; parent?: { node: number; side: string } }[]; outputs: Record<string, { node: number }> };
      // This saved graph came from the admitted native snapshot. Reject the whole
      // unsupported chain even when only an earlier supported output is named.
      const composedGraph = isModelingCompositionGraph(authored);
      if (!composedGraph && authored.nodes.some((node, index) => {
        const parent = node.parent?.node;
        return node.kind === 'difference' && typeof parent === 'number' && Number.isSafeInteger(parent)
          && parent >= 0 && parent < index && authored.nodes[parent]?.kind === 'union';
      }))
        throw new Error('Composed preview requires the supported eight-node rectangular union-slot ancestry.');
      const circleOutput = (index: number) => {
        const node = authored.nodes[index], sketch = node?.sketch;
        return node?.kind === 'extrude' && Number.isSafeInteger(sketch) && sketch! >= 0 && sketch! < index
          && authored.nodes[sketch!]?.kind === 'sketch' && authored.nodes[sketch!].profile === 'circle';
      };
      const outputNames = Object.keys(authored.outputs);
      const operation = (name: string): 'union' | 'difference' => {
        const kind = authored.nodes[authored.outputs[name].node]?.kind;
        if (kind !== 'union' && kind !== 'difference') throw new Error('Orthogonal output must name its authored operation.');
        return kind;
      };
      // Validate the whole trusted authored inventory before reading any native payload.
      const inventory = outputNames.map(name => {
        const body = snapshot.bodies[name], kind = authored.nodes[authored.outputs[name].node]?.kind;
        if (!body || ((kind === 'union' || kind === 'difference') !== (body.family === 'orthogonal-cell'))
          || ((kind === 'hole') !== (body.family === 'stored-rational-plate-hole'))
          || (circleOutput(authored.outputs[name].node) !== (body.family === 'stored-rational-circle-prism')))
          throw new Error('Authored output kind differs from its native body family.');
        return [name, body] as const;
      });
      // Complete all preflights, including hidden outputs, before any tessellation.
      const outputs = inventory.map(([name, body]) => {
        switch (body.family) {
          case 'convex-planar': case 'stored-rational-plate-hole': return [name, body] as const;
          case 'stored-rational-circle-prism': preflightModelingCircle(body.native); return [name, body] as const;
          case 'orthogonal-cell': {
            const native = body.native;
            if (native.report.schema === 'barocss-orthogonal-solid-boolean' && 'left' in native) {
              if (!composedGraph || authored.outputs[name].node !== 7 || operation(name) !== 'difference')
                throw new Error('Composed native schema must match its exact authored difference result.');
              preflightModelingComposition(native);
            } else if (native.report.schema === 'barocss-axis-box-solid-boolean' && 'a' in native) {
              if (composedGraph && authored.outputs[name].node === 7)
                throw new Error('Composed output cannot use a two-box native schema.');
              preflightModelingUnion(native, operation(name));
            } else throw new Error('Unknown orthogonal native schema.');
            return [name, body] as const;
          }
          default: { const unsupported: never = body; throw new Error(`Unsupported model body family: ${String(unsupported)}`); }
        }
      });
      const hasNativeFaces = outputs.some(([, body]) => body.family !== 'convex-planar');
      if (hasNativeFaces && !command.taskToken) throw new Error('A current display task token is required for native model faces.');
      const summary: CadEditorModelingSummary = { documentId: 'cad_model', revision, source: 'model',
        parameters: { ...snapshot.parameters },
        ...(Object.keys(snapshot.suppression).length ? { suppression: { ...snapshot.suppression } } : {}),
        features: snapshot.features.map(f => ({ kind: f.kind, index: f.index, dependencies: [...f.dependencies],
          ...(f.name === undefined ? {} : { name: f.name, suppressed: f.suppressed }) })),
        outputs: outputs.map(([name, body]) => ({ name,
          solidId: body.family === 'convex-planar' ? body.native.report.solidId : body.family === 'orthogonal-cell' ? body.native.bodies[0].id : body.family === 'stored-rational-circle-prism' ? body.native.parent.bundle.topology.id : body.native.bundle.request.bodyId,
          ...(hasNativeFaces ? { family: body.family } : {}),
          volumeMM3: body.family === 'convex-planar' ? { ...body.native.certificate.volumeMM3 }
            : body.family === 'orthogonal-cell' ? { numerator: String(body.native.report.volumeMM3), denominator: '1' } : null })) };
      const convex = (name: string, body: Extract<CadModelSnapshot['bodies'][string], { family: 'convex-planar' }>['native']): PrismDisplayComponent => {
        const { mesh, boundaries, internalDiagonals, report } = tessellateConvexPlanarSolid(body, { maximumFanTriangles: 40 });
        return { role: name, mesh, boundaries, internalDiagonals, report,
          lineage: { kind: 'model-output', name, solidId: body.report.solidId,
            graph: structuredClone({ vertices: body.graph.vertices, faces: body.graph.faces,
              edges: body.graph.edges.map(({ id, vertexIds, uses }) => ({ id, vertexIds, uses })) }) } };
      };
      const hole = (name: string, body: Extract<CadModelSnapshot['bodies'][string], { family: 'stored-rational-plate-hole' }>['native']): ModelingHoleDisplayComponent => {
        const { bundle, certificate } = body;
        const context = { documentId: summary.documentId, bodyId: bundle.request.bodyId, documentRevision: String(revision),
          kernelResultRevision: String(revision), topologyRevision: String(revision), taskToken: command.taskToken! };
        const preview = tessellateOwnPlateCircularHole(bundle, { context, segmentsPerQuarter: 4 });
        const { kind, version, lengthUnit, geometryAuthority, solid, topologyCertified, embeddedStoredGeometryCertified,
          materialComponentCount, genus, faceCount, vertexCount, edgeCount, loopCount, edgeUseCount, weightedEuler } = certificate;
        return { family: 'stored-rational-plate-hole', role: name, solidId: bundle.request.bodyId, preview,
          qualification: { kind, version, lengthUnit, geometryAuthority, solid, topologyCertified, embeddedStoredGeometryCertified,
            materialComponentCount, genus, faceCount, vertexCount, edgeCount, loopCount, edgeUseCount, weightedEuler },
          lineage: structuredClone({ bodyId: bundle.request.bodyId,
            faces: bundle.faces.map(({ id, role, surface, orientation, outerLoopId, innerLoopIds }) => ({ id, role, surfaceId: surface.id, orientation, outerLoopId, innerLoopIds })),
            vertices: bundle.topology.vertices,
            edges: bundle.topology.edges.map(({ id, curve, vertexIds, sourceParameterRange }) => ({ id, curveId: curve.id, vertexIds, sourceParameterRange })),
            loops: bundle.topology.loops.map(({ id, faceId, role, uses }) => ({ id, faceId, role,
              uses: uses.map(({ id, edgeId, sense, pcurve }) => ({ id, edgeId, sense, pcurveId: pcurve.curve.id, domain: pcurve.domain })) })) }) };
      };
      const nativeContext = (bodyId: string) => ({ documentId: summary.documentId, bodyId, documentRevision: String(revision),
        kernelResultRevision: String(revision), topologyRevision: String(revision), taskToken: command.taskToken! });
      // A named parent and its embedded proof share the identical projected raw samples.
      // The composed projector verifies all copied parent authority before reuse.
      const parentComponents = new Map<string, ModelingUnionDisplayComponent>();
      const namedOrthogonal = new Map<string, ModelingUnionDisplayComponent>();
      for (const [name, body] of outputs) if (body.family === 'orthogonal-cell' && 'a' in body.native) {
        const component = projectModelingUnion(body.native, name, nativeContext(body.native.bodies[0].id), tessellateSurface, operation(name));
        parentComponents.set(body.native.report.evaluationId, component); namedOrthogonal.set(name, component);
      }
      const display: ModelingDisplayPacket = hasNativeFaces ? { profile: 'model-body-faces', documentId: summary.documentId, revision, taskToken: command.taskToken!,
        components: outputs.map(([name, body]) => body.family === 'convex-planar'
          ? { family: 'convex-planar', component: convex(name, body.native) }
          : body.family === 'stored-rational-plate-hole' ? hole(name, body.native)
            : body.family === 'stored-rational-circle-prism' ? projectModelingCircle(body.native,
              tessellateXYCirclePrismShell(body.native.parent.bundle, { meshId: 'modeling_circle_' + name, revision, segmentsPerQuarter: 4 }), name,
              { documentId: summary.documentId, bodyId: body.native.parent.bundle.topology.id, documentRevision: String(revision),
                kernelResultRevision: String(revision), topologyRevision: String(revision), taskToken: command.taskToken! })
            : 'left' in body.native ? projectModelingComposition(body.native, name, nativeContext(body.native.bodies[0].id),
              tessellateSurface, parentComponents.get('m4_union')) : namedOrthogonal.get(name)!),
        outcomes: summary.outputs.map(o => ({ role: o.name, solidId: o.solidId, family: o.family!, status: 'solid' })) }
        : { profile: 'model-outputs', documentId: summary.documentId, revision,
          components: outputs.map(([name, body]) => {
            if (body.family !== 'convex-planar') throw new Error('A complete narrowed convex inventory is required.');
            return convex(name, body.native);
          }), outcomes: summary.outputs.map(o => ({ role: o.name, solidId: o.solidId, status: 'solid' })) };
      if (JSON.stringify(display).length > 2 * 1024 * 1024) throw new Error('Model display exceeds 2 MiB.');
      accepted = { source: 'model', snapshot, revision };
      return { id: command.id, ok: true, text, summary, display };
    } catch (cause) {
      return { id: command?.id, ok: false, message: (cause instanceof Error ? cause.message : 'CAD modeling refused.').slice(0, 2048) };
    }
  };
}
