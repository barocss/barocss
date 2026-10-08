import type { CadProxyBodyState, CadProxyPose, CadSurfaceProxy } from './cad-proxy-types.js';
import type { Quat, Vec3 } from './types.js';
import { rotate, sub } from './math.js';
import { proxyError } from './cad-proxy-validation.js';
import { assertCadProxyCurrent } from './cad-proxy-admission.js';

export function cadProxyPose(proxy: CadSurfaceProxy, body: CadProxyBodyState,
  currentSource: string, currentRevision: string): CadProxyPose {
  assertCadProxyCurrent(proxy, currentSource, currentRevision);
  if (!body || body.id !== proxy.bodyId || !Array.isArray(body.positionM) || body.positionM.length !== 3 ||
    body.positionM.some((value) => !Number.isFinite(value) || Math.abs(value) > 10000) ||
    !Array.isArray(body.orientation) || body.orientation.length !== 4 ||
    body.orientation.some((value) => !Number.isFinite(value)) ||
    Math.abs(Math.hypot(...body.orientation) - 1) > 1e-9) {
    proxyError('INVALID_CONFIG', 'Physics body pose differs from CAD proxy binding');
  }
  const positionMM = body.positionM.map((value) => value * 1000) as Vec3;
  const translation = sub(positionMM, rotate(body.orientation, proxy.sourceCenterMM));
  if (translation.some((value) => !Number.isFinite(value))) proxyError('NUMERIC_LIMIT', 'unsafe CAD proxy pose');
  return { targetId: proxy.bodyId, translation, rotation: [...body.orientation] as Quat };
}
