/** Realized geometry IR. React owns function components; this compiler only lowers committed descriptors. */
export type RefToken = object;
export type Point2 = readonly [number, number];
export type Point3 = readonly [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export interface Identity {
  key?: string;
  alias?: string;
  bind?: RefToken;
  /** A future reconciler supplies stable committed host identity. */
  identity?: object;
}
export type Rectangle = Identity & { kind: 'rectangle'; min: Point2; max: Point2 };
export type Circle = Identity & { kind: 'circle'; center: Point2; radius: number };
export type Polygon = Identity & { kind: 'polygon'; points: readonly Point2[] };
export type Profile = Rectangle | Circle | Polygon;
export type Extrude = Identity & { kind: 'extrude'; distance: number; from?: number } & (
  | { children: readonly Profile[]; profile?: never }
  | { profile: RefToken; children?: never }
);
export type Revolve = Identity & {kind:'revolve';axis:'x'|'y';angle:number;origin?:Point2} & (
  | {children:readonly Profile[];profile?:never}
  | {profile:RefToken;children?:never}
);
export type Union = Identity & { kind: 'union'; children: readonly Solid[] };
export type SolidRef = { kind: 'solid-ref'; ref: RefToken; key?: string };
export type Target = { kind: 'target'; key?: string } & (
  | { children: readonly Solid[]; solid?: never }
  | { solid: RefToken; children?: never }
);
export interface Tools { kind: 'tools'; children: readonly Solid[]; key?: string }
export type Difference = Identity & { kind: 'difference'; children: readonly (Target | Tools)[] };
export type TransformInput = {children:readonly Solid[];solid?:never}|{solid:RefToken;children?:never};
export type Translate = Identity & {kind:'translate';offset:Point3} & TransformInput;
export type Rotate = Identity & {kind:'rotate';axis:Axis;angle:number;pivot?:Point3} & TransformInput;
export type Solid = Extrude | Revolve | Union | Difference | Translate | Rotate | SolidRef;
export interface Definitions { kind: 'definitions'; children: readonly (Profile | Solid)[]; key?: string }
export interface Part { kind: 'part'; units: 'mm'; children: readonly (Solid | Definitions)[] }
export type Node = Profile | Solid | Target | Tools | Definitions;

export interface BodyRef { node: number; side: 'solid' }
export type NativeNode =
  | { id: string; kind: 'sketch'; profile: 'rectangle'; min: [number, number]; max: [number, number] }
  | { id: string; kind: 'sketch'; profile: 'circle'; center: [number, number]; radius: number }
  | { id: string; kind: 'sketch'; profile: 'polygon'; points: [number, number][] }
  | { id: string; kind: 'extrude'; sketch: number; height: number; from?: number }
  | {id:string;kind:'revolve';sketch:number;axis:'x'|'y';angle:number;origin?:[number,number]}
  | { id: string; kind: 'union'; left: BodyRef; right: BodyRef }
  | { id: string; kind: 'difference'; parent: BodyRef; tool: BodyRef }
  | {id:string;kind:'translate';parent:BodyRef;offset:[number,number,number]}
  | {id:string;kind:'rotate';parent:BodyRef;axis:Axis;angle:number;pivot?:[number,number,number]};
export interface NativeDoc {
  format: 'barocss-cad-model'; schema: 3; units: 'mm'; nextId: number;
  parameters: Record<string, number>; nodes: NativeNode[]; outputs: Record<string, BodyRef>;
}
export type ErrorCode = 'CARDINALITY' | 'TYPE' | 'CYCLE' | 'MISSING_REFERENCE'
  | 'DUPLICATE_BINDING' | 'DUPLICATE_ALIAS' | 'DUPLICATE_KEY' | 'INVALID_PARAMETER'
  | 'EXCLUSIVE_INPUT' | 'UNSUPPORTED_CAPABILITY';
export class IrError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) { super(message); this.name = 'IrError'; this.code = code; }
}
export interface Compiled {
  readonly revision: number;
  readonly doc: NativeDoc;
  readonly fingerprint: string;
  /** Provenance only: UI history need not expose these implementation nodes. */
  readonly sourceIds: Readonly<Record<string, string>>;
}
export type CompileResult = { ok: true; changed: boolean; value: Compiled }
  | { ok: false; error: IrError; previous: Compiled | null };
interface RecordNode { node: Node; path: string }
interface IdRecord { id: string; kind: NativeNode['kind'] }
const fail = (code: ErrorCode, message: string): never => { throw new IrError(code, message); };
const geometric = (kind: string) => ['rectangle', 'circle', 'polygon', 'extrude', 'revolve', 'union', 'difference', 'translate', 'rotate'].includes(kind);
const solid = (kind: string) => ['extrude', 'revolve', 'union', 'difference', 'translate', 'rotate', 'solid-ref'].includes(kind);
const list = (n: Node): readonly Node[] => 'children' in n && n.children !== undefined ? n.children : [];
const pair = (value: Point2): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) fail('INVALID_PARAMETER', 'Two finite coordinates required');
  return [value[0], value[1]];
};
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Compiles inert realized host data. Never evaluates React functions or geometry. */
export class CompositionCompiler {
  private serial = 0;
  private pathIds = new Map<string, IdRecord>();
  private hostIds = new WeakMap<object, Map<string, IdRecord>>();
  private accepted: Compiled | null = null;
  get current(): Compiled | null { return this.accepted; }
  compile(part: Part): CompileResult {
    try {
      if (part.kind !== 'part' || part.units !== 'mm') fail('UNSUPPORTED_CAPABILITY', 'One mm Part required');
      const records = new Map<string, RecordNode>();
      const bindings = new Map<RefToken, RecordNode>();
      const aliases = new Map<string, string>();
      const identities = new Map<object, string>();
      const objectStack = new Set<object>();
      const childrenAt = new Map<string, RecordNode[]>();
      const collectChildren = (children: readonly Node[], path: string): RecordNode[] => {
        const keys = new Set<string>();
        return children.map((node, index) => {
          if (!node || typeof node !== 'object' || typeof node.kind !== 'string') fail('TYPE', 'Expected realized typed host node');
          if (!['rectangle', 'circle', 'polygon', 'extrude', 'revolve', 'union', 'difference', 'translate', 'rotate', 'solid-ref', 'target', 'tools', 'definitions'].includes(node.kind)) {
            fail('UNSUPPORTED_CAPABILITY', `Unsupported geometry capability: ${node.kind}`);
          }
          if (node.key !== undefined) {
            if (keys.has(node.key)) fail('DUPLICATE_KEY', `Duplicate sibling key ${node.key}`);
            keys.add(node.key);
          }
          const segment = node.key === undefined ? `index:${index}` : `key:${JSON.stringify(node.key)}`;
          const at = `${path}/${segment}/${node.kind}`;
          if (objectStack.has(node)) fail('CYCLE', 'Structural geometry tree cycle');
          objectStack.add(node);
          const record = { node, path: at }; records.set(at, record);
          if (geometric(node.kind)) {
            const meta = node as Identity;
            if (meta.identity) {
              if (identities.has(meta.identity)) fail('DUPLICATE_BINDING', 'Committed host identity has multiple owners');
              identities.set(meta.identity, at);
            }
            if (meta.bind !== undefined) {
              if (!meta.bind || typeof meta.bind !== 'object') fail('TYPE', 'Object reference token required');
              if (bindings.has(meta.bind)) fail('DUPLICATE_BINDING', 'Reference token has multiple geometry owners');
              bindings.set(meta.bind, record);
            }
            if (meta.alias !== undefined) {
              if (!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(meta.alias)) fail('INVALID_PARAMETER', 'Invalid optional alias');
              if (aliases.has(meta.alias)) fail('DUPLICATE_ALIAS', `Duplicate Part alias ${meta.alias}`);
              aliases.set(meta.alias, at);
            }
          }
          childrenAt.set(at, collectChildren(list(node), at)); objectStack.delete(node); return record;
        });
      };
      const roots = collectChildren(part.children, 'part');
      const outputs = roots.filter(r => r.node.kind !== 'definitions');
      if (outputs.length !== 1) fail('CARDINALITY', 'Part requires exactly one output outside Definitions');
      if (!solid(outputs[0].node.kind)) fail('TYPE', 'Part output must be a solid');
      let nextSerial = this.serial;
      const stagedPaths = new Map<string, IdRecord>();
      const stagedHosts: { identity: object; suffix: string; record: IdRecord }[] = [];
      const native: NativeNode[] = [], provenance: Record<string, string> = {};
      const states = new Map<string, 'active' | 'done'>(), indices = new Map<string, number>();
      const children = (r: RecordNode): RecordNode[] => childrenAt.get(r.path) ?? [];
      const id = (r: RecordNode, suffix: string, kind: NativeNode['kind']): string => {
        const path = `${r.path}::${suffix}`;
        const identity = (r.node as Identity).identity;
        const old = identity === undefined ? this.pathIds.get(path) : this.hostIds.get(identity)?.get(suffix);
        const record = old?.kind === kind ? old : { id: `n${nextSerial++}`, kind };
        stagedPaths.set(path, record);
        if (identity) stagedHosts.push({ identity, suffix, record });
        provenance[path] = record.id; return record.id;
      };
      const emit = (node: NativeNode): number => { const at = native.length; native.push(node); return at; };
      const body = (index: number): BodyRef => ({ node: index, side: 'solid' });
      const resolve = (token: RefToken): RecordNode => {
        if(token && typeof token==='object' && 'kind' in token && ['face','planar-face','region','selection','sketch-region','open-wire'].includes(String(token.kind)))
          return fail('UNSUPPORTED_CAPABILITY','This extrusion source capability is not admitted; use a closed profile producer or its profile reference');
        return bindings.get(token) ?? fail('MISSING_REFERENCE', 'Unresolved geometry token in this Part');
      };
      const exactlyOne = (items: RecordNode[], label: string): RecordNode => {
        if (items.length !== 1) fail('CARDINALITY', `${label} requires one output`); return items[0];
      };
      const input = (r: RecordNode, field: 'profile' | 'solid'): RecordNode => {
        const n = r.node as Extrude | Revolve | Target | Translate | Rotate;
        const token = field in n ? (n as unknown as Record<string, RefToken>)[field] : undefined;
        const hasChildren = 'children' in n && n.children !== undefined;
        if ((token !== undefined) === hasChildren) fail('EXCLUSIVE_INPUT', `Supply ${field} reference OR children`);
        return token === undefined ? exactlyOne(children(r), field) : resolve(token);
      };
      const lower = (r: RecordNode, expected: 'profile' | 'solid'): number => {
        const n = r.node;
        if (n.kind === 'solid-ref') {
          if (expected !== 'solid') fail('TYPE', 'Solid reference cannot be used as a profile producer');
          return lower(resolve(n.ref), 'solid');
        }
        const actual = n.kind === 'rectangle' || n.kind === 'circle' || n.kind === 'polygon' ? 'profile' : solid(n.kind) ? 'solid' : 'slot';
        if (actual !== expected) fail('TYPE', `Expected ${expected}, received ${actual}`);
        if (states.get(r.path) === 'active') fail('CYCLE', 'Geometry reference cycle');
        if (states.get(r.path) === 'done') return indices.get(r.path)!;
        states.set(r.path, 'active');
        let index: number;
        switch (n.kind) {
          case 'rectangle': {
            const min = pair(n.min), max = pair(n.max);
            if (!(max[0] > min[0] && max[1] > min[1])) fail('INVALID_PARAMETER', 'Rectangle needs positive extents');
            index = emit({ id: id(r, 'region', 'sketch'), kind: 'sketch', profile: 'rectangle', min, max }); break;
          }
          case 'circle':
            if (!Number.isFinite(n.radius) || n.radius <= 0) fail('INVALID_PARAMETER', 'Positive finite radius required');
            index = emit({ id: id(r, 'region', 'sketch'), kind: 'sketch', profile: 'circle', center: pair(n.center), radius: n.radius }); break;
          case 'polygon': {
            if (!Array.isArray(n.points) || n.points.length < 3 || n.points.length > 1024) {
              fail('INVALID_PARAMETER', 'Polygon requires 3 to 1024 points');
            }
            const points: [number, number][] = [];
            for (let i = 0; i < n.points.length; i++) {
              if (!Object.hasOwn(n.points, i)) fail('INVALID_PARAMETER', 'Polygon points must be dense finite coordinate pairs');
              const point = n.points[i];
              if (!Array.isArray(point) || point.length !== 2 || !Object.hasOwn(point, 0) || !Object.hasOwn(point, 1)
                || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
                fail('INVALID_PARAMETER', 'Polygon points must be dense finite coordinate pairs');
              }
              points.push([point[0], point[1]]);
            }
            index = emit({ id: id(r, 'region', 'sketch'), kind: 'sketch', profile: 'polygon', points }); break;
          }
          case 'extrude': {
            const sketch = lower(input(r, 'profile'), 'profile');
            if (!Number.isFinite(n.distance) || n.distance === 0 || !Number.isFinite(n.from ?? 0)) fail('INVALID_PARAMETER', 'Finite nonzero extrusion distance required');
            index = emit({ id: id(r, 'solid', 'extrude'), kind: 'extrude', sketch, height: n.distance,
              ...(n.from === undefined ? {} : { from: n.from }) }); break;
          }
          case 'revolve': {
            const sketch=lower(input(r,'profile'),'profile');
            if((n.axis!=='x'&&n.axis!=='y')||!Number.isFinite(n.angle)||!(n.angle>0&&n.angle<=360)) fail('INVALID_PARAMETER','Revolve requires sketch x/y axis and finite angle in (0,360]');
            if(n.origin!==undefined&&(!Array.isArray(n.origin)||n.origin.length!==2||!Number.isFinite(n.origin[0])||!Number.isFinite(n.origin[1]))) fail('INVALID_PARAMETER','Revolve origin requires two finite mm coordinates');
            index=emit({id:id(r,'solid','revolve'),kind:'revolve',sketch,axis:n.axis,angle:n.angle,...(n.origin===undefined?{}:{origin:[...n.origin] as [number,number]})});break;
          }
          case 'translate': {
            const parent=lower(input(r,'solid'),'solid');
            if(!Array.isArray(n.offset)||n.offset.length!==3||!Number.isFinite(n.offset[0])||!Number.isFinite(n.offset[1])||!Number.isFinite(n.offset[2])) fail('INVALID_PARAMETER','Translate offset requires three finite mm coordinates');
            index=emit({id:id(r,'solid','translate'),kind:'translate',parent:body(parent),offset:[...n.offset]});break;
          }
          case 'rotate': {
            const parent=lower(input(r,'solid'),'solid');
            if(!['x','y','z'].includes(n.axis)||!Number.isFinite(n.angle)||Math.abs(n.angle)>3600) fail('INVALID_PARAMETER','Rotate requires an axis and finite angle within the existing native limit');
            if(n.pivot!==undefined&&(!Array.isArray(n.pivot)||n.pivot.length!==3||!Number.isFinite(n.pivot[0])||!Number.isFinite(n.pivot[1])||!Number.isFinite(n.pivot[2]))) fail('INVALID_PARAMETER','Rotate pivot requires three finite mm coordinates');
            index=emit({id:id(r,'solid','rotate'),kind:'rotate',parent:body(parent),axis:n.axis,angle:n.angle,...(n.pivot===undefined?{}:{pivot:[...n.pivot] as [number,number,number]})});break;
          }
          case 'union': {
            const operands = children(r);
            if (operands.length < 2) fail('CARDINALITY', 'Union requires at least two solid operands');
            let acc = lower(operands[0], 'solid');
            for (const [offset, operand] of operands.slice(1).entries()) {
              const right = lower(operand, 'solid');
              const suffix = offset === operands.length - 2 ? 'solid' : `join:${operand.path}`;
              acc = emit({ id: id(r, suffix, 'union'), kind: 'union', left: body(acc), right: body(right) });
            }
            index = acc; break;
          }
          case 'difference': {
            const slots = children(r), targets = slots.filter(x => x.node.kind === 'target'), tools = slots.filter(x => x.node.kind === 'tools');
            if (targets.length !== 1 || tools.length !== 1 || slots.length !== 2) fail('CARDINALITY', 'Difference requires one Target and one Tools slot');
            let acc = lower(input(targets[0], 'solid'), 'solid');
            const operands = children(tools[0]);
            if (!operands.length) fail('CARDINALITY', 'Tools requires at least one solid');
            for (const [offset, operand] of operands.entries()) {
              const tool = lower(operand, 'solid');
              const suffix = offset === operands.length - 1 ? 'solid' : `cut:${operand.path}`;
              acc = emit({ id: id(r, suffix, 'difference'), kind: 'difference', parent: body(acc), tool: body(tool) });
            }
            index = acc; break;
          }
          default: return fail('TYPE', 'Unsupported geometry output');
        }
        indices.set(r.path, index); states.set(r.path, 'done'); return index;
      };
      const output = lower(outputs[0], 'solid');
      const doc: NativeDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', nextId: nextSerial,
        parameters: {}, nodes: native, outputs: { result: body(output) } };
      const fingerprint = JSON.stringify(doc);
      const unchanged = this.accepted?.fingerprint === fingerprint;
      const sameProvenance = unchanged && JSON.stringify(this.accepted!.sourceIds) === JSON.stringify(provenance);
      const accepted = sameProvenance ? this.accepted! : freeze({
        revision: unchanged ? this.accepted!.revision : (this.accepted?.revision ?? 0) + 1,
        doc: unchanged ? this.accepted!.doc : doc, fingerprint, sourceIds: provenance,
      });
      this.pathIds = stagedPaths;
      for (const { identity, suffix, record } of stagedHosts) {
        let records = this.hostIds.get(identity);
        if (!records) { records = new Map(); this.hostIds.set(identity, records); }
        records.set(suffix, record);
      }
      this.serial = nextSerial; this.accepted = accepted;
      return { ok: true, changed: !unchanged, value: accepted };
    } catch (error) {
      if (!(error instanceof IrError)) throw error;
      return { ok: false, error, previous: this.accepted };
    }
  }
}
