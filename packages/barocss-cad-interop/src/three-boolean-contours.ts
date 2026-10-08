import { validateCoplanarFaceBoolean } from '@barocss/cad';
import type { CoplanarFaceBooleanContributor, CoplanarFaceBooleanResult } from '@barocss/cad';
import { Group, Line } from 'three';
import { validateBaroCadParseOptions } from './native.js';
import type { BaroCadParseOptions } from './native.js';
import { BaroCADLoader } from './three.js';
import type { BaroCadThreeResult } from './three.js';

export interface BaroCadBooleanThreeContourOptions {
  native: BaroCadParseOptions;
  /** Host assertion that authored XYZ matches the right-handed Y-up Scene. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadBooleanThreeContourBinding {
  readonly operation: CoplanarFaceBooleanResult['report']['operation'];
  readonly evaluationId: string;
  readonly componentId: string;
  readonly loopId: string;
  readonly loopRole: 'outer' | 'hole';
  readonly fragmentId: string;
  readonly source: Readonly<{ assetId: string; curveId: string; objectIndex: number }>;
  readonly contributor: Readonly<CoplanarFaceBooleanContributor>;
  readonly interval: Readonly<[number, number]>;
  readonly traversalInterval: Readonly<[number, number]>;
  readonly sense: 'forward' | 'reverse';
  /** Native dimensionless pcurve metadata; it is never rendered as world geometry. */
  readonly pcurve: Readonly<{ id: string; domain: Readonly<[number, number]>; lengthUnit: 'dimensionless' }>;
  readonly line: Line;
}

export interface BaroCadBooleanThreeContourResult {
  readonly root: Group;
  readonly componentGroups: ReadonlyArray<Group>;
  readonly loopGroups: ReadonlyArray<Group>;
  readonly bindings: ReadonlyArray<BaroCadBooleanThreeContourBinding>;
  /** Releases only adapter-owned Three objects and display resources. */
  dispose(): void;
}

function ownOptions(input: BaroCadBooleanThreeContourOptions): BaroCadBooleanThreeContourOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Boolean Three options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['native', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      !fields.native || !fields.basis || fields.basis.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Boolean Three options require native and an explicit matching Y-up basis');
  }
  const native = validateBaroCadParseOptions(fields.native.value);
  if (native.curveDisplay === undefined || !('version' in native.curveDisplay)) {
    throw new RangeError('Boolean Three contours require Curve display version 1');
  }
  return { native, basis: fields.basis.value };
}

/** Display original world Curve fragments grouped by native Boolean component and loop. */
export function createBaroCadBooleanThreeContours(
  result: CoplanarFaceBooleanResult, options: BaroCadBooleanThreeContourOptions,
): BaroCadBooleanThreeContourResult {
  validateCoplanarFaceBoolean(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const root = new Group();
  root.name = owned.options.evaluationId;
  const staged: BaroCadThreeResult[] = [];
  const componentGroups: Group[] = [];
  const loopGroups: Group[] = [];
  const bindings: BaroCadBooleanThreeContourBinding[] = [];
  const release = () => {
    root.removeFromParent();
    for (const loaded of staged) loaded.dispose();
    for (const loop of loopGroups) loop.clear();
    for (const component of componentGroups) component.clear();
    root.clear();
  };
  try {
    const used = new Set<string>();
    for (const component of owned.components) {
      const componentGroup = new Group();
      componentGroup.name = component.id;
      root.add(componentGroup);
      componentGroups.push(componentGroup);
      for (const loopId of [component.outerLoopId, ...component.holeLoopIds]) {
        const loop = owned.loops.find(value => value.id === loopId);
        if (!loop || loop.componentId !== component.id ||
            loop.role !== (loopId === component.outerLoopId ? 'outer' : 'hole')) {
          throw new RangeError('Boolean Three loop differs from native component');
        }
        const loopGroup = new Group();
        loopGroup.name = loop.id;
        componentGroup.add(loopGroup);
        loopGroups.push(loopGroup);
        for (const fragmentId of loop.fragmentIds) {
          const fragment = owned.fragments.find(value => value.id === fragmentId);
          const source = fragment && owned.sources.find(value => value.id === fragment.source.assetId);
          const object = fragment && source?.model.objects[fragment.source.objectIndex];
          if (!fragment || !source || !object || object.kind !== 'curve' ||
              object.id !== fragment.source.curveId || used.has(fragment.id)) {
            throw new RangeError('Boolean Three fragment differs from native source Curve');
          }
          const loaded = new BaroCADLoader(request.native).parse(fragment.extraction.source);
          staged.push(loaded);
          const line = loaded.group.children[0];
          if (loaded.source !== fragment.extraction.source ||
              loaded.model.name !== fragment.extraction.model.name ||
              loaded.model.objects.length !== 1 || loaded.model.objects[0].kind !== 'curve' ||
              loaded.model.objects[0].id !== fragment.source.curveId ||
              !(line instanceof Line) || loaded.group.children.length !== 1 ||
              line.name !== fragment.source.curveId ||
              line.userData?.barocss?.curveId !== fragment.source.curveId) {
            throw new RangeError('Boolean Three extracted Curve differs from native fragment');
          }
          used.add(fragment.id);
          loopGroup.add(line);
          bindings.push(Object.freeze({
            operation: owned.report.operation, evaluationId: owned.options.evaluationId,
            componentId: component.id, loopId: loop.id, loopRole: loop.role,
            fragmentId: fragment.id, source: Object.freeze({ ...fragment.source }),
            contributor: Object.freeze({ ...fragment.contributor }),
            interval: Object.freeze([...fragment.interval]) as Readonly<[number, number]>,
            traversalInterval: Object.freeze([...fragment.traversalInterval]) as Readonly<[number, number]>,
            sense: fragment.sense,
            pcurve: Object.freeze({ id: fragment.pcurve.id,
              domain: Object.freeze([...fragment.pcurve.domain]) as Readonly<[number, number]>,
              lengthUnit: fragment.pcurve.lengthUnit }),
            line,
          }));
        }
      }
    }
    if (used.size !== owned.fragments.length || bindings.length !== owned.report.selectedFragmentCount) {
      throw new RangeError('Boolean Three did not display every selected native fragment');
    }
    let disposed = false;
    return Object.freeze({ root, componentGroups: Object.freeze(componentGroups),
      loopGroups: Object.freeze(loopGroups), bindings: Object.freeze(bindings), dispose() {
        if (disposed) return;
        disposed = true;
        release();
      } });
  } catch (error) {
    release();
    throw error;
  }
}
