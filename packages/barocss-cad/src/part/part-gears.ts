// R5.3 (D221): the gear features of the part model — spur, internal, bevel, worm, worm wheel and rack — moved out of
// part-model.ts's operation() as they were there. The dispatcher calls `gearOperation` for those kinds.
import { type BevelGearSpec, type PlacedBevelGear, bevelGear, bevelGearMatrix, bevelMatePlacement } from '../machine/gear-bevel.js';
import { type GearDiagnosticCode, isGearError, type SpurGearSpec, spurGear, spurGearCenterDistance, spurGearDimensions } from '../machine/gear.js';
import { type InternalGearSpec, type PlacedInternalGear, internalGear, internalGearCenterDistance, pinionTurnInside } from '../machine/gear-internal.js';
import { type PlacedThroatedWheel, type ThroatedWheelSpec, throatedWormPlacement, throatedWormWheel } from '../machine/gear-worm-wheel.js';
import { type SpurRackSpec, spurRack } from '../machine/gear-rack.js';
import { type WormSpec, wormMatrix, wormPlacement, worm as wormSolid } from '../machine/gear-worm.js';
import { transformBrep } from '../brep/brep-transform.js';
import type { BevelGearPlacement, CadPartDim, CadPartErrorCode, CadPartPoint2, GearPlacement, RackPlacement, WormPlacement, CadPartFeature, Result, Tools, PartHelpers } from './part-model.js';

/** Gear diagnostics as the part model's codes (the gear's own code kept in the message). */
const GEAR_CODES: Record<GearDiagnosticCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', UNSUPPORTED_PROFILE_SHIFT: 'CAPABILITY', UNSUPPORTED_GEAR_KIND: 'CAPABILITY', PROFILE_BUDGET_EXCEEDED: 'CAPABILITY', SELF_INTERSECTION: 'GEOMETRY', ROOT_TRANSITION_UNVALIDATED: 'GEOMETRY', BORE_INTERSECTION: 'GEOMETRY', MATE_INCOMPATIBLE: 'INPUT', UNDERCUT: 'GEOMETRY', INVOLUTE_INTERFERENCE: 'GEOMETRY', TROCHOID_INTERFERENCE: 'GEOMETRY', TRIMMING_INTERFERENCE: 'GEOMETRY', RIM_INTERSECTION: 'GEOMETRY', IDEAL_MODEL: 'GEOMETRY' };
/** A gear feature's evaluation (part-model.ts's operation() for these kinds). */
export function gearOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, xy, ref, fail, at } = t;
  const { isRecord } = k;
  switch (f.kind) {
    case 'spur-gear': {
      if (f.generator !== undefined && f.generator !== 'spur-gear@0' && f.generator !== 'spur-gear@1') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      // (@1: the generated root; @0 and none: the schematic one, as documents written with it rebuild.)
      const generatedRoot = f.generator === 'spur-gear@1';
      if (!generatedRoot && f.toolTipRadius !== undefined) fail('INPUT', "toolTipRadius belongs to a generated root (generator 'spur-gear@1')");
      // (Helical: the normal module, named so; the kernel refuses a module with a helix angle.)
      const helical = f.helixAngle !== undefined && f.helixAngle !== 0;
      if (helical && f.module !== undefined) fail('INPUT', 'a helical gear takes normalModule (the normal module), not module');
      if (!helical && (f.normalModule !== undefined || f.hand !== undefined)) fail('INPUT', 'normalModule and hand belong to a helical gear: give helixAngle too (a spur gear takes module)');
      const m = helical ? dim(f.normalModule as CadPartDim, 'normalModule', true) : dim(f.module as CadPartDim, 'module', true), b = dim(f.faceWidth as CadPartDim, 'faceWidth', true);
      const bore = f.bore === undefined ? 0 : dim(f.bore as CadPartDim, 'bore'), red = f.thicknessReduction === undefined ? 0 : dim(f.thicknessReduction as CadPartDim, 'thicknessReduction');
      if (f.rotation !== undefined && !(typeof f.rotation === 'number' && Number.isFinite(f.rotation))) fail('INPUT', 'rotation must be a number of degrees');
      const spec: SpurGearSpec = { ...(helical ? { normalModule: m, helixAngle: f.helixAngle as number, hand: f.hand as 'right' | 'left' } : { module: m }), teeth: f.teeth as number, faceWidth: b, boreDiameter: bore, toothThicknessReduction: red,
        ...(f.pressureAngle === undefined ? {} : { pressureAngle: f.pressureAngle as number }), ...(f.profileShift === undefined ? {} : { profileShiftCoefficient: f.profileShift as number }), ...(f.profileTolerance === undefined ? {} : { profileTolerance: f.profileTolerance as number }),
        ...(generatedRoot ? { rootPolicy: 'generated' as const, ...(f.toolTipRadius === undefined ? {} : { toolTipRadius: dim(f.toolTipRadius as CadPartDim, 'toolTipRadius', true) }) } : {}) };
      // Where it stands: its own centre, plane and turn, or beside the gear it meshes with.
      let place: GearPlacement;
      const mesh = f.mesh as Record<string, unknown> | undefined;
      if (mesh !== undefined) {
        if (!isRecord(mesh) || typeof mesh.gear !== 'string') fail('INPUT', 'mesh must be { gear, direction?, centerDistance?, phase? }');
        // (Referenced, not consumed: the gear it meshes with stays an output of its own.)
        const other = ref(mesh!.gear, 'mesh.gear').result;
        const driver = other.kind === 'solid' && other.parts.length === 1 ? other.parts[0].gearPlace : undefined;
        const ringPlace = other.kind === 'solid' && other.parts.length === 1 ? other.parts[0].internalPlace : undefined;
        if (!driver && !ringPlace) fail('REFERENCE', `${String(mesh!.gear)} is not a spur gear or an internal gear`);
        const dirDeg = mesh!.direction ?? 0, phaseDeg = mesh!.phase ?? 0;
        if (!(typeof dirDeg === 'number' && Number.isFinite(dirDeg)) || !(typeof phaseDeg === 'number' && Number.isFinite(phaseDeg))) fail('INPUT', 'mesh.direction and mesh.phase must be numbers of degrees');
        if (ringPlace) {
          // Inside a ring (R12b.2a): at the internal pair's distance along the direction from the ring's centre, a tooth in
          // the ring's space there, turning with the ring by z2/z1 the same way.
          let a = 0;
          try { a = internalGearCenterDistance(spec, ringPlace.spec); } catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}${cause.code === 'MATE_INCOMPATIBLE' ? ` (meshing inside ${String(mesh!.gear)})` : ''}`); throw cause; }
          if (mesh!.centerDistance !== undefined) a = dim(mesh!.centerDistance as CadPartDim, 'mesh.centerDistance', true);
          const phi = (dirDeg as number) * Math.PI / 180;
          place = { spec, center: [ringPlace.center[0] + a * Math.cos(phi), ringPlace.center[1] + a * Math.sin(phi)], from: ringPlace.from, rotation: pinionTurnInside(ringPlace, f.teeth as number, phi, (phaseDeg as number) * Math.PI / 180), meshesWith: String(mesh!.gear), ring: ringPlace };
          return () => {
            let made: ReturnType<typeof spurGear>;
            try { made = spurGear(spec, { id: at }); }
            catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}`); throw cause; }
            const c = Math.cos(place.rotation), sn = Math.sin(place.rotation);
            const brep = transformBrep(made!.brep, { matrix: [c, -sn, 0, sn, c, 0, 0, 0, 1], offset: [place.center[0], place.center[1], place.from] });
            return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, gear: made!.report, gearPlace: place }] };
          };
        }
        const z1 = driver!.spec.teeth, z2 = f.teeth as number;
        // (Whether they mesh at all — module, pressure angle, helix angle and hands — before where.)
        let a = 0;
        try { a = spurGearCenterDistance(driver!.spec, spec); } catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}${cause.code === 'MATE_INCOMPATIBLE' ? ` (meshing with ${String(mesh!.gear)})` : ''}`); throw cause; }
        if (mesh!.centerDistance !== undefined) a = dim(mesh!.centerDistance as CadPartDim, 'mesh.centerDistance', true);
        const phi = (dirDeg as number) * Math.PI / 180;
        place = { spec, center: [driver!.center[0] + a * Math.cos(phi), driver!.center[1] + a * Math.sin(phi)], from: driver!.from,
          rotation: phi + Math.PI - Math.PI / z2 - (driver!.rotation - phi) * z1 / z2 + (phaseDeg as number) * Math.PI / 180, meshesWith: String(mesh!.gear), driver: driver! };
      } else {
        place = { spec, center: f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center'), from: f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from'), rotation: ((f.rotation as number | undefined) ?? 0) * Math.PI / 180 };
      }
      return () => {
        let made: ReturnType<typeof spurGear>;
        try { made = spurGear(spec, { id: at }); }
        catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}`); throw cause; }
        const c = Math.cos(place.rotation), sn = Math.sin(place.rotation);
        const brep = place.rotation || place.center[0] || place.center[1] || place.from ? transformBrep(made!.brep, { matrix: [c, -sn, 0, sn, c, 0, 0, 0, 1], offset: [place.center[0], place.center[1], place.from] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, gear: made!.report, gearPlace: place }] };
      };
    }
    case 'internal-gear': {
      if (f.generator !== undefined && f.generator !== 'internal-gear@0' && f.generator !== 'internal-gear@1') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      // (@1: the shaper-cut root, its cutter required; @0 and none: the schematic one.)
      const shaperCut = f.generator === 'internal-gear@1', cut = f.cutter as Record<string, unknown> | undefined;
      if (!shaperCut && cut !== undefined) fail('INPUT', "cutter belongs to a shaper-cut root (generator 'internal-gear@1')");
      if (shaperCut && (!isRecord(cut) || !(typeof cut.teeth === 'number'))) fail('INPUT', "a shaper-cut internal gear needs its cutter: { teeth, shift?, tipRadius? }");
      const helical = f.helixAngle !== undefined && f.helixAngle !== 0;
      if (helical && f.module !== undefined) fail('INPUT', 'a helical internal gear takes normalModule (the normal module), not module');
      if (!helical && (f.normalModule !== undefined || f.hand !== undefined)) fail('INPUT', 'normalModule and hand belong to a helical internal gear: give helixAngle too (a straight one takes module)');
      const m = helical ? dim(f.normalModule as CadPartDim, 'normalModule', true) : dim(f.module as CadPartDim, 'module', true), b = dim(f.faceWidth as CadPartDim, 'faceWidth', true), rim = dim(f.rim as CadPartDim, 'rim', true);
      const red = f.thicknessReduction === undefined ? 0 : dim(f.thicknessReduction as CadPartDim, 'thicknessReduction');
      if (f.rotation !== undefined && !(typeof f.rotation === 'number' && Number.isFinite(f.rotation))) fail('INPUT', 'rotation must be a number of degrees');
      const spec: InternalGearSpec = { ...(helical ? { normalModule: m, helixAngle: f.helixAngle as number, hand: f.hand as 'right' | 'left' } : { module: m }), teeth: f.teeth as number, faceWidth: b, rimDiameter: rim, toothThicknessReduction: red,
        ...(f.pressureAngle === undefined ? {} : { pressureAngle: f.pressureAngle as number }), ...(f.profileShift === undefined ? {} : { profileShiftCoefficient: f.profileShift as number }), ...(f.profileTolerance === undefined ? {} : { profileTolerance: f.profileTolerance as number }),
        ...(shaperCut ? { rootPolicy: 'shaper-cut' as const, cutter: { teeth: cut!.teeth as number, ...(cut!.shift === undefined ? {} : { profileShiftCoefficient: cut!.shift as number }), ...(cut!.tipRadius === undefined ? {} : { tipRadius: dim(cut!.tipRadius as CadPartDim, 'cutter.tipRadius', true) }) } } : {}) };
      const place: PlacedInternalGear = { spec, center: f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center'), from: f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from'), rotation: ((f.rotation as number | undefined) ?? 0) * Math.PI / 180 };
      return () => {
        let made: ReturnType<typeof internalGear>;
        try { made = internalGear(spec, { id: at }); }
        catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}`); throw cause; }
        const c = Math.cos(place.rotation), sn = Math.sin(place.rotation);
        const brep = place.rotation || place.center[0] || place.center[1] || place.from ? transformBrep(made!.brep, { matrix: [c, -sn, 0, sn, c, 0, 0, 0, 1], offset: [place.center[0], place.center[1], place.from] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, internalGear: made!.report, internalPlace: place }] };
      };
    }
    case 'bevel-gear': {
      if (f.generator !== undefined && f.generator !== 'bevel-gear@0') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      const m = dim(f.module as CadPartDim, 'module', true), b = dim(f.faceWidth as CadPartDim, 'faceWidth', true);
      const bore = f.bore === undefined ? 0 : dim(f.bore as CadPartDim, 'bore'), red = f.thicknessReduction === undefined ? 0 : dim(f.thicknessReduction as CadPartDim, 'thicknessReduction');
      if (f.rotation !== undefined && !(typeof f.rotation === 'number' && Number.isFinite(f.rotation))) fail('INPUT', 'rotation must be a number of degrees');
      if (f.shaftAngle !== undefined && !(typeof f.shaftAngle === 'number' && Number.isFinite(f.shaftAngle))) fail('INPUT', 'shaftAngle must be a number of degrees');
      // (A spiral one, R12b.4: its angle and hand as given — the kernel refuses what it cannot take — its cutter radius a length.)
      const spr = f.spiral as Record<string, unknown> | undefined;
      if (spr !== undefined && !isRecord(spr)) fail('INPUT', 'spiral must be { angle, hand, cutterRadius }');
      const spec: BevelGearSpec = { module: m, teeth: f.teeth as number, mateTeeth: f.mateTeeth as number, ...(f.shaftAngle === undefined ? {} : { shaftAngle: f.shaftAngle as number }), faceWidth: b, boreDiameter: bore, toothThicknessReduction: red,
        ...(f.pressureAngle === undefined ? {} : { pressureAngle: f.pressureAngle as number }), ...(f.profileTolerance === undefined ? {} : { profileTolerance: f.profileTolerance as number }),
        ...(spr === undefined ? {} : { spiral: { angle: spr.angle as number, hand: spr.hand as 'right' | 'left', cutterRadius: dim(spr.cutterRadius as CadPartDim, 'spiral.cutterRadius', true) } }) };
      const mesh = f.mesh as Record<string, unknown> | undefined;
      let place: BevelGearPlacement;
      if (mesh !== undefined) {
        if (!isRecord(mesh) || typeof mesh.gear !== 'string') fail('INPUT', 'mesh must be { gear, direction?, phase? }');
        const other = ref(mesh!.gear, 'mesh.gear').result;
        const driver = other.kind === 'solid' && other.parts.length === 1 ? other.parts[0].bevelPlace : undefined;
        if (!driver) fail('REFERENCE', `${String(mesh!.gear)} is not a bevel gear`);
        const dirDeg = mesh!.direction ?? 0, phaseDeg = mesh!.phase ?? 0;
        if (!(typeof dirDeg === 'number' && Number.isFinite(dirDeg)) || !(typeof phaseDeg === 'number' && Number.isFinite(phaseDeg))) fail('INPUT', 'mesh.direction and mesh.phase must be numbers of degrees');
        let at2: PlacedBevelGear;
        try { at2 = bevelMatePlacement(driver!, spec, (dirDeg as number) * Math.PI / 180, (phaseDeg as number) * Math.PI / 180); }
        catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}${cause.code === 'MATE_INCOMPATIBLE' ? ` (meshing with ${String(mesh!.gear)})` : ''}`); throw cause; }
        place = { ...at2!, meshesWith: String(mesh!.gear), driver: driver! };
      } else {
        const c = f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center');
        place = { spec, apex: [c[0], c[1], f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from')], axis: [0, 0, 1], xAxis: [1, 0, 0], rotation: ((f.rotation as number | undefined) ?? 0) * Math.PI / 180 };
      }
      return () => {
        let made: ReturnType<typeof bevelGear>;
        try { made = bevelGear(spec, { id: at }); }
        catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}`); throw cause; }
        const T = bevelGearMatrix(place), moved = T.matrix.some((x, i) => x !== [1, 0, 0, 0, 1, 0, 0, 0, 1][i]) || T.offset.some(x => x !== 0);
        const brep = moved ? transformBrep(made!.brep, T) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, bevelGear: made!.report, bevelPlace: place }] };
      };
    }
    case 'worm': {
      if (f.generator !== undefined && f.generator !== 'worm@0') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      const L = dim(f.length as CadPartDim, 'length', true), bore = f.bore === undefined ? 0 : dim(f.bore as CadPartDim, 'bore'), red = f.thicknessReduction === undefined ? 0 : dim(f.thicknessReduction as CadPartDim, 'thicknessReduction');
      if (f.rotation !== undefined && !(typeof f.rotation === 'number' && Number.isFinite(f.rotation))) fail('INPUT', 'rotation must be a number of degrees');
      const mesh = f.mesh as Record<string, unknown> | undefined;
      if (mesh !== undefined && (!isRecord(mesh) || typeof mesh.gear !== 'string')) fail('INPUT', 'mesh must be { gear, direction?, phase? }');
      const other = mesh === undefined ? undefined : ref(mesh.gear, 'mesh.gear').result;
      const wheel = other && other.kind === 'solid' && other.parts.length === 1 ? other.parts[0].gearPlace : undefined;
      const throated = other && other.kind === 'solid' && other.parts.length === 1 ? other.parts[0].wormWheelPlace : undefined;
      if (mesh !== undefined && !wheel && !throated) fail('REFERENCE', `${String(mesh.gear)} is not a spur gear or a worm wheel (a worm's wheel is a helical gear or a throated wheel)`);
      // (Meshing, left out: the wheel's — m_x = m_n / cos β, d1 = z1 m_x / tan β, its hand.)
      const z1 = f.starts as number, wd = wheel ? spurGearDimensions(wheel.spec) : undefined;
      if (wd && !wd.beta) fail('INPUT', `[MATE_INCOMPATIBLE] ${String(mesh!.gear)} is straight: a worm's wheel is helical, at the worm's lead angle`);
      // (A throated wheel's worm: the one its hob was, R12b.6.)
      const tw = throated?.spec.worm;
      const mx = f.axialModule !== undefined ? dim(f.axialModule as CadPartDim, 'axialModule', true) : tw ? tw.axialModule : wd ? wd.mn / Math.cos(wd.beta) : dim(undefined as unknown as CadPartDim, 'axialModule', true);
      const d1 = f.diameter !== undefined ? dim(f.diameter as CadPartDim, 'diameter', true) : tw ? tw.diameter : wd ? z1 * mx / Math.tan(Math.abs(wd.beta)) : dim(undefined as unknown as CadPartDim, 'diameter', true);
      const hand = (f.hand as 'right' | 'left' | undefined) ?? (tw ? tw.hand : wd ? (wd.beta > 0 ? 'right' : 'left') : undefined);
      const spec: WormSpec = { axialModule: mx, starts: z1, diameter: d1, hand: hand as 'right' | 'left', length: L, ...(f.form === undefined ? {} : { form: f.form as WormSpec['form'] }), boreDiameter: bore, toothThicknessReduction: red, ...(f.profileTolerance === undefined ? {} : { profileTolerance: f.profileTolerance as number }) };
      let place: WormPlacement;
      try {
        if (wheel || throated) {
          const dirDeg = mesh!.direction ?? 0, phaseDeg = mesh!.phase ?? 0;
          if (!(typeof dirDeg === 'number' && Number.isFinite(dirDeg)) || !(typeof phaseDeg === 'number' && Number.isFinite(phaseDeg))) fail('INPUT', 'mesh.direction and mesh.phase must be numbers of degrees');
          const phi = (dirDeg as number) * Math.PI / 180, ph = (phaseDeg as number) * Math.PI / 180;
          place = throated ? { ...throatedWormPlacement(throated, spec, phi, ph), meshesWith: String(mesh!.gear), throatedWheel: throated } : { ...wormPlacement(wheel!, spec, phi, ph), meshesWith: String(mesh!.gear), wheel: wheel! };
        } else {
          const c = f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center');
          place = { spec, origin: [c[0], c[1], f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from')], axis: [0, 0, 1], xAxis: [1, 0, 0], rotation: ((f.rotation as number | undefined) ?? 0) * Math.PI / 180 };
        }
      } catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}${cause.code === 'MATE_INCOMPATIBLE' ? ` (meshing with ${String(mesh!.gear)})` : ''}`); throw cause; }
      return () => {
        let made: ReturnType<typeof wormSolid>;
        try { made = wormSolid(spec, { id: at }); }
        catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}`); throw cause; }
        const T = wormMatrix(place!), moved = T.matrix.some((x, i) => x !== [1, 0, 0, 0, 1, 0, 0, 0, 1][i]) || T.offset.some(x => x !== 0);
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: moved ? transformBrep(made!.brep, T) : made!.brep }, worm: made!.report, wormPlace: place! }] };
      };
    }
    case 'worm-wheel': {
      if (f.generator !== undefined && f.generator !== 'worm-wheel@0') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      const ww = f.worm as Record<string, unknown> | undefined;
      if (!isRecord(ww)) fail('INPUT', 'worm must be { axialModule, starts, diameter, hand }');
      const b = dim(f.faceWidth as CadPartDim, 'faceWidth', true), bore = f.bore === undefined ? 0 : dim(f.bore as CadPartDim, 'bore'), red = f.thicknessReduction === undefined ? 0 : dim(f.thicknessReduction as CadPartDim, 'thicknessReduction');
      if (f.rotation !== undefined && !(typeof f.rotation === 'number' && Number.isFinite(f.rotation))) fail('INPUT', 'rotation must be a number of degrees');
      const spec: ThroatedWheelSpec = { worm: { axialModule: dim(ww!.axialModule as CadPartDim, 'worm.axialModule', true), starts: ww!.starts as number, diameter: dim(ww!.diameter as CadPartDim, 'worm.diameter', true), hand: ww!.hand as 'right' | 'left', length: 1, form: 'ZA' },
        teeth: f.teeth as number, faceWidth: b, boreDiameter: bore, toothThicknessReduction: red, ...(f.profileTolerance === undefined ? {} : { profileTolerance: f.profileTolerance as number }) };
      const c = f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center');
      const place: PlacedThroatedWheel = { spec, center: [c[0], c[1]], from: f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from'), rotation: ((f.rotation as number | undefined) ?? 0) * Math.PI / 180 };
      return () => {
        let made: ReturnType<typeof throatedWormWheel>;
        try { made = throatedWormWheel(spec, { id: at }); }
        catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}`); throw cause; }
        const cs = Math.cos(place.rotation), sn = Math.sin(place.rotation);
        const brep = place.rotation || place.center[0] || place.center[1] || place.from ? transformBrep(made!.brep, { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [place.center[0], place.center[1], place.from] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, wormWheel: made!.report, wormWheelPlace: place }] };
      };
    }
    case 'spur-rack': {
      if (f.generator !== undefined && f.generator !== 'spur-rack@0' && f.generator !== 'spur-rack@1') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      const filletedRoot = f.generator === 'spur-rack@1';
      if (!filletedRoot && f.rootFillet !== undefined) fail('INPUT', "rootFillet belongs to a filleted root (generator 'spur-rack@1')");
      const b = dim(f.faceWidth as CadPartDim, 'faceWidth', true), H = dim(f.height as CadPartDim, 'height', true);
      const red = f.thicknessReduction === undefined ? 0 : dim(f.thicknessReduction as CadPartDim, 'thicknessReduction');
      if (f.angle !== undefined && !(typeof f.angle === 'number' && Number.isFinite(f.angle))) fail('INPUT', 'angle must be a number of degrees');
      const mesh = f.mesh as Record<string, unknown> | undefined;
      if (mesh !== undefined && (!isRecord(mesh) || typeof mesh.gear !== 'string')) fail('INPUT', 'mesh must be { gear, direction?, centerDistance?, phase? }');
      const other = mesh === undefined ? undefined : ref(mesh.gear, 'mesh.gear').result;
      const g = other && other.kind === 'solid' && other.parts.length === 1 ? other.parts[0].gearPlace : undefined;
      if (mesh !== undefined && !g) fail('REFERENCE', `${String(mesh.gear)} is not a spur gear`);
      // Its helix: its own (normalModule, helixAngle, hand); meshing, the gear's angle with the opposite hand (the rack
      // as the z → ∞ gear of an external pair), a contrary one given refused.
      const gHelix = g?.spec.helixAngle ? { angle: g.spec.helixAngle, hand: g.spec.hand === 'right' ? 'left' as const : 'right' as const } : null;
      const ownAngle = f.helixAngle as number | undefined, ownHand = f.hand as 'right' | 'left' | undefined;
      if (g && ((ownAngle ?? 0) !== 0 || ownHand !== undefined) && (!gHelix || ownAngle !== gHelix.angle || (ownHand ?? gHelix.hand) !== gHelix.hand))
        fail('INPUT', `[MATE_INCOMPATIBLE] the rack's helix must be ${gHelix ? `${gHelix.angle}° ${gHelix.hand}-hand (the gear's angle, the opposite hand)` : 'none (the gear is straight)'} to mesh with ${String(mesh!.gear)}`);
      const helix = g ? gHelix : ownAngle ? { angle: ownAngle, hand: ownHand as 'right' | 'left' } : null;
      if (helix && f.module !== undefined) fail('INPUT', 'a helical rack takes normalModule (the normal module), not module');
      const mGiven = helix ? f.normalModule : f.module;
      const m = mGiven !== undefined ? dim(mGiven as CadPartDim, helix ? 'normalModule' : 'module', true) : g ? spurGearDimensions(g.spec).mn : dim(undefined as unknown as CadPartDim, 'module', true);
      const spec: SpurRackSpec = { ...(helix ? { normalModule: m, helixAngle: helix.angle, hand: helix.hand } : { module: m }), teeth: f.teeth as number, faceWidth: b, height: H, toothThicknessReduction: red, ...(f.pressureAngle === undefined ? {} : { pressureAngle: f.pressureAngle as number }),
        ...(filletedRoot ? { rootPolicy: 'filleted' as const, ...(f.rootFillet === undefined ? {} : { rootFilletRadius: dim(f.rootFillet as CadPartDim, 'rootFillet', true) }) } : {}) };
      let place: RackPlacement;
      if (mesh !== undefined) {
        const gd = spurGearDimensions(g!.spec);
        if (gd.mn !== m) fail('INPUT', `[MATE_INCOMPATIBLE] module ${m} does not mesh with ${String(mesh.gear)}'s ${gd.mn}`);
        const dirDeg = mesh.direction ?? -90;
        if (!(typeof dirDeg === 'number' && Number.isFinite(dirDeg))) fail('INPUT', 'mesh.direction must be a number of degrees');
        const r = gd.r, D = mesh.centerDistance === undefined ? r + (g!.spec.profileShiftCoefficient ?? 0) * m : dim(mesh.centerDistance as CadPartDim, 'mesh.centerDistance', true);
        const phase = mesh.phase === undefined ? 0 : dim(mesh.phase as CadPartDim, 'mesh.phase');
        // The rack's frame: +x along the pitch line (β = φ + 90°), +y toward the gear; a gap at r θ + phase from the
        // gear's foot, θ the gear's turn from the direction, and the rack's middle gap there. (The direction counted
        // from the nearest whole tooth angle: the same mesh, whole pitches along, the rack's middle at the gear.)
        // Both at the gear's face plane, where the rack starts: the helices agree there.
        const phi = (dirDeg as number) * Math.PI / 180, beta = phi + Math.PI / 2, tooth = 2 * Math.PI / g!.spec.teeth;
        const x0 = r * (g!.rotation - (phi - tooth * Math.round(phi / tooth))) + phase - Math.PI * gd.mt * Math.round((f.teeth as number) / 2);
        const cb = Math.cos(beta), sb = Math.sin(beta);
        place = { spec, origin: [g!.center[0] + cb * x0 + sb * D, g!.center[1] + sb * x0 - cb * D], angle: beta, from: g!.from, meshesWith: String(mesh.gear), driver: g! };
      } else {
        place = { spec, origin: f.origin === undefined ? [0, 0] : xy(f.origin as CadPartPoint2, 'origin'), angle: ((f.angle as number | undefined) ?? 0) * Math.PI / 180, from: f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from') };
      }
      return () => {
        let made: ReturnType<typeof spurRack>;
        try { made = spurRack(spec, { id: at }); }
        catch (cause) { if (isGearError(cause)) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}`); throw cause; }
        const c = Math.cos(place.angle), sn = Math.sin(place.angle);
        const brep = place.angle || place.origin[0] || place.origin[1] || place.from ? transformBrep(made!.brep, { matrix: [c, -sn, 0, sn, c, 0, 0, 0, 1], offset: [place.origin[0], place.origin[1], place.from] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, rack: made!.report, rackPlace: place }] };
      };
    }
  }
  throw new Error(`gearOperation: ${f.kind} is not one of its features`);
}
