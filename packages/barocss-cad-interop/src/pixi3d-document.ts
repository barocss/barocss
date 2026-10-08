import { Container3D, Mesh3D } from 'pixi3d/pixi7';
import type { CadDocumentResult } from '@barocss/cad';
import { prepareBaroCadDocumentPrimitiveNativeRefsV2 } from './document.js';
import type { BaroCadDocumentPrimitiveBindingV2, BaroCadDocumentPrimitiveOptionsV2,
  BaroCadDocumentPrimitiveRefV2 } from './document.js';
import { validateBaroCadParseOptions } from './native.js';
import { BaroCADPixi3DLoader } from './pixi3d.js';
import type { BaroCadPixi3DResult } from './pixi3d.js';

export interface BaroCadDocumentPixi3DBindingV1 extends BaroCadDocumentPrimitiveBindingV2 {
  readonly ref: BaroCadDocumentPrimitiveRefV2;
  readonly mesh: Mesh3D;
  readonly assetNode: Container3D;
}

export interface BaroCadDocumentPixi3DResultV1 {
  /** Owned display root. The caller attaches it to its Pixi stage. */
  readonly root: Container3D;
  readonly assetNodes: ReadonlyArray<Container3D>;
  /** Selected Surface and sample-v1 Curve bodies in authored document order. */
  readonly bindings: ReadonlyArray<BaroCadDocumentPixi3DBindingV1>;
  /** Idempotent. Keeps the caller Application, stage, renderer and canvas alive. */
  dispose(): void;
}

function disposeNodes(root: Container3D, assetNodes: Container3D[]): void {
  for (const node of assetNodes) node.destroy({ children: false });
  root.parent?.removeChild(root);
  root.destroy({ children: false });
}

/** Compose selected document Surfaces and sample-v1 Curves with pinned Pixi3D. */
export function createBaroCadDocumentPixi3DDisplay(
  result: CadDocumentResult, options: BaroCadDocumentPrimitiveOptionsV2,
): BaroCadDocumentPixi3DResultV1 {
  const selected = prepareBaroCadDocumentPrimitiveNativeRefsV2(result, options);
  const native = validateBaroCadParseOptions(options.native);
  if (native.curveDisplay !== undefined && !('version' in native.curveDisplay)) {
    throw new RangeError('Pixi3D document display requires curveDisplay version 1');
  }
  if (selected.some(entry => entry.kind === 'curve') && native.curveDisplay === undefined) {
    throw new RangeError('Selected document Curve requires curveDisplay version 1');
  }
  const owned = structuredClone(result);
  const root = new Container3D();
  const staged: BaroCadPixi3DResult[] = [];
  const assetNodes: Container3D[] = [];
  const byBody = new Map<string, BaroCadDocumentPixi3DBindingV1>();
  try {
    for (const asset of owned.document.assets) {
      const members = selected.filter(entry => entry.binding.assetId === asset.id);
      if (!members.length) continue;
      const compiled = owned.compiledAssets.find(value => value.assetId === asset.id);
      if (!compiled || compiled.source !== asset.source) {
        throw new RangeError('Pixi3D document asset differs from authoritative compiled source');
      }
      const loaded = new BaroCADPixi3DLoader(native).parse(asset.source);
      staged.push(loaded);
      if (loaded.source !== asset.source || loaded.model.name !== compiled.model.name ||
          loaded.model.objects.length !== compiled.model.objects.length ||
          loaded.model.objects.some((object, index) => object.id !== compiled.model.objects[index].id ||
            object.kind !== compiled.model.objects[index].kind)) {
        throw new RangeError('Pixi3D source result differs from authoritative native Model');
      }
      const assetNode = new Container3D();
      root.addChild(assetNode);
      assetNodes.push(assetNode);
      const used = new Set<string>();
      for (const rendered of loaded.renderedSurfaces) {
        const member = members.find(entry => entry.kind === 'surface' &&
          entry.binding.geometryId === rendered.surfaceId);
        if (!member) continue; // It remains in the unmounted adapter root until disposal.
        const key = `surface:${rendered.surfaceId}`;
        if (used.has(key) || !(rendered.mesh instanceof Mesh3D)) {
          throw new RangeError('Pixi3D mesh differs from selected native Surface');
        }
        used.add(key);
        assetNode.addChild(rendered.mesh);
        byBody.set(member.binding.bodyId, Object.freeze({ ...member.binding,
          ref: member.ref, mesh: rendered.mesh, assetNode }));
      }
      for (const rendered of loaded.renderedCurves) {
        const member = members.find(entry => entry.kind === 'curve' &&
          entry.binding.geometryId === rendered.curveId);
        if (!member) continue;
        const key = `curve:${rendered.curveId}`;
        if (used.has(key) || !(rendered.mesh instanceof Mesh3D)) {
          throw new RangeError('Pixi3D mesh differs from selected native Curve');
        }
        used.add(key);
        assetNode.addChild(rendered.mesh);
        byBody.set(member.binding.bodyId, Object.freeze({ ...member.binding,
          ref: member.ref, mesh: rendered.mesh, assetNode }));
      }
      if (used.size !== members.length) throw new RangeError('Selected document body has no Pixi3D mesh');
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
      disposeNodes(root, assetNodes);
    } });
  } catch (error) {
    for (const member of staged) member.dispose();
    disposeNodes(root, assetNodes);
    throw error;
  }
}
