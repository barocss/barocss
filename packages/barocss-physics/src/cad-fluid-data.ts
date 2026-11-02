/** Optional CAD-to-public-DATA admission. No World, initializer or clock. */
import type { PhysicsModel, WorldOptions } from './types.js';
import type { CadSurfaceProxy, CadSurfaceProxyRequest } from './cad-proxy-types.js';
import { copyData } from './identity.js';
import { admitModel } from './model-admission.js';
import { admitCadSurfaceProxy } from './cad-proxy-admission.js';
import { error } from './validation.js';

export function admitCadFluidStaticData(basinModel: PhysicsModel, targetOptions: WorldOptions,
  sourceText: string, request: CadSurfaceProxyRequest): { model: PhysicsModel; proxy: CadSurfaceProxy } {
  const options = copyData(targetOptions);
  if (!options || typeof options !== 'object' || Array.isArray(options)) error('INVALID_CONFIG','CAD fluid target options require a record');
  if (options.profile !== 'fluid-static-box-visual-v1') error('INVALID_CONFIG','CAD fluid data requires the static-box target profile');
  const base = admitModel(basinModel,{...options,profile:'fluid-basin-visual-v1'});
  if (base.domain?.kind !== 'fluid') error('INVALID_CONFIG','CAD fluid data requires one admitted basin fluid');
  const selection = copyData(request);
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) error('INVALID_CONFIG','CAD fluid selection requires a record');
  if (selection.kind !== 'static' || selection.proxy !== 'box') error('INVALID_CONFIG','CAD fluid obstacle requires one static box proxy');
  const proxy = admitCadSurfaceProxy(sourceText,selection);
  if (proxy.body.kind !== 'static' || proxy.collider.geometry.kind !== 'box') error('INVALID_CONFIG','CAD fluid obstacle must be a static box');
  const completed: PhysicsModel = {
    ...base.model,
    bodies:[...base.model.bodies,copyData(proxy.body)],
    colliders:[...base.model.colliders,copyData(proxy.collider)],
    fluids:base.model.fluids.map(fluid => ({...fluid,staticColliderIds:[...fluid.staticColliderIds,proxy.collider.id]})),
    sourceBindings:[...base.model.sourceBindings,copyData(proxy.binding)],
  };
  // Final pure admission applies the original fluid margin/overlap laws and
  // global ID/reference rules. Its bounded scratch is never runtime state.
  // Return the actual frozen proxy token for explicit assertCadProxyCurrent.
  return {model:admitModel(completed,options).model,proxy};
}
