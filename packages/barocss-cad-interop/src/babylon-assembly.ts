import { validateCadAssemblyResult } from '@barocss/cad';
import type { CadAssemblyMatrix, CadAssemblyResult, CadGeometryReferenceV0 } from '@barocss/cad';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Matrix } from '@babylonjs/core/Maths/math.vector.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { createBaroCadDocumentBabylonDisplay } from './babylon-document.js';
import type { BaroCadDocumentBabylonResultV1 } from './babylon-document.js';
import { validateBaroCadParseOptions } from './native.js';
import type { BaroCadParseOptions } from './native.js';

export interface BaroCadAssemblyBabylonOptions {
  native: BaroCadParseOptions;
  /** Host assertion that authored XYZ matches the right-handed Y-up Scene. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadAssemblyBabylonBinding {
  readonly assemblyId: string;
  readonly assemblyRevision: number;
  readonly instanceId: string;
  readonly parentId: string | null;
  readonly ancestors: ReadonlyArray<string>;
  readonly reference: CadGeometryReferenceV0;
  /** Native evaluated row-major matrix, with translation still in millimetres. */
  readonly worldMatrix: Readonly<CadAssemblyMatrix>;
  /** Flat child of root. Its pretransform matrix includes the native world pose. */
  readonly instanceNode: TransformNode;
  readonly mesh: Mesh | LinesMesh;
}

export interface BaroCadAssemblyBabylonResult {
  readonly root: TransformNode;
  readonly bindings: ReadonlyArray<BaroCadAssemblyBabylonBinding>;
  /** Dispose only adapter-owned nodes, meshes and materials. */
  dispose(): void;
}

function ownOptions(input: BaroCadAssemblyBabylonOptions): BaroCadAssemblyBabylonOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Assembly Babylon options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['native', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      !fields.native || !fields.basis || fields.basis.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Assembly Babylon options require native and an explicit matching Y-up basis');
  }
  return { native: validateBaroCadParseOptions(fields.native.value), basis: fields.basis.value };
}

function targetMatrix(native: CadAssemblyMatrix, unitsPerMillimeter: number): Matrix {
  const values = [...native];
  for (const index of [3, 7, 11]) {
    const scaled = values[index] * unitsPerMillimeter;
    if (!Number.isFinite(scaled) || (values[index] !== 0 && scaled === 0)) {
      throw new RangeError('Assembly Babylon translation is not representable in scene units');
    }
    values[index] = scaled;
  }
  // Babylon m[0,4,8,12] is the first point-output row. CAD stores that row contiguously.
  return Matrix.FromArray([
    values[0], values[4], values[8], values[12],
    values[1], values[5], values[9], values[13],
    values[2], values[6], values[10], values[14],
    values[3], values[7], values[11], values[15],
  ]);
}

/** Display each original native part under its evaluated assembly world pose. */
export function createBaroCadAssemblyBabylonDisplay(
  scene: Scene, result: CadAssemblyResult, options: BaroCadAssemblyBabylonOptions,
): BaroCadAssemblyBabylonResult {
  if (!scene || scene.useRightHandedSystem !== true || scene.isDisposed) {
    throw new RangeError('Babylon assembly display requires a live right-handed caller Scene');
  }
  validateCadAssemblyResult(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const root = new TransformNode(`barocad_assembly_${owned.assembly.assemblyId}`, scene);
  const staged: BaroCadDocumentBabylonResultV1[] = [];
  const bindings: BaroCadAssemblyBabylonBinding[] = [];
  try {
    for (const instance of owned.instances) {
      const ref = instance.reference;
      const document = owned.documents.find(part => part.document.documentId === ref.documentId);
      if (!document) throw new RangeError('Assembly instance has no embedded part');
      const display = createBaroCadDocumentBabylonDisplay(scene, document, {
        native: request.native, basis: request.basis, bodyIds: [ref.bodyId],
      });
      staged.push(display);
      const [selected] = display.bindings;
      const sourceId = selected?.mesh.metadata?.barocss?.curveId ?? selected?.mesh.metadata?.barocss?.surfaceId;
      if (display.bindings.length !== 1 || !selected ||
          selected.documentId !== ref.documentId || selected.documentRevision !== ref.documentRevision ||
          selected.bodyId !== ref.bodyId || selected.assetId !== ref.assetId ||
          selected.assetRevision !== ref.assetRevision || selected.geometryId !== ref.geometryId ||
          selected.geometryKind !== ref.geometryKind || selected.sourceFrame !== ref.sourceFrame ||
          sourceId !== ref.geometryId ||
          (ref.geometryKind === 'curve' && !(selected.mesh instanceof LinesMesh)) ||
          (ref.geometryKind === 'surface' && selected.mesh instanceof LinesMesh)) {
        throw new RangeError('Assembly Babylon mesh differs from its qualified native part reference');
      }
      const node = display.root;
      node.name = `barocad_instance_${instance.instanceId}`;
      node.setPreTransformMatrix(targetMatrix(instance.worldMatrix, request.native.unitsPerMillimeter));
      node.parent = root;
      bindings.push(Object.freeze({
        assemblyId: owned.assembly.assemblyId, assemblyRevision: owned.assembly.revision,
        instanceId: instance.instanceId, parentId: instance.parentId,
        ancestors: Object.freeze([...instance.ancestors]),
        reference: Object.freeze({ ...ref }),
        worldMatrix: Object.freeze([...instance.worldMatrix]) as Readonly<CadAssemblyMatrix>,
        instanceNode: node, mesh: selected.mesh,
      }));
    }
    let disposed = false;
    return Object.freeze({ root, bindings: Object.freeze(bindings), dispose() {
      if (disposed) return;
      disposed = true;
      for (const display of staged) display.dispose();
      root.dispose(false, false);
    } });
  } catch (error) {
    for (const display of staged) display.dispose();
    root.dispose(false, false);
    throw error;
  }
}
