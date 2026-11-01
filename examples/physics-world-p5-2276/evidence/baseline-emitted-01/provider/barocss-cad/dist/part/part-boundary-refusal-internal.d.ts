import { KernelError } from '../core/barocss-error.js';
type BoundaryRefusal = KernelError & {
    readonly code: 'GEOMETRY' | 'CAPABILITY';
};
export declare function boundaryBindingRefusal(cause: unknown): BoundaryRefusal | null;
export {};
