function buildKernelModels(helpers, selectedStaticBox, count) {
  const { createSheet, CLOTH_PROFILE, FLUID_PARTICLE_RADIUS_M, FLUID_SMOOTHING_RADIUS_M } = helpers;
  const sheet = createSheet();
  count("triangleMassAccumulations");
  const masses = new Float64Array(289);
  const spacing = CLOTH_PROFILE.sideM / (CLOTH_PROFILE.size - 1);
  const triangleVertexMass = CLOTH_PROFILE.densityKgM2 * spacing ** 2 / 6;
  for (const index of sheet.triangles) masses[index] += triangleVertexMass;
  const triples = (array) => Array.from({ length: array.length / 3 }, (_, i) => [...array.slice(i * 3, i * 3 + 3)]);
  const cloth = {
    id: "p5Cloth",
    restPositionsM: triples(sheet.restPositions),
    initialPositionsM: triples(sheet.positions),
    initialVelocitiesMps: Array.from({ length: 289 }, () => [0, 0, 0]),
    vertexMassesKg: [...masses],
    triangles: triples(sheet.triangles),
    pinnedVertexIndices: [...sheet.pins],
    constraints: sheet.constraints.map((c) => ({
      a: c.a,
      b: c.b,
      kind: c.kind,
      restLengthM: c.rest,
      complianceMPerN: c.kind === "bend-distance" ? CLOTH_PROFILE.bendComplianceMPerN : CLOTH_PROFILE.stretchComplianceMPerN
    })),
    staticColliderIds: ["p5SphereCollider"]
  };
  const positions = [];
  for (let z = 0; z < 4; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) positions.push([0.2 + x * 0.05, 0.45 + y * 0.05, 0.3 + z * 0.05]);
  const staticPair = (name, positionM, geometry) => ({
    body: { id: `p5${name}Body`, kind: "static", initial: { positionM: [...positionM], orientationXYZW: [0, 0, 0, 1] } },
    collider: {
      id: `p5${name}Collider`,
      bodyId: `p5${name}Body`,
      geometry: structuredClone(geometry),
      local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
      material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
      sensor: false,
      ccd: false,
      filter: { categoryBits: 1, maskBits: 65535 }
    }
  });
  const sphere = staticPair("Sphere", [0, 0.1, 0], { kind: "sphere", radiusM: 0.3 });
  const basin = staticPair("Basin", [0.35, 0.65, 0.25], { kind: "box-interior", halfExtentsM: [0.35, 0.65, 0.25] });
  const shelf = staticPair("Shelf", selectedStaticBox.centerM, { kind: "box", halfExtentsM: selectedStaticBox.halfExtentsM });
  const profiles = ["cloth-pinned-sphere-visual-v1", "fluid-basin-visual-v1", "fluid-basin-xsph-visual-v1", "fluid-static-box-visual-v1"];
  return profiles.map((profile) => {
    const isCloth = profile.startsWith("cloth"), isBox = profile === "fluid-static-box-visual-v1";
    const pairs = isCloth ? [sphere] : isBox ? [basin, shelf] : [basin];
    const fluid = {
      id: "p5Fluid",
      initialPositionsM: structuredClone(positions),
      initialVelocitiesMps: Array.from({ length: 256 }, () => [0, 0, 0]),
      massModel: { kind: "visual-unit-weights" },
      particleRadiusM: FLUID_PARTICLE_RADIUS_M,
      smoothingRadiusM: FLUID_SMOOTHING_RADIUS_M,
      visualSmoothing: profile === "fluid-basin-xsph-visual-v1" ? { kind: "xsph", coefficient: 0.15 } : { kind: "none" },
      staticColliderIds: pairs.map((p) => p.collider.id)
    };
    const model = {
      format: "barocss-physics-model",
      version: 1,
      revision: "p5KernelFixture1",
      frame: { id: "world", basis: "right-handed-xyz", rotation: "local-to-world-xyzw" },
      units: { length: "m", mass: "kg", time: "s", angle: "rad" },
      gravityMps2: [0, -9.81, 0],
      bodies: pairs.map((p) => structuredClone(p.body)),
      colliders: pairs.map((p) => structuredClone(p.collider)),
      joints: [],
      cloths: isCloth ? [structuredClone(cloth)] : [],
      fluids: isCloth ? [] : [fluid],
      sourceBindings: []
    };
    return { profile, model, staticData: { profile, gravityMps2: model.gravityMps2, bodies: model.bodies, colliders: model.colliders } };
  });
}
export {
  buildKernelModels
};
