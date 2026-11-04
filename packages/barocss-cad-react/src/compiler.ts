/** Realized geometry IR. React owns function components; this compiler only lowers committed descriptors. */
import {loopOf} from '@barocss/cad-model/sketch/loops';
import type {LoopSegment as ModelLoopSegment,SketchNode as ModelSketchNode} from '@barocss/cad-model/engine/doc';
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
export type LineSegment = {kind:'line-segment';key?:string;start:Point2};
export type ArcSegment = {kind:'arc-segment';key?:string;start:Point2;center:Point2;direction:'ccw'|'cw'};
export type Segment = LineSegment | ArcSegment;
export type Loop = Identity & {kind:'loop';children:readonly Segment[]};
export type Outer = {kind:'outer';key?:string} & ({children:readonly Profile[];profile?:never}|{profile:RefToken;children?:never});
export type Voids = {kind:'voids';key?:string} & ({children:readonly Profile[];profiles?:never}|{profiles:readonly RefToken[];children?:never});
export type ProfileComposition = Identity & {kind:'profile';children:readonly (Outer|Voids)[]};
export type Profile = Rectangle | Circle | Polygon | Loop | ProfileComposition;
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
export type Node = Profile | Solid | Target | Tools | Definitions | Outer | Voids | Segment;

export interface BodyRef { node: number; side: 'solid' }
type ProfileData = (
  | {profile:'rectangle';min:[number,number];max:[number,number]}
  | {profile:'circle';center:[number,number];radius:number}
  | {profile:'polygon';points:[number,number][]}
  | {profile:'loop';segments:ModelLoopSegment[]}
) & {holes?:ModelLoopSegment[][]};
export type NativeNode =
  | ({id:string;kind:'sketch'} & ProfileData)
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
const profileKind = (kind:string) => ['rectangle','circle','polygon','loop','profile'].includes(kind);
const geometric = (kind: string) => ['rectangle', 'circle', 'polygon', 'loop', 'profile', 'extrude', 'revolve', 'union', 'difference', 'translate', 'rotate'].includes(kind);
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
        if (!Array.isArray(children)) fail('TYPE', 'Realized children must be a dense own array');
        for (let i=0;i<children.length;i++) if (!Object.hasOwn(children,i)) fail('TYPE', 'Realized children must be a dense own array');
        const keys = new Set<string>();
        return children.map((node, index) => {
          if (!node || typeof node !== 'object' || typeof node.kind !== 'string') fail('TYPE', 'Expected realized typed host node');
          if (!['rectangle', 'circle', 'polygon', 'loop', 'profile', 'outer', 'voids', 'line-segment', 'arc-segment', 'extrude', 'revolve', 'union', 'difference', 'translate', 'rotate', 'solid-ref', 'target', 'tools', 'definitions'].includes(node.kind)) {
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
        const n = r.node as Extrude | Revolve | Target | Translate | Rotate | Outer;
        const token = field in n ? (n as unknown as Record<string, RefToken>)[field] : undefined;
        const hasChildren = 'children' in n && n.children !== undefined;
        if ((token !== undefined) === hasChildren) fail('EXCLUSIVE_INPUT', `Supply ${field} reference OR children`);
        return token === undefined ? exactlyOne(children(r), field) : resolve(token);
      };
      // Descriptor resolution allocates no IDs and emits no native sketch.
      const described = new Map<string,ProfileData>(), profileStates = new Map<string,'active'|'done'>();
      const strictPair = (value:unknown):[number,number] => {
        if(!Array.isArray(value)||value.length!==2||!Object.hasOwn(value,0)||!Object.hasOwn(value,1)||!Number.isFinite(value[0])||!Number.isFinite(value[1])) return fail('INVALID_PARAMETER','Dense finite local XY coordinate pair required');
        return [value[0],value[1]];
      };
      const singleLoop = (data:ProfileData):ProfileData => {
        if(data.holes?.length) fail('UNSUPPORTED_CAPABILITY','Outer and Voids require single-loop sources without holes');
        switch(data.profile){
          case 'rectangle':strictPair(data.min);strictPair(data.max);break;
          case 'circle':strictPair(data.center);break;
          case 'polygon':for(const point of data.points)strictPair(point);break;
          case 'loop':for(const segment of data.segments){strictPair(segment.start);if(segment.kind==='arc')strictPair(segment.center);}break;
        }
        return data;
      };
      const copiedLoop = (data:ProfileData):ModelLoopSegment[] => {
        singleLoop(data);const copied:ModelLoopSegment[]=[];
        // Existing Model helper performs exact primitive-to-loop conversion, never sampled outlines.
        for(const segment of loopOf({kind:'sketch',...data} as ModelSketchNode)){
          copied.push(segment.kind==='line'?{kind:'line',start:strictPair(segment.start)}:{kind:'arc',start:strictPair(segment.start),center:strictPair(segment.center),direction:segment.direction});
        }
        return copied;
      };
      const readProfile = (r:RecordNode):ProfileData => {
        const n=r.node;if(!profileKind(n.kind))return fail('TYPE','Closed profile producer required');
        if(profileStates.get(r.path)==='active')return fail('CYCLE','Profile descriptor reference cycle');
        if(profileStates.get(r.path)==='done')return described.get(r.path)!;
        profileStates.set(r.path,'active');let data:ProfileData;
        switch(n.kind){
          case 'rectangle':{
            const min=pair(n.min),max=pair(n.max);if(!(max[0]>min[0]&&max[1]>min[1]))fail('INVALID_PARAMETER','Rectangle needs positive extents');data={profile:'rectangle',min,max};break;
          }
          case 'circle':{
            if(!Number.isFinite(n.radius)||n.radius<=0)fail('INVALID_PARAMETER','Positive finite radius required');data={profile:'circle',center:pair(n.center),radius:n.radius};break;
          }
          case 'polygon':{
            if(!Array.isArray(n.points)||n.points.length<3||n.points.length>1024)fail('INVALID_PARAMETER','Polygon requires 3 to 1024 points');const points:[number,number][]=[];
            for(let i=0;i<n.points.length;i++){
              if(!Object.hasOwn(n.points,i))fail('INVALID_PARAMETER','Polygon points must be dense finite coordinate pairs');const point=n.points[i];
              if(!Array.isArray(point)||point.length!==2||!Object.hasOwn(point,0)||!Object.hasOwn(point,1)||!Number.isFinite(point[0])||!Number.isFinite(point[1]))fail('INVALID_PARAMETER','Polygon points must be dense finite coordinate pairs');points.push([point[0],point[1]]);
            }
            data={profile:'polygon',points};break;
          }
          case 'loop':{
            const entries=children(r);if(entries.length<1||entries.length>1024)fail('CARDINALITY','Loop requires 1 to 1024 segment descriptors');const segments:ModelLoopSegment[]=[];
            for(let i=0;i<entries.length;i++){if(!Object.hasOwn(entries,i))fail('TYPE','Loop segment list must be dense');const entry=entries[i],segment=entry.node;if(children(entry).length)fail('CARDINALITY','Loop segments cannot contain geometry');
              if(segment.kind==='line-segment')segments.push({kind:'line',start:strictPair(segment.start)});
              else if(segment.kind==='arc-segment'){
                if(segment.direction!=='ccw'&&segment.direction!=='cw')fail('INVALID_PARAMETER','ArcSegment direction must be ccw or cw');segments.push({kind:'arc',start:strictPair(segment.start),center:strictPair(segment.center),direction:segment.direction});
              }else fail('TYPE','Loop accepts LineSegment and ArcSegment descriptors only');
            }
            data={profile:'loop',segments};break;
          }
          case 'profile':{
            const slots=children(r),outers=slots.filter(s=>s.node.kind==='outer'),voids=slots.filter(s=>s.node.kind==='voids');
            if(outers.length!==1||voids.length>1||slots.length!==1+voids.length)fail('CARDINALITY','Profile requires one Outer and at most one Voids');
            const outer=singleLoop(readProfile(input(outers[0],'profile')));data={...outer};
            if(voids.length){
              const group=voids[0],node=group.node as Voids,hasRefs='profiles'in node&&node.profiles!==undefined,hasChildren='children'in node&&node.children!==undefined;
              if(hasRefs===hasChildren)fail('EXCLUSIVE_INPUT','Supply Voids profiles references OR children');let sources:RecordNode[];
              if(hasRefs){
                const refs=node.profiles;if(!Array.isArray(refs)||refs.length<1||refs.length>64)fail('CARDINALITY','Voids requires 1 to 64 single-loop sources');sources=[];
                for(let i=0;i<refs.length;i++){if(!Object.hasOwn(refs,i))fail('MISSING_REFERENCE','Voids reference list must be dense');sources.push(resolve(refs[i]));}
              }else sources=children(group);
              if(sources.length<1||sources.length>64)fail('CARDINALITY','Voids requires 1 to 64 single-loop sources');const holes:ModelLoopSegment[][]=[];
              for(let i=0;i<sources.length;i++){if(!Object.hasOwn(sources,i))fail('TYPE','Voids child list must be dense');holes.push(copiedLoop(readProfile(sources[i])));}data={...outer,holes};
            }
            break;
          }
          default:return fail('TYPE','Closed profile producer required');
        }
        described.set(r.path,data);profileStates.set(r.path,'done');return data;
      };
      const materializeProfile = (r:RecordNode):number => {
        const have=indices.get(r.path);if(have!==undefined)return have;
        const data=readProfile(r),index=emit({id:id(r,'region','sketch'),kind:'sketch',...data});indices.set(r.path,index);return index;
      };
      const lower = (r: RecordNode, expected: 'profile' | 'solid'): number => {
        const n = r.node;
        if (n.kind === 'solid-ref') {
          if (expected !== 'solid') fail('TYPE', 'Solid reference cannot be used as a profile producer');
          return lower(resolve(n.ref), 'solid');
        }
        const actual = profileKind(n.kind) ? 'profile' : solid(n.kind) ? 'solid' : 'slot';
        if (actual !== expected) fail('TYPE', `Expected ${expected}, received ${actual}`);
        if(expected==='profile')return materializeProfile(r);
        if (states.get(r.path) === 'active') fail('CYCLE', 'Geometry reference cycle');
        if (states.get(r.path) === 'done') return indices.get(r.path)!;
        states.set(r.path, 'active');
        let index: number;
        switch (n.kind) {
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
