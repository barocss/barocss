import { rotate, sub } from './math.js';
import { proxyError } from './cad-proxy-validation.js';
import { assertCadProxyCurrent } from './cad-proxy-admission.js';
export function cadProxyPose(proxy, body, currentSource, currentRevision) {
    assertCadProxyCurrent(proxy, currentSource, currentRevision);
    if (!body || body.id !== proxy.bodyId || !Array.isArray(body.positionM) || body.positionM.length !== 3 ||
        body.positionM.some((value) => !Number.isFinite(value) || Math.abs(value) > 10000) ||
        !Array.isArray(body.orientationXYZW) || body.orientationXYZW.length !== 4 ||
        body.orientationXYZW.some((value) => !Number.isFinite(value)) ||
        Math.abs(Math.hypot(...body.orientationXYZW) - 1) > 1e-9) {
        proxyError('INVALID_CONFIG', 'Physics body pose differs from CAD proxy binding');
    }
    const positionMM = body.positionM.map((value) => value * 1000);
    const translation = sub(positionMM, rotate([body.orientationXYZW[0], body.orientationXYZW[1], body.orientationXYZW[2], body.orientationXYZW[3]], proxy.sourceCenterMM));
    if (translation.some((value) => !Number.isFinite(value)))
        proxyError('NUMERIC_LIMIT', 'unsafe CAD proxy pose');
    return { targetId: proxy.bodyId, translation, rotation: [...body.orientationXYZW] };
}
