export declare const CLOTH_STEP_SECONDS: number;
export declare const CLOTH_MAX_STEPS = 240;
export declare const CLOTH_SUBSTEPS = 8;
export declare const CLOTH_ITERATIONS = 2;
export declare const CLOTH_PROFILE_NAME = "pinned-sheet-sphere-v1";
export declare const CLOTH_PROFILE: Readonly<{
    size: 17;
    sideM: 1;
    heightM: 0.55;
    densityKgM2: 0.2;
    dt: number;
    gravityMps2: readonly number[];
    velocityDecayPerSecond: 1;
    sphereCentreM: readonly number[];
    sphereRadiusM: 0.3;
    collisionOffsetM: 0.002;
    stretchComplianceMPerN: 0.001;
    bendComplianceMPerN: 0.1;
}>;
