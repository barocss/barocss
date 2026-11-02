import type { CadSurfaceProxy, CadSurfaceProxyRequest } from './cad-proxy-types.js';
export declare function admitCadSurfaceProxy(source: string, request: CadSurfaceProxyRequest): CadSurfaceProxy;
export declare function assertCadProxyCurrent(proxy: CadSurfaceProxy, currentSource: string, currentRevision: string): void;
