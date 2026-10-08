import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { CadDocumentResult } from '@barocss/cad';
import { BaroCADBabylonLoader } from './babylon.js';
import type { BaroCadBabylonResult } from './babylon.js';
import { prepareBaroCadDocumentPrimitiveNativeRefsV2 } from './document.js';
import type {
  BaroCadDocumentPrimitiveBindingV2, BaroCadDocumentPrimitiveOptionsV2,
  BaroCadDocumentPrimitiveRefV2,
} from './document.js';
import { validateBaroCadParseOptions } from './native.js';

export interface BaroCadDocumentBabylonBindingV1 extends BaroCadDocumentPrimitiveBindingV2 {
  readonly ref: BaroCadDocumentPrimitiveRefV2;
  readonly mesh: Mesh;
  readonly assetNode: TransformNode;
}

export interface BaroCadDocumentBabylonResultV1 {
  /** Caller may attach only display poses to the owned asset nodes. */
  readonly root: TransformNode;
  readonly assetNodes: ReadonlyArray<TransformNode>;
  /** Authored body order, independent of the requested bodyIds order. */
  readonly bindings: ReadonlyArray<BaroCadDocumentBabylonBindingV1>;
  /** Idempotent. Keeps the caller Scene, Engine and other meshes alive. */
  dispose(): void;
}

/** Compose selected document bodies with the existing source0 Babylon adapter. */
export function createBaroCadDocumentBabylonDisplay(
  scene: Scene, result: CadDocumentResult, options: BaroCadDocumentPrimitiveOptionsV2,
): BaroCadDocumentBabylonResultV1 {
  if (!scene || scene.useRightHandedSystem !== true || scene.isDisposed) {
    throw new RangeError('Babylon document display requires a live right-handed caller Scene');
  }
  const selected = prepareBaroCadDocumentPrimitiveNativeRefsV2(result, options);
  const owned = structuredClone(result);
  const native = validateBaroCadParseOptions(options.native);
  const root = new TransformNode(`barocad_document_${owned.document.documentId}`, scene);
  const staged: BaroCadBabylonResult[] = [];
  const assetNodes: TransformNode[] = [];
  const byBody = new Map<string, BaroCadDocumentBabylonBindingV1>();
  try {
    for (const asset of owned.document.assets) {
      const members = selected.filter(entry => entry.binding.assetId === asset.id);
      if (!members.length) continue;
      const compiled = owned.compiledAssets.find(value => value.assetId === asset.id);
      if (!compiled || compiled.source !== asset.source) {
        throw new RangeError('Babylon document asset differs from authoritative compiled source');
      }
      const loaded = new BaroCADBabylonLoader(scene, native).parse(asset.source);
      staged.push(loaded);
      if (loaded.source !== asset.source || loaded.model.name !== compiled.model.name ||
          loaded.model.objects.length !== compiled.model.objects.length ||
          loaded.model.objects.some((object, index) => object.id !== compiled.model.objects[index].id ||
            object.kind !== compiled.model.objects[index].kind)) {
        throw new RangeError('Babylon source result differs from authoritative native Model');
      }
      const assetNode = new TransformNode(`barocad_asset_${asset.id}`, scene);
      assetNode.parent = root;
      assetNodes.push(assetNode);
      const used = new Set<string>();
      for (const mesh of loaded.meshes) {
        const metadata = mesh.metadata?.barocss as { curveId?: string; surfaceId?: string } | undefined;
        const geometryId = metadata?.curveId ?? metadata?.surfaceId;
        const member = members.find(entry => entry.binding.geometryId === geometryId);
        if (!member) { mesh.setEnabled(false); continue; }
        if (!geometryId || used.has(geometryId) ||
            (member.kind === 'curve' && !(mesh instanceof LinesMesh)) ||
            (member.kind === 'surface' && (mesh instanceof LinesMesh || !(mesh instanceof Mesh)))) {
          throw new RangeError('Babylon mesh differs from selected native body');
        }
        used.add(geometryId);
        mesh.parent = assetNode;
        byBody.set(member.binding.bodyId, Object.freeze({ ...member.binding,
          ref: member.ref, mesh, assetNode }));
      }
      if (used.size !== members.length) throw new RangeError('Selected document body has no Babylon mesh');
    }
    const bindings = Object.freeze(selected.map(entry => {
      const binding = byBody.get(entry.binding.bodyId);
      if (!binding) throw new RangeError('Selected document body was not displayed');
      return binding;
    }));
    let disposed = false;
    return Object.freeze({ root, assetNodes: Object.freeze(assetNodes), bindings, dispose() {
      if (disposed) return;
      disposed = true;
      for (const member of staged) member.dispose();
      root.dispose(false, false);
    } });
  } catch (error) {
    for (const member of staged) member.dispose();
    root.dispose(false, false);
    throw error;
  }
}
