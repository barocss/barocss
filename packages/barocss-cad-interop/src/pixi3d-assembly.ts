import { validateCadAssemblyResult } from '@barocss/cad';
import type { CadAssemblyMatrix, CadAssemblyResult, CadGeometryReferenceV0 } from '@barocss/cad';
import { Container3D, Matrix4x4, Mesh3D } from 'pixi3d/pixi7';
import { createBaroCadDocumentPixi3DDisplay } from './pixi3d-document.js';
import type { BaroCadDocumentPixi3DResultV1 } from './pixi3d-document.js';
import { validateBaroCadParseOptions } from './native.js';
import type { BaroCadParseOptions } from './native.js';

export interface BaroCadAssemblyPixi3DOptions {
  native: BaroCadParseOptions;
  /** Host assertion that authored XYZ matches the right-handed Y-up view. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadAssemblyPixi3DBinding {
  readonly assemblyId: string;
  readonly assemblyRevision: number;
  readonly instanceId: string;
  readonly parentId: string | null;
  readonly ancestors: ReadonlyArray<string>;
  readonly reference: CadGeometryReferenceV0;
  /** Native evaluated row-major matrix, with translation in millimetres. */
  readonly worldMatrix: Readonly<CadAssemblyMatrix>;
  /** Flat child of root, carrying this instance's complete native world pose. */
  readonly instanceNode: Container3D;
  readonly mesh: Mesh3D;
}

export interface BaroCadAssemblyPixi3DResult {
  /** Owned display root. The caller attaches it to its Pixi stage. */
  readonly root: Container3D;
  readonly bindings: ReadonlyArray<BaroCadAssemblyPixi3DBinding>;
  /** Idempotent. Keeps the caller Application, stage, renderer and canvas alive. */
  dispose(): void;
}

function ownOptions(input: BaroCadAssemblyPixi3DOptions): BaroCadAssemblyPixi3DOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Assembly Pixi3D options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['native', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      !fields.native || !fields.basis || fields.basis.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Assembly Pixi3D options require native and an explicit matching Y-up basis');
  }
  return { native: validateBaroCadParseOptions(fields.native.value), basis: fields.basis.value };
}

function targetMatrix(native: CadAssemblyMatrix, unitsPerMillimeter: number): Matrix4x4 {
  const values = [...native];
  for (const index of [3, 7, 11]) {
    const scaled = values[index] * unitsPerMillimeter;
    if (!Number.isFinite(scaled) || !Number.isFinite(Math.fround(scaled)) ||
        (values[index] !== 0 && Math.fround(scaled) === 0)) {
      throw new RangeError('Assembly Pixi3D translation is not representable in scene units');
    }
    values[index] = scaled;
  }
  // Pixi's 4x4 array stores one point-output row at indices 0, 4, 8, 12.
  return new Matrix4x4([
    values[0], values[4], values[8], values[12],
    values[1], values[5], values[9], values[13],
    values[2], values[6], values[10], values[14],
    values[3], values[7], values[11], values[15],
  ]);
}

/** Display each native assembly part under its evaluated world pose. */
export function createBaroCadAssemblyPixi3DDisplay(
  result: CadAssemblyResult, options: BaroCadAssemblyPixi3DOptions,
): BaroCadAssemblyPixi3DResult {
  validateCadAssemblyResult(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const root = new Container3D();
  const staged: BaroCadDocumentPixi3DResultV1[] = [];
  const bindings: BaroCadAssemblyPixi3DBinding[] = [];
  try {
    for (const instance of owned.instances) {
      const ref = instance.reference;
      const document = owned.documents.find(part => part.document.documentId === ref.documentId);
      if (!document) throw new RangeError('Assembly instance has no embedded part');
      const display = createBaroCadDocumentPixi3DDisplay(document, {
        native: request.native, basis: request.basis, bodyIds: [ref.bodyId],
      });
      staged.push(display);
      const [selected] = display.bindings;
      if (display.bindings.length !== 1 || !selected ||
          selected.documentId !== ref.documentId || selected.documentRevision !== ref.documentRevision ||
          selected.bodyId !== ref.bodyId || selected.assetId !== ref.assetId ||
          selected.assetRevision !== ref.assetRevision || selected.geometryId !== ref.geometryId ||
          selected.geometryKind !== ref.geometryKind || selected.sourceFrame !== ref.sourceFrame ||
          selected.ref.geometryId !== ref.geometryId || !(selected.mesh instanceof Mesh3D)) {
        throw new RangeError('Assembly Pixi3D mesh differs from its qualified native part reference');
      }
      const node = display.root;
      node.transform.setFromMatrix(targetMatrix(instance.worldMatrix, request.native.unitsPerMillimeter));
      root.addChild(node);
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
      root.parent?.removeChild(root);
      for (const display of staged) display.dispose();
      root.destroy({ children: false });
    } });
  } catch (error) {
    for (const display of staged) display.dispose();
    root.destroy({ children: false });
    throw error;
  }
}
