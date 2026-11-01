import type { CadSurfaceProxy, CadSurfaceProxyRequest } from '../cad-proxy-types.js';
import type { FluidStaticBox } from './static-box.js';
export declare function admitCadFluidObstacle(scene: unknown, sourceText: string, request: CadSurfaceProxyRequest): {
    proxy: CadSurfaceProxy;
    box: FluidStaticBox;
};
