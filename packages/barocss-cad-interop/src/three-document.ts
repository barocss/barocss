import { Group, Line, Mesh } from 'three';
import type { CadDocumentResult } from '@barocss/cad';
import { loadBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from './document.js';
import type {
  BaroCadDocumentPrimitiveBindingV2, BaroCadDocumentPrimitiveOptionsV2,
  BaroCadDocumentPrimitiveRefV2,
} from './document.js';
import { validateBaroCadParseOptions } from './native.js';
import { throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';
import { BaroCADLoader } from './three.js';
import type { BaroCadThreeResult } from './three.js';

export interface BaroCadDocumentThreeBindingV1 extends BaroCadDocumentPrimitiveBindingV2 {
  readonly ref: BaroCadDocumentPrimitiveRefV2;
  readonly object: Mesh | Line;
  readonly assetGroup: Group;
}

export interface BaroCadDocumentThreeResultV1 {
  /** One group per selected asset, containing only selected Mesh/Line children. */
  readonly root: Group;
  /** Authored document body order, even when requested bodyIds use another order. */
  readonly bindings: ReadonlyArray<BaroCadDocumentThreeBindingV1>;
  /** Detach and release only the parsed adapter objects; safe to call twice. */
  dispose(): void;
}

/** Compose accepted document bodies with the existing native source0 Three loader. */
export function createBaroCadDocumentThreeDisplay(
  result: CadDocumentResult, options: BaroCadDocumentPrimitiveOptionsV2,
): BaroCadDocumentThreeResultV1 {
  const selected = prepareBaroCadDocumentPrimitiveNativeRefsV2(result, options);
  const owned = structuredClone(result);
  const native = validateBaroCadParseOptions(options.native);
  const root = new Group();
  root.name = owned.document.documentId;
  const staged: BaroCadThreeResult[] = [];
  const byBody = new Map<string, BaroCadDocumentThreeBindingV1>();
  try {
    for (const asset of owned.document.assets) {
      const members = selected.filter(entry => entry.binding.assetId === asset.id);
      if (!members.length) continue;
      const compiled = owned.compiledAssets.find(value => value.assetId === asset.id);
      if (!compiled || compiled.source !== asset.source) {
        throw new RangeError('Three document asset differs from authoritative compiled source');
      }
      const loaded = new BaroCADLoader(native).parse(asset.source);
      staged.push(loaded);
      if (loaded.source !== asset.source || loaded.model.name !== compiled.model.name ||
          loaded.model.objects.length !== compiled.model.objects.length ||
          loaded.model.objects.some((object, index) => object.id !== compiled.model.objects[index].id ||
            object.kind !== compiled.model.objects[index].kind)) {
        throw new RangeError('Three source result differs from authoritative native Model');
      }
      const used = new Set<string>();
      for (const child of [...loaded.group.children]) {
        const member = members.find(entry => entry.binding.geometryId === child.name);
        if (!member) { loaded.group.remove(child); continue; }
        if (used.has(child.name) || (member.kind === 'surface' && !(child instanceof Mesh)) ||
            (member.kind === 'curve' && !(child instanceof Line))) {
          throw new RangeError('Three child differs from selected native body');
        }
        if (!(child instanceof Mesh) && !(child instanceof Line)) {
          throw new RangeError('Selected Three child is not a Mesh or Line');
        }
        used.add(child.name);
        byBody.set(member.binding.bodyId, Object.freeze({ ...member.binding,
          ref: member.ref, object: child, assetGroup: loaded.group }));
      }
      if (used.size !== members.length) throw new RangeError('Selected document body has no Three child');
      root.add(loaded.group);
    }
    const bindings = Object.freeze(selected.map(entry => {
      const binding = byBody.get(entry.binding.bodyId);
      if (!binding) throw new RangeError('Selected document body was not displayed');
      return binding;
    }));
    let disposed = false;
    return Object.freeze({ root, bindings, dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const member of staged) member.dispose();
      root.clear();
    } });
  } catch (error) {
    for (const member of staged) member.dispose();
    root.clear();
    throw error;
  }
}

/** Read a bounded document URL and stage selected Three objects atomically. */
export async function loadBaroCadDocumentThreeDisplay(
  url: string, options: BaroCadDocumentPrimitiveOptionsV2,
  transport: BaroCadLoadTransportOptions = {},
): Promise<BaroCadDocumentThreeResultV1> {
  const request = validateBaroCadTransport(url, transport);
  const document = await loadBaroCadDocument(request.url, {
    signal: request.signal, onProgress: request.onProgress,
  });
  throwIfBaroCadAborted(request.signal);
  let display: BaroCadDocumentThreeResultV1 | undefined;
  try {
    display = createBaroCadDocumentThreeDisplay(document, options);
    await Promise.resolve();
    throwIfBaroCadAborted(request.signal);
    return display;
  } catch (error) {
    display?.dispose();
    throw error;
  }
}
