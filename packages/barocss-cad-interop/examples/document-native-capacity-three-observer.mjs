import { BaroCADLoader } from '@barocss/cad-interop/three';

let observing = false;
/** Observe only five actual instances prepared during this exact document action. */
export async function observeDocumentPreparation(expectedSource, action) {
  if (observing) throw new Error('Document preparation observers must not overlap');
  if (typeof expectedSource !== 'string' || typeof action !== 'function') throw new TypeError('Expected source and action are required');
  observing = true;
  const original = BaroCADLoader.prototype.parse;
  const prepared = [];
  let calls = 0;
  let native;
  BaroCADLoader.prototype.parse = function (source) {
    if (source !== expectedSource || ++calls !== 1) throw new Error('Observer requires one parse of the exact pinned source');
    native = original.call(this, source);
    try {
      if (native.source !== expectedSource || native.model.objects.length !== 5 || native.group.children.length !== 5) {
        throw new Error('Observer expected five actual native display members');
      }
      for (const object of native.group.children) {
        const { geometry, material } = object;
        if (!geometry || !material || Array.isArray(material)) throw new Error('Observer requires a single actual geometry/material pair');
        const entry = { object, geometry, material, geometryId: object.name,
          geometryDisposals: 0, materialDisposals: 0 };
        geometry.addEventListener('dispose', () => entry.geometryDisposals++);
        material.addEventListener('dispose', () => entry.materialDisposals++);
        prepared.push(entry);
      }
      return native;
    } catch (error) {
      native.dispose();
      throw error;
    }
  };
  try {
    const display = await action();
    if (calls !== 1 || prepared.length !== 5) throw new Error('Observed document action must prepare exactly one five-member asset');
    return { display, prepared };
  } catch (error) {
    native?.dispose();
    throw error;
  } finally {
    BaroCADLoader.prototype.parse = original;
    observing = false;
  }
}
