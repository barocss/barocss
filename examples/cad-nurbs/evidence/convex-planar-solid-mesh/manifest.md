# Frozen #1602 native campaign

Parent 8535d09f2c6c5d5c706e33d3802d595151f41df0. Source leaf SHA256
379c1fcc1b66ab11ae7f1be95093095917f3d95b2dfcba43444b247bf42b4b9a.
Demo SHA256 9819cc49951df0e01312d68504db14488622bdb6250761165d3f56c475a0ed48.

Node22.23.3 at /workspace/shared/barocss-toolchain/node_modules/node/bin/node.
Existing dependency root ../barocss-handoff-81f4a57d: TypeScript5.9.3, esbuild0.25.12.
No install. NODE_OPTIONS=--max-old-space-size=2048; REPO_DEPS_ROOT resolves that root.
Run one packages/barocss-cad `node scripts/tool.mjs build`, then demo --source,
--emitted, --cold in this evidence directory. Each stage timeout180s; any failure
stops remaining stages until diagnosed. Disk >=500MiB before every stage; files
<=16MiB, JSON writes <=128MiB per process. First failures retained. No GPU/browser.

Source setup calls buildXYAffineSketch2, buildXYAffineSketchPrism2,
subtractConvexPlanarSlab1. Exact fixtures are pentagon prism (7faces/30uses),
left slab component (6faces/24uses), right component (6faces/24uses).
Source setup native facet builds bounded63, directed-use observations258,
D1 calls2322 (Curve1548/Surface774). This includes source reconstruction,
new native faces and qualifying the components; it is separate from mesh work.
Two prism qualifiers plus two subtraction parent validators and two output
qualifiers plus one subtraction root =7 SolidProof rational contexts. Sketch
solver contexts retain their provider's bounds and are not mesh rational work.

Each source/emitted mode: tessellate10 calls (3positive, 6zero-native preflight,
1forged-parent); validateMesh11 calls (3positive, 7whole-result mutations,
1zero-native getter). Cold: tessellate7 calls (only negatives), validateMesh11.
Total mesh public calls60: tessellate27 + validateMesh33.
Parent validations14/source,14/emitted,11/cold =39, each exactly once per admitted
mesh operation. No mesh-added native evaluation or rational context. All six
preflight cases plus getter per mode assert parent/face/CurveD1/SurfaceD1 zero.
Parent proof context max39; operations/gcd each <=39*200000, bits<=8192.
Actual expected mesh parent face builds94/source,94/emitted,75/cold =263;
directed uses396/source,396/emitted,318/cold =1110, D1=9990
(Curve6660/Surface3330). Each successful mesh call also asserts observed
CurveD1=6*uses, SurfaceD1=3*uses. Whole-result negatives use the 7face prism.
Combined setup+mesh: <=326face builds and12312D1 calls.

Positive matrix: all3parents, outward triangles/normal, independently calculated
world surface areas, every triangle vertex inside all original UV halfspaces,
UV exact directed pcurve endpoint identity, source-qualified original XYZ and
boundary lineage, boundary one-use, internal opposite-use, paired global edges,
forward/reverse faces, complete rebuild, copy isolation, source/emitted equivalence,
cold saved-result reopening and signed-zero JSON preservation.
Negative matrix: caller triangle budget; graph vertices>32; graph edges>32;
face edge/vertex mismatch; request asset count mismatch; request pair mismatch;
getter0; altered position, UV, winding, normal, native boundary identity, vertex
identity, report; forged parent face source identity. No retries inside driver.

Native correctness only. Physical GPU/browser, Float32 projection, integrated
editor adapter, broad suites, packaging and publication remain unrun.
