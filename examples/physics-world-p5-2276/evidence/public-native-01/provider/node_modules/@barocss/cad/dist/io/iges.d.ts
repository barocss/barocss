import type { Model } from '../types.js';
export interface IGESObjectReport {
    id: string;
    entity: 126 | 128;
    directoryPointer: number;
    parameterPointer: number;
    parameterRecords: number;
    domainU: [number, number];
    domainV?: [number, number];
    directoryLabel: string;
}
export interface IGESExportReport {
    format: 'IGES 5.3 ASCII';
    model: string;
    lengthUnit: 'mm';
    modelScale: 1;
    geometryLoss: 'none';
    nativeSourceIncluded: false;
    solid: false;
    objects: IGESObjectReport[];
    records: {
        S: number;
        G: number;
        D: number;
        P: number;
        T: number;
    };
    timestampPolicy: 'fixed-20000101.000000';
}
/** Export explicitly selected native IDs, in caller order. No filesystem access. */
export declare function exportIGES(model: Model, ids: string[]): {
    iges: string;
    report: IGESExportReport;
};
