/** Real ordinary React realization. Hidden DOM markers own ordering, not rendering. */
import * as React from 'react';
import { CompositionCompiler, IrError, type Part as PartIR, type Node as NodeIR,
  type Compiled, type Point2, type Point3, type Axis } from './compiler.js';

export interface ModelLifecycle {
  dirty(): void;
  invalid(error: unknown): void;
  complete(model: Compiled): void;
  detached(): void;
}
type Kind = 'part' | 'rectangle' | 'circle' | 'polygon' | 'extrude' | 'revolve' | 'union' | 'difference' | 'target' | 'tools' | 'definitions' | 'translate' | 'rotate';
export interface ProfileHandle { readonly kind: 'rectangle' | 'circle' | 'polygon' }
export interface SolidHandle { readonly kind: 'extrude' | 'revolve' | 'union' | 'difference' | 'translate' | 'rotate' }
export type ProfileRef = React.RefObject<ProfileHandle | null>;
export type SolidRef = React.RefObject<SolidHandle | null>;
type CadRef = React.RefObject<ProfileHandle | SolidHandle | null>;
interface Entry { binding?: CadRef; token: object; parent: object | null; kind: Kind; props: Record<string, unknown>; marker: HTMLElement; lease: number; key: string }
class Session {
  private compiler = new CompositionCompiler();
  private entries = new Map<object, Entry>();
  private keys = new WeakMap<object, string>();
  private serial = 0;
  private lease = 0;
  private queued = false;
  private dirty = false;
  private active = false;
  private lifecycle: ModelLifecycle | null = null;
  configure(lifecycle: ModelLifecycle) {
    if (this.lifecycle && this.lifecycle !== lifecycle) this.lifecycle.detached();
    this.lifecycle = lifecycle;
    if (this.dirty) lifecycle.dirty();
  }
  activate() { this.active = true; this.queue(); }
  retire() { this.active = false; this.lifecycle?.detached(); }
  attach(token: object, parent: object | null, kind: Kind, props: Record<string, unknown>, marker: HTMLElement, binding?: CadRef) {
    let key = this.keys.get(token); if (!key) { key = `host${this.serial++}`; this.keys.set(token, key); }
    const entry = { token, parent, kind, props, marker, key, binding, lease: ++this.lease };
    this.entries.set(token, entry); this.queue();
    return () => { if (this.entries.get(token)?.lease === entry.lease) { this.entries.delete(token); this.queue(); } };
  }
  private queue() {
    if (!this.dirty) { this.dirty = true; this.lifecycle?.dirty(); }
    if (this.queued) return;
    this.queued = true; queueMicrotask(() => { this.queued = false; this.flush(); });
  }
  private build(): PartIR {
    const roots = [...this.entries.values()].filter(e => e.kind === 'part' && e.parent === null && e.marker.isConnected);
    if (roots.length !== 1) throw new IrError('CARDINALITY', 'One live Part root required');
    const root=roots[0];
    if(root.props.admission !== 'synchronous') throw new IrError('UNSUPPORTED_CAPABILITY','Part requires explicit synchronous admission');
    if(root.props.unsupported) throw root.props.unsupported;
    for(const e of this.entries.values()) {
      if(e===root) continue;
      if(!e.marker.isConnected) throw new IrError('UNSUPPORTED_CAPABILITY','Registered CAD geometry is disconnected from the committed Part');
      const parent=e.parent ? this.entries.get(e.parent) : undefined;
      if(!parent || !parent.marker.contains(e.marker)) throw new IrError('UNSUPPORTED_CAPABILITY','Portaled or disconnected CAD geometry is not supported');
    }
    const children = (parent: Entry) => [...this.entries.values()]
      .filter(e => e.parent === parent.token && e.marker.isConnected && parent.marker.contains(e.marker))
      .sort((a, b) => a.marker.compareDocumentPosition(b.marker) & 4 ? -1 : 1);
    const node = (entry: Entry): NodeIR => {
      const p = entry.props, nested = children(entry).map(node), meta = { key: entry.key, identity: entry.token, ...(entry.binding ? {bind:entry.binding} : {}) };
      switch (entry.kind) {
        case 'rectangle': return { ...meta, kind: 'rectangle', min: p.min as Point2, max: p.max as Point2 };
        case 'polygon': return { ...meta, kind: 'polygon', points: p.points as readonly Point2[] };
        case 'circle': return { ...meta, kind: 'circle', center: p.center as Point2, radius: p.radius as number };
        case 'revolve': return {...meta,kind:entry.kind,axis:p.axis,angle:p.angle,...(p.origin===undefined?{}:{origin:p.origin}),...(p.profile===undefined?{children:nested}:{profile:p.profile,...(nested.length?{children:nested}:{})})} as NodeIR;
        case 'extrude': return { ...meta, kind: 'extrude', distance: p.distance as number,
          ...(p.from === undefined ? {} : { from: p.from as number }),
          ...(p.profile === undefined ? {children:nested} : {profile:p.profile,...(nested.length ? {children:nested} : {})}) } as NodeIR;
        case 'translate': case 'rotate': return {...meta,kind:entry.kind,...(entry.kind==='translate'?{offset:p.offset}:{axis:p.axis,angle:p.angle,...(p.pivot===undefined?{}:{pivot:p.pivot})}),...(p.solid===undefined?{children:nested}:{solid:p.solid,...(nested.length?{children:nested}:{})})} as NodeIR;
        case 'union': return { ...meta, kind: 'union', children: nested } as NodeIR;
        case 'difference': return { ...meta, kind: 'difference', children: nested } as NodeIR;
        case 'target': return { kind: 'target', key: entry.key, ...(p.solid === undefined ? {children:nested} : {solid:p.solid,...(nested.length ? {children:nested} : {})}) } as NodeIR;
        case 'definitions': return {kind:'definitions',key:entry.key,children:nested} as NodeIR;
        case 'tools': return { kind: 'tools', key: entry.key, children: nested } as NodeIR;
        default: throw new IrError('TYPE', 'Nested Part unsupported');
      }
    };
    return { kind: 'part', units: root.props.units as 'mm', children: children(roots[0]).map(node) as PartIR['children'] };
  }
  private flush() {
    if (!this.active || !this.lifecycle) return;
    this.dirty = false;
    try {
      const result = this.compiler.compile(this.build());
      if (!result.ok) this.lifecycle.invalid(result.error);
      else this.lifecycle.complete(result.value); // also confirm unchanged checkpoints
    } catch (error) { this.lifecycle.invalid(error); }
  }
}
/** Check only descriptors already supplied by the author; never invoke function components.
 * A wrapper can hide a Suspense boundary. Explicit synchronous admission excludes that case. */
function unsupportedChild(children:React.ReactNode):IrError|undefined {
  for(const child of React.Children.toArray(children)) {
    if(!React.isValidElement<{children?:React.ReactNode}>(child)) {
      if(child && typeof child==='object') return new IrError('UNSUPPORTED_CAPABILITY','Portals are not supported in a CAD Part');
      continue;
    }
    const type=child.type as unknown;
    if(type===Part || type===React.Suspense || (typeof type==='symbol' && type!==(React.Fragment as unknown) && type!==(React.StrictMode as unknown))
      || (type && typeof type==='object' && '$$typeof' in type && type.$$typeof===Symbol.for('react.lazy'))) {
      return new IrError('UNSUPPORTED_CAPABILITY','Suspense, lazy and hidden async boundaries are not supported in a synchronous CAD Part');
    }
    const nested=unsupportedChild(child.props.children);if(nested)return nested;
  }
}
const SessionContext = React.createContext<Session | null>(null);
const ParentContext = React.createContext<object | null>(null);
export function Part({ lifecycle, admission, units='mm', children }: { lifecycle: ModelLifecycle; admission:'synchronous'; units?:'mm'; children: React.ReactNode }) {
  const [session] = React.useState(() => new Session());
  const token = React.useRef(null), marker = React.useRef<HTMLSpanElement | null>(null);
  React.useLayoutEffect(() => {
    session.configure(lifecycle);
    if (!marker.current) throw new Error('Part marker missing');
    return session.attach(token, null, 'part', {admission,units,unsupported:unsupportedChild(children)}, marker.current);
  });
  React.useLayoutEffect(() => { session.activate(); return () => session.retire(); }, [session]);
  return <SessionContext.Provider value={session}><ParentContext.Provider value={token}>
    <span hidden ref={marker}>{children}</span>
  </ParentContext.Provider></SessionContext.Provider>;
}
function Host({ kind, props, binding, children }: { kind: Exclude<Kind, 'part'>; props: Record<string, unknown>; binding?: CadRef; children?: React.ReactNode }) {
  const session = React.useContext(SessionContext), parent = React.useContext(ParentContext);
  const token = React.useRef(null), marker = React.useRef<HTMLSpanElement | null>(null);
  if (!session || !parent) throw new Error('Geometry needs Part');
  React.useLayoutEffect(() => {
    if (!marker.current) throw new Error('Geometry marker missing');
    return session.attach(token, parent, kind, props, marker.current, binding);
  });
  React.useImperativeHandle(binding ?? null, () => ({kind}) as ProfileHandle | SolidHandle, [kind]);
  return <ParentContext.Provider value={token}><span hidden ref={marker}>{children}</span></ParentContext.Provider>;
}
export function Rectangle({ref,...props}: {min:Point2;max:Point2;ref?:ProfileRef}) { return <Host kind="rectangle" props={props} binding={ref}/>; }
export function Circle({ref,...props}: {center:Point2;radius:number;ref?:ProfileRef}) { return <Host kind="circle" props={props} binding={ref}/>; }
export interface PolygonProps { points: readonly Point2[]; ref?: ProfileRef }
export function Polygon({ref,...props}: PolygonProps) { return <Host kind="polygon" props={props} binding={ref}/>; }
export type ExtrudeProps = {distance:number;from?:number;ref?:SolidRef} & ({children:React.ReactNode;profile?:never}|{profile:ProfileRef;children?:never});
export function Extrude({ref,children,...props}:ExtrudeProps) {return <Host kind="extrude" props={props} binding={ref}>{children}</Host>;}
export function Union({ref,children}:{ref?:SolidRef;children:React.ReactNode}) {return <Host kind="union" props={{}} binding={ref}>{children}</Host>;}
export function Difference({ref,children}:{ref?:SolidRef;children:React.ReactNode}) {return <Host kind="difference" props={{}} binding={ref}>{children}</Host>;}
export type TargetProps = {children:React.ReactNode;solid?:never}|{solid:SolidRef;children?:never};
export function Target({children,...props}:TargetProps) {return <Host kind="target" props={props}>{children}</Host>;}
export function Tools({children}:{children:React.ReactNode}) {return <Host kind="tools" props={{}}>{children}</Host>;}
export function Definitions({children}:{children:React.ReactNode}) {return <Host kind="definitions" props={{}}>{children}</Host>;}

export type SolidInput = {children:React.ReactNode;solid?:never}|{solid:SolidRef;children?:never};
export type TranslateProps={offset:Point3;ref?:SolidRef}&SolidInput;
export type RotateProps={axis:Axis;angle:number;pivot?:Point3;ref?:SolidRef}&SolidInput;
export function Translate({ref,children,...props}:TranslateProps){return <Host kind="translate" props={props} binding={ref}>{children}</Host>;}
export function Rotate({ref,children,...props}:RotateProps){return <Host kind="rotate" props={props} binding={ref}>{children}</Host>;}

export type RevolveProps={axis:'x'|'y';angle:number;origin?:Point2;ref?:SolidRef}&({children:React.ReactNode;profile?:never}|{profile:ProfileRef;children?:never});
export function Revolve({ref,children,...props}:RevolveProps){return <Host kind="revolve" props={props} binding={ref}>{children}</Host>;}
