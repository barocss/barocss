import { validateCadAssemblyResult } from '@barocss/cad';
import type { CadAssemblyMatrix, CadAssemblyResult, CadGeometryReferenceV0 } from '@barocss/cad';
import { Group, Line, Matrix4, Mesh } from 'three';
import { validateBaroCadParseOptions } from './native.js';
import type { BaroCadParseOptions } from './native.js';
import { createBaroCadDocumentThreeDisplay } from './three-document.js';
import type { BaroCadDocumentThreeResultV1 } from './three-document.js';

export interface BaroCadAssemblyThreeOptions {
  native: BaroCadParseOptions;
  /** Host assertion that authored XYZ matches Three's right-handed Y-up scene. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadAssemblyThreeBinding {
  readonly assemblyId: string;
  readonly assemblyRevision: number;
  readonly instanceId: string;
  readonly parentId: string | null;
  readonly ancestors: ReadonlyArray<string>;
  readonly reference: CadGeometryReferenceV0;
  /** Native evaluated row-major matrix, with translation still in millimetres. */
  readonly worldMatrix: Readonly<CadAssemblyMatrix>;
  /** Flat child of root. Its matrix converts native millimetres to scene units. */
  readonly instanceGroup: Group;
  readonly object: Mesh | Line;
}

export interface BaroCadAssemblyThreeResult {
  readonly root: Group;
  readonly bindings: ReadonlyArray<BaroCadAssemblyThreeBinding>;
  /** Detach and release only adapter-owned display resources. */
  dispose(): void;
}

function ownOptions(input: BaroCadAssemblyThreeOptions): BaroCadAssemblyThreeOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Assembly Three options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['native', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      !fields.native || !fields.basis || fields.basis.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Assembly Three options require native and an explicit matching Y-up basis');
  }
  return { native: validateBaroCadParseOptions(fields.native.value), basis: fields.basis.value };
}

function sceneMatrix(native: CadAssemblyMatrix, unitsPerMillimeter: number): Matrix4 {
  const values = [...native];
  for (const index of [3, 7, 11]) {
    const scaled = values[index] * unitsPerMillimeter;
    if (!Number.isFinite(scaled) || (values[index] !== 0 && scaled === 0)) {
      throw new RangeError('Assembly Three translation is not representable in scene units');
    }
    values[index] = scaled;
  }
  return new Matrix4().set(
    values[0], values[1], values[2], values[3],
    values[4], values[5], values[6], values[7],
    values[8], values[9], values[10], values[11],
    values[12], values[13], values[14], values[15],
  );
}

/** Display the accepted native assembly hierarchy without changing its parts or poses. */
export function createBaroCadAssemblyThreeDisplay(
  result: CadAssemblyResult, options: BaroCadAssemblyThreeOptions,
): BaroCadAssemblyThreeResult {
  validateCadAssemblyResult(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const root = new Group();
  root.name = owned.assembly.assemblyId;
  const staged: BaroCadDocumentThreeResultV1[] = [];
  const bindings: BaroCadAssemblyThreeBinding[] = [];
  try {
    for (const instance of owned.instances) {
      const ref = instance.reference;
      const document = owned.documents.find(part => part.document.documentId === ref.documentId);
      if (!document) throw new RangeError('Assembly instance has no embedded part');
      const display = createBaroCadDocumentThreeDisplay(document, {
        native: request.native, basis: request.basis, bodyIds: [ref.bodyId],
      });
      staged.push(display);
      const [selected] = display.bindings;
      if (display.bindings.length !== 1 || !selected ||
          selected.documentId !== ref.documentId || selected.documentRevision !== ref.documentRevision ||
          selected.bodyId !== ref.bodyId || selected.assetId !== ref.assetId ||
          selected.assetRevision !== ref.assetRevision || selected.geometryId !== ref.geometryId ||
          selected.geometryKind !== ref.geometryKind || selected.sourceFrame !== ref.sourceFrame ||
          selected.object.name !== ref.geometryId) {
        throw new RangeError('Assembly Three object differs from its qualified native part reference');
      }
      const group = display.root;
      group.name = instance.instanceId;
      group.matrixAutoUpdate = false;
      group.matrix.copy(sceneMatrix(instance.worldMatrix, request.native.unitsPerMillimeter));
      root.add(group);
      bindings.push(Object.freeze({
        assemblyId: owned.assembly.assemblyId, assemblyRevision: owned.assembly.revision,
        instanceId: instance.instanceId, parentId: instance.parentId,
        ancestors: Object.freeze([...instance.ancestors]),
        reference: Object.freeze({ ...ref }),
        worldMatrix: Object.freeze([...instance.worldMatrix]) as Readonly<CadAssemblyMatrix>,
        instanceGroup: group, object: selected.object,
      }));
    }
    let disposed = false;
    return Object.freeze({ root, bindings: Object.freeze(bindings), dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const display of staged) display.dispose();
      root.clear();
    } });
  } catch (error) {
    for (const display of staged) display.dispose();
    root.clear();
    throw error;
  }
}
