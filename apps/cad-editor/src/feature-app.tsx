import { useEffect, useRef, useState } from 'react';
import { Box, Download, FolderOpen, Layers3, Maximize, Redo2, Undo2 } from 'lucide-react';
import { parseBooleanExtrusionFeatureGraph, type BooleanExtrusionExtrusionFeature, type BooleanExtrusionLengthDefinition,
  type BooleanExtrusionLengthParameter, type BooleanExtrusionParameterTransaction,
  type BooleanExtrusionFaceFeature, type BooleanExtrusionBooleanFeature, type BooleanExtrusionFeatureTransaction } from '@barocss/cad';
import { CadEditorError, createCadEditorFeatureSession, type CadEditorFeatureSessionOptions } from '@barocss/cad-editor';
import { CadEditorFeature, useCadEditorFeatureSnapshot, type CadEditorFeatureDisplayReceipt } from '@barocss/cad-editor/react';
import fixture from '../fixtures/boolean-extrusion.authored-graph.json?raw';
import sharedFixture from '../fixtures/shared-extrusions.authored-graph.json?raw';
import { Button } from './components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from './components/ui/menubar';
import { downloadAccepted, readCadEditorFile } from './file-actions';

const options: CadEditorFeatureSessionOptions = {
  native: { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 },
  display: { featureId: 'extrusion_feature', outputSlotId: 'extrusion_slot' },
  mesh: { meshId: 'editor_mesh', maximumVertices: 384, maximumTriangles: 288, maximumEdgePaths: 192, maximumNativeSamples: 1024 },
};
const names: Record<string, string> = { face_a_feature: 'Face A', face_b_feature: 'Face B', boolean_feature: 'Combine faces', extrusion_feature: 'Extrusion', base_height: 'Base height', design_height: 'Extrusion height', unused: 'Reference length', leaf_middle: 'Extrusion 2', leaf_high: 'Extrusion 3', leaf_top: 'Extrusion 4' };
interface ExtrusionDialog {
  mode: 'add' | 'edit' | 'remove';
  feature: BooleanExtrusionExtrusionFeature;
  kind: 'literal' | 'offset'; raw: string; parameterId: string; shown: string[];
}
interface LengthDraft {
  kind: 'literal' | 'offset'; raw: string; parameterId: string;
}
interface LengthRepair extends LengthDraft {
  id: string; target: 'parameter' | 'extrusion'; enabled: boolean;
}
interface LengthDialog {
  mode: 'add' | 'edit' | 'remove'; parameter: BooleanExtrusionLengthParameter;
  definition: LengthDraft; repairs: LengthRepair[];
}
interface ReferencedFeatureDialog {
  target: BooleanExtrusionFaceFeature | BooleanExtrusionBooleanFeature;
  replacement: BooleanExtrusionFaceFeature | BooleanExtrusionBooleanFeature;
  operation: 'union' | 'intersection' | 'difference';
  repairs: { id: string; kind: 'coplanar-boolean' | 'normal-extrusion'; enabled: boolean }[];
}
function scalar(raw: string, field = 'extrusion-length'): number {
  const text = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) || !Number.isFinite(Number(text)))
    throw new CadEditorError('INPUT', 'Enter a finite decimal length.', {field});
  return Number(text);
}

function message(error: CadEditorError, mode?: LengthDialog['mode']): string {
  if (error.context.field === 'parameter-length') return 'Enter a finite length in millimeters.';
  if (error.context.field === 'extrusion-length') return 'Enter a finite length in millimeters.';
  if (error.context.field === 'extrusion-view') return 'Choose one to four remaining extrusions to display.';
  if (error.context.field === 'feature-outputs' && error.cause) return 'Choose a retained extrusion view before this change or history action.';
  if (error.context.field === 'extrusion-transaction') return 'Cannot change this extrusion. Check its height, parameter and output selection.';
  if (error.context.field === 'fit-selected-output') return 'Show a nonempty extrusion before fitting it.';
  if (error.context.field === 'feature-outputs') return 'Display one to four different extrusions.';
  if (error.code === 'DISPLAY') return 'Cannot display this change. The current graph is retained.';
  if (error.code === 'BUDGET') return 'This input exceeds the supported size. Open a smaller graph.';
  if (error.code === 'STALE') return 'The graph changed. Try the action again.';
  const cause = error.cause instanceof Error ? error.cause : null;
  const code = cause && 'code' in cause ? String(cause.code) : '';
  if (error.context.field === 'referenced-feature-transaction') {
    if (code === 'DEPENDENCY') return 'Choose the replacement for every dependent feature.';
    return 'Cannot replace this feature. Check the operation and replacement choices.';
  }
  if (error.context.field === 'parameter-transaction') {
    if (cause?.message.includes('distance0.0001..10000mm')) return 'Keep each extrusion height from 0.0001 to 10000 mm.';
    if (mode === 'remove' && (code === 'DEPENDENCY' || code === 'PARAMETER')) return 'Choose a replacement for each dependent length and extrusion height. Remove circular references.';
    if (code === 'DEPENDENCY' || code === 'PARAMETER') return 'Check the length value and its parameter references.';
    return 'Cannot change this length. Check its value and enabled replacements.';
  }
  if (code === 'DEPENDENCY') return 'Choose an existing length parameter. Remove cyclic references.';
  if (error.context.field === 'feature-history' || error.context.field === 'feature-selection' || error.context.field === 'feature-draft') return 'Apply or discard the pending values before this action.';
  if (error.context.field === 'feature-file') return 'Cannot open this graph. Select a supported Boolean extrusion file.';
  return 'Cannot apply these values. Check the lengths, dependencies and face arrangement.';
}

function causeReceipt(cause: unknown, depth = 0): unknown {
  if (!(cause instanceof Error) || depth >= 6) return null;
  return {message:cause.message,code:'code' in cause ? cause.code : null,cause:causeReceipt(cause.cause,depth + 1)};
}

export function FeatureApp() {
  const [session] = useState(() => createCadEditorFeatureSession(parseBooleanExtrusionFeatureGraph(fixture, options.native).document, options));
  const snapshot = useCadEditorFeatureSnapshot(session);
  const name = (id: string) => names[id] ?? (() => {
    const generatedLength = /^ce_length_(\d+)$/.exec(id);
    if (generatedLength) return 'Length ' + generatedLength[1];
    const faceReplacement = /^rf(\d+)_face$/.exec(id), booleanReplacement = /^rb(\d+)_combine$/.exec(id);
    if (faceReplacement) return 'Face replacement ' + faceReplacement[1];
    if (booleanReplacement) return 'Combine faces ' + booleanReplacement[1];
    const leaves = snapshot.accepted.document.features.filter(feature => feature.kind === 'normal-extrusion');
    const index = leaves.findIndex(feature => feature.id === id);
    if (index >= 0) return 'Extrusion ' + (index + 1);
    const parameter = snapshot.accepted.document.parameters.findIndex(item => item.id === id);
    return parameter >= 0 ? 'Length ' + (parameter + 1) : 'Feature';
  })();
  const [lifecycle, setLifecycle] = useState<ExtrusionDialog | null>(null);
  const lifecycleToken = useRef<string | null>(null);
  const lifecycleTrigger = useRef<HTMLElement | null>(null);
  const addExtrusionButton = useRef<HTMLButtonElement | null>(null);
  const newLeafSequence = useRef(0);
  const [lengthDialog, setLengthDialog] = useState<LengthDialog | null>(null);
  const lengthToken = useRef<string | null>(null);
  const lengthExpectedGeneration = useRef<number | null>(null);
  const lengthTrigger = useRef<HTMLElement | null>(null);
  const addLengthButton = useRef<HTMLButtonElement | null>(null);
  const newLengthSequence = useRef(0);
  const [replaceDialog, setReplaceDialog] = useState<ReferencedFeatureDialog | null>(null);
  const replaceToken = useRef<string | null>(null);
  const replaceExpectedGeneration = useRef<number | null>(null);
  const replaceTrigger = useRef<HTMLElement | null>(null);
  const replaceFocusAfterAccept = useRef<string | null>(null);
  const replaceButtons = useRef(new Map<string, HTMLButtonElement>());
  const replacementSequence = useRef(0);
  const [error, setError] = useState<CadEditorError | null>(null);
  const [receipt, setReceipt] = useState<CadEditorFeatureDisplayReceipt | null>(null);
  const [filename, setFilename] = useState('Boolean extrusion');
  const [fitRequest, setFitRequest] = useState(0);
  const [fitSelectedRequest, setFitSelectedRequest] = useState(0);
  const [readRequest, setReadRequest] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [mountKey, setMountKey] = useState(0);
  const [displayRefusal, setDisplayRefusal] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingFilename = useRef<string | null>(null);
  const flowMode = new URLSearchParams(location.search).has('flow');
  const busy = snapshot.candidate !== null;
  const draft = Object.keys(snapshot.pending.parameters).length > 0 || Object.keys(snapshot.pending.booleanOperations).length > 0;
  const run = (action: () => unknown) => { try { setError(null); action(); } catch (cause) { setReadRequest(n => n + 1); setError(cause instanceof CadEditorError ? cause : new CadEditorError('FILE', 'Action failed.', {}, cause)); } };
  useEffect(() => () => session.dispose(), [session]);
  useEffect(() => {
    if (!flowMode) return;
    Object.assign(window, { __cadFeatureFlow: { session, snapshot: () => session.getSnapshot(), display: () => structuredClone(receipt), error: () => error ? {code:error.code,message:error.message,context:error.context,cause:causeReceipt(error.cause)} : null,
      setDisplayRefusal, setMounted: (value: boolean) => { setMounted(value); if (value) setMountKey(n => n + 1); } } });
    return () => { delete (window as Window & { __cadFeatureFlow?: unknown }).__cadFeatureFlow; };
  }, [flowMode, session, receipt, error]);
  async function openFile(file: File | undefined) {
    if (!file) return;
    try { setError(null); const text = await readCadEditorFile(file); pendingFilename.current = file.name; session.prepareOpen(text,options); }
    catch (cause) { pendingFilename.current = null; setReadRequest(n => n + 1); setError(cause instanceof CadEditorError ? cause : new CadEditorError('FILE', 'Cannot open this graph.', {field:'open'}, cause)); }
  }
  const dependencies = snapshot.accepted.report.featureDependencies;
  const extrusionFeatures = snapshot.accepted.document.features.filter(feature => feature.kind === 'normal-extrusion');
  function output(featureId: string, leaves = extrusionFeatures, revision = snapshot.accepted.document.revision) {
    const feature = leaves.find(item => item.id === featureId)!;
    const meshIds = ['editor_mesh', 'view_leaf_1', 'view_leaf_2', 'view_leaf_3'];
    return {selection:{graphId:snapshot.accepted.document.id,revision,featureId:feature.id,outputSlotId:feature.outputSlotId},mesh:{...options.mesh,meshId:meshIds[leaves.indexOf(feature)]}};
  }
  const visible = snapshot.displays.map(item => item.selection.featureId);
  function openExtrusion(mode: ExtrusionDialog['mode'], trigger: HTMLElement) {
    run(() => {
      const current = extrusionFeatures.find(feature => feature.id === snapshot.selectedFeatureId);
      let feature = current ?? extrusionFeatures[0];
      if (mode === 'add') {
        const nativeText = JSON.stringify(snapshot.accepted.document);
        let prefix: string;
        do { prefix = 'ce' + (++newLeafSequence.current); } while (nativeText.includes(prefix));
        if (prefix.length > 8) throw new CadEditorError('BUDGET', 'New extrusion identifier budget reached.');
        feature = {...extrusionFeatures[0], id:prefix + '_leaf',outputSlotId:prefix + '_slot',
          distance:{kind:'literal',valueMM:3}, options:{...extrusionFeatures[0].options,evaluationId:prefix + '_eval',resultIdPrefix:prefix}};
      } else if (!current) throw new CadEditorError('INPUT','Select an extrusion first.');
      const definition = feature.distance;
      const value = definition.kind === 'literal' ? definition.valueMM : definition.offsetMM;
      lifecycleTrigger.current = trigger; lifecycleToken.current = null;
      setLifecycle({mode,feature,kind:definition.kind,raw:Object.is(value,-0) ? '-0' : String(value),
        parameterId:definition.kind === 'offset' ? definition.parameterId : snapshot.accepted.document.parameters[0]?.id ?? '',
        shown:mode === 'remove' ? visible.filter(id => id !== feature.id) : [...visible]});
    });
  }
  function submitExtrusion() {
    if (!lifecycle) return;
    run(() => {
      const {mode,feature,shown} = lifecycle;
      const distance: BooleanExtrusionLengthDefinition = lifecycle.kind === 'literal' ? {kind:'literal',valueMM:scalar(lifecycle.raw)}
        : {kind:'offset',parameterId:lifecycle.parameterId,offsetMM:scalar(lifecycle.raw)};
      const leaves = mode === 'remove' ? extrusionFeatures.filter(item => item.id !== feature.id)
        : mode === 'add' ? [...extrusionFeatures,{...feature,distance}] : extrusionFeatures.map(item => item.id === feature.id ? {...feature,distance} : item);
      if (shown.length < 1 || shown.length > 4 || shown.some(id => !leaves.some(item => item.id === id)))
        throw new CadEditorError('INPUT','Choose a retained output view.',{field:'extrusion-view'});
      const revision = snapshot.accepted.document.revision + 1;
      const candidate = session.prepareExtrusionTransaction({expectedRevision:snapshot.accepted.document.revision,revision,
        featureOperations:mode === 'remove' ? [{kind:'remove',featureId:feature.id}] : [{kind:'upsert',feature:{...feature,distance}}]},
        shown.map(id => output(id,leaves,revision)));
      lifecycleToken.current = candidate.token;
    });
  }
  const dialogLeaves = lifecycle?.mode === 'remove' ? extrusionFeatures.filter(feature => feature.id !== lifecycle.feature.id)
    : lifecycle?.mode === 'add' ? [...extrusionFeatures,lifecycle.feature] : extrusionFeatures;
  function lengthDraft(definition: BooleanExtrusionLengthDefinition, unchosenReference = false): LengthDraft {
    const value = definition.kind === 'literal' ? definition.valueMM : definition.offsetMM;
    return { kind: definition.kind, raw: Object.is(value, -0) ? '-0' : String(value),
      parameterId: definition.kind === 'offset' && !unchosenReference ? definition.parameterId : '' };
  }
  function openLength(mode: LengthDialog['mode'], parameterId: string | null, trigger: HTMLElement) {
    run(() => {
      if (busy || draft || lifecycle || lengthDialog || replaceDialog) throw new CadEditorError('INPUT', 'Resolve pending changes before opening a length dialog.', {field:'feature-draft'});
      let parameter: BooleanExtrusionLengthParameter;
      if (mode === 'add') {
        const reserved = JSON.stringify(snapshot.accepted.document) + JSON.stringify(snapshot.accepted.report.qualifiedBindings);
        let id: string;
        do { id = 'ce_length_' + (++newLengthSequence.current); } while (reserved.includes(id));
        if (id.length > 48) throw new CadEditorError('BUDGET', 'Fresh length identity budget reached.', {field:'parameter-transaction'});
        parameter = { id, type: 'length', definition: {kind:'literal',valueMM:3} };
      } else {
        const current = snapshot.accepted.document.parameters.find(value => value.id === parameterId);
        if (!current) throw new CadEditorError('STALE', 'The selected length no longer exists.', {field:'parameter-transaction'});
        parameter = current;
      }
      const repairs: LengthRepair[] = mode !== 'remove' ? [] : [
        ...snapshot.accepted.document.parameters.filter(value => value.definition.kind === 'offset' && value.definition.parameterId === parameter.id)
          .map(value => ({id:value.id,target:'parameter' as const,enabled:false,...lengthDraft(value.definition,true)})),
        ...extrusionFeatures.filter(value => value.distance.kind === 'offset' && value.distance.parameterId === parameter.id)
          .map(value => ({id:value.id,target:'extrusion' as const,enabled:false,...lengthDraft(value.distance,true)})),
      ];
      lengthTrigger.current = trigger; lengthToken.current = null; lengthExpectedGeneration.current = null;
      setLengthDialog({mode,parameter,definition:lengthDraft(parameter.definition),repairs});
    });
  }
  function authoredLength(draft: LengthDraft): BooleanExtrusionLengthDefinition {
    const value = scalar(draft.raw,'parameter-length');
    return draft.kind === 'literal' ? {kind:'literal',valueMM:value} : {kind:'offset',parameterId:draft.parameterId,offsetMM:value};
  }
  function submitLength() {
    if (!lengthDialog) return;
    run(() => {
      const {mode,parameter,definition,repairs} = lengthDialog;
      const parameterOperations: BooleanExtrusionParameterTransaction['parameterOperations'] = mode === 'remove'
        ? [{kind:'remove',parameterId:parameter.id}]
        : [{kind:'upsert',parameter:{id:parameter.id,type:parameter.type,definition:authoredLength(definition)}}];
      const distanceEdits: BooleanExtrusionParameterTransaction['distanceEdits'] = [];
      for (const repair of repairs) if (repair.enabled) {
        const replacement = authoredLength(repair);
        if (repair.target === 'parameter') {
          const current = snapshot.accepted.document.parameters.find(value => value.id === repair.id);
          if (!current) throw new CadEditorError('STALE', 'A dependent length no longer exists.', {field:'parameter-transaction'});
          parameterOperations.push({kind:'upsert',parameter:{id:current.id,type:current.type,definition:replacement}});
        } else distanceEdits.push({featureId:repair.id,definition:replacement});
      }
      const candidate = session.prepareParameterTransaction({expectedRevision:snapshot.accepted.document.revision,
        revision:snapshot.accepted.document.revision+1,parameterOperations,distanceEdits});
      lengthToken.current = candidate.token;
      lengthExpectedGeneration.current = candidate.baseGeneration + 1;
    });
  }
  function cancelLength() { if (!busy) {lengthToken.current=null;lengthExpectedGeneration.current=null;setLengthDialog(null);setError(null);} }
  function updateLengthDefinition(change: Partial<LengthDraft>) {
    setLengthDialog(current => current ? {...current,definition:{...current.definition,...change}} : current);
  }
  function updateRepair(id: string, change: Partial<LengthRepair>) {
    setLengthDialog(current => current ? {...current,repairs:current.repairs.map(repair => repair.id === id ? {...repair,...change} : repair)} : current);
  }
  const replacementParameters = lengthDialog?.mode === 'remove'
    ? snapshot.accepted.document.parameters.filter(parameter => parameter.id !== lengthDialog.parameter.id)
    : snapshot.accepted.document.parameters;
  function openReplacement(featureId: string, trigger: HTMLElement) {
    run(() => {
      if (busy || draft || lifecycle || lengthDialog || replaceDialog) throw new CadEditorError('INPUT', 'Resolve pending changes before replacing a feature.', {field:'feature-draft'});
      const target = snapshot.accepted.document.features.find(feature => feature.id === featureId);
      if (!target || target.kind === 'normal-extrusion') throw new CadEditorError('INPUT', 'Choose a Face or Boolean feature to replace.', {field:'referenced-feature-transaction'});
      const reserved = JSON.stringify(snapshot.accepted.document) + JSON.stringify(snapshot.accepted.report.qualifiedBindings);
      let prefix: string;
      do { prefix = (target.kind === 'face-input' ? 'rf' : 'rb') + (++replacementSequence.current); } while (reserved.includes(prefix));
      if (prefix.length > 8) throw new CadEditorError('BUDGET', 'Replacement identity budget reached.', {field:'referenced-feature-transaction'});
      const replacement: ReferencedFeatureDialog['replacement'] = target.kind === 'face-input'
        ? {...target,id:prefix+'_face',outputSlotId:prefix+'_slot'}
        : {...target,id:prefix+'_combine',outputSlotId:prefix+'_slot',
          options:{...target.options,evaluationId:prefix+'_eval',resultIdPrefix:prefix}};
      const repairs: ReferencedFeatureDialog['repairs'] = [];
      for (const feature of snapshot.accepted.document.features) {
        if (target.kind === 'face-input' && feature.kind === 'coplanar-boolean'
          && (feature.operandAFeatureId === target.id || feature.operandBFeatureId === target.id)) {
          repairs.push({id:feature.id,kind:feature.kind,enabled:false});
        } else if (target.kind === 'coplanar-boolean' && feature.kind === 'normal-extrusion' && feature.regionFeatureId === target.id) {
          repairs.push({id:feature.id,kind:feature.kind,enabled:false});
        }
      }
      replaceTrigger.current=trigger;replaceToken.current=null;replaceExpectedGeneration.current=null;replaceFocusAfterAccept.current=null;
      setReplaceDialog({target,replacement,repairs,operation:target.kind==='coplanar-boolean'?target.options.operation:'union'});
    });
  }
  function submitReplacement() {
    if (!replaceDialog) return;
    run(() => {
      const {target,replacement,operation,repairs}=replaceDialog;
      const preparedReplacement = replacement.kind === 'coplanar-boolean'
        ? {...replacement,options:{...replacement.options,operation}} : replacement;
      const featureOperations: BooleanExtrusionFeatureTransaction['featureOperations']=[{kind:'upsert',feature:preparedReplacement}];
      for (const repair of repairs) if (repair.enabled) {
        const feature = snapshot.accepted.document.features.find(value => value.id === repair.id);
        if (repair.kind === 'coplanar-boolean' && feature?.kind === 'coplanar-boolean') {
          featureOperations.push({kind:'upsert',feature:{...feature,
            operandAFeatureId:feature.operandAFeatureId===target.id?replacement.id:feature.operandAFeatureId,
            operandBFeatureId:feature.operandBFeatureId===target.id?replacement.id:feature.operandBFeatureId}});
        } else if (repair.kind === 'normal-extrusion' && feature?.kind === 'normal-extrusion') {
          featureOperations.push({kind:'upsert',feature:{...feature,regionFeatureId:replacement.id}});
        } else throw new CadEditorError('STALE','A dependent feature changed.',{field:'referenced-feature-transaction'});
      }
      featureOperations.push({kind:'remove',featureId:target.id});
      const candidate=session.prepareReferencedFeatureTransaction({expectedRevision:snapshot.accepted.document.revision,
        revision:snapshot.accepted.document.revision+1,featureOperations});
      replaceToken.current=candidate.token;replaceExpectedGeneration.current=candidate.baseGeneration+1;
      replaceFocusAfterAccept.current=replacement.id;
    });
  }
  function cancelReplacement() {
    if (busy) return;
    replaceToken.current=null;replaceExpectedGeneration.current=null;replaceFocusAfterAccept.current=null;
    setReplaceDialog(null);setError(null);
  }
  return <div className="cad-app">
    <header className="app-header">
      <a className="app-brand" href="#/features/cad_boolean_extrusion"><Box size={20}/><span>barocss<span className="brand-sub">CAD</span></span></a>
      <Menubar className="app-menubar"><MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent>
        <MenubarItem disabled={busy || draft} onSelect={() => run(() => { pendingFilename.current = 'Boolean extrusion'; session.prepareOpen(fixture,options); })}>New Boolean extrusion</MenubarItem>
        <MenubarItem disabled={busy || draft} onSelect={() => run(() => { pendingFilename.current = "Shared extrusions"; session.prepareOpen(sharedFixture,options); })}>New shared extrusions</MenubarItem>
        <MenubarItem disabled={busy} onSelect={() => fileInput.current?.click()}>Open native graph…</MenubarItem>
        <MenubarItem onSelect={() => run(() => downloadAccepted(session))}>Download accepted graph</MenubarItem>
        <MenubarSeparator/><MenubarItem disabled={busy} onSelect={() => { location.hash = '/documents/cad_editor_fixture'; }}>Surface document</MenubarItem>
      </MenubarContent></MenubarMenu></Menubar>
      <span className="document-title">{filename}<span className="dirty-dot" aria-label={snapshot.dirty ? 'Changed since open or download' : 'Accepted content unchanged'}>{snapshot.dirty ? ' •' : ''}</span></span>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}><FolderOpen/>Open</Button>
      <Button size="sm" onClick={() => run(() => downloadAccepted(session))}><Download/>Download</Button>
      <input ref={fileInput} type="file" accept=".json" aria-label="Open native feature graph file" className="file-input" onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ''; }}/>
    </header>
    <div className="app-toolbar feature-toolbar"><span className="breadcrumb">{filename}</span><div className="toolbar-actions">
      <Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!snapshot.history.canUndo || busy || draft} onClick={() => run(() => session.prepareUndo())}><Undo2/></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!snapshot.history.canRedo || busy || draft} onClick={() => run(() => session.prepareRedo())}><Redo2/></Button>
      <span className="toolbar-divider"/>
      <Button variant="ghost" size="sm" data-testid="add-extrusion" ref={addExtrusionButton} disabled={busy || draft} onClick={event => openExtrusion('add',event.currentTarget)}>Add extrusion</Button>
      <Button variant="ghost" size="sm" data-testid="edit-extrusion" disabled={busy || draft || !extrusionFeatures.some(feature => feature.id === snapshot.selectedFeatureId)} onClick={event => openExtrusion('edit',event.currentTarget)}>Edit extrusion</Button>
      <Button variant="ghost" size="sm" data-testid="remove-extrusion" disabled={busy || draft || !extrusionFeatures.some(feature => feature.id === snapshot.selectedFeatureId)} onClick={event => openExtrusion('remove',event.currentTarget)}>Remove</Button>
      <span className="toolbar-divider"/><Button variant="ghost" size="sm" onClick={() => setFitRequest(n => n + 1)}><Maximize/>Fit</Button>
      <Button variant="ghost" size="sm" data-testid="fit-selected-output" disabled={!snapshot.selectedFeatureId} onClick={() => setFitSelectedRequest(n => n + 1)}>Fit selected</Button>
      <Button variant="ghost" size="sm" data-testid="show-all-outputs" disabled={busy} onClick={() => run(() => session.prepareDisplayOutputs(extrusionFeatures.map(feature => output(feature.id))))}>Show all</Button>
      <Button variant="ghost" size="sm" data-testid="solo-selected-output" disabled={busy || !extrusionFeatures.some(feature => feature.id === snapshot.selectedFeatureId)} onClick={() => run(() => session.prepareDisplayOutputs([output(snapshot.selectedFeatureId!)]))}>Show only selected</Button>
    </div></div>
    {error && !lifecycle && !lengthDialog && !replaceDialog && <div className="app-error" role="alert">{message(error)}<Button variant="ghost" size="xs" onClick={() => setError(null)}>Dismiss</Button></div>}
    <div className="app-workspace">
      <aside className="document-tree"><h2><Layers3 size={15}/>Features</h2><div className="tree-document"><Box size={16}/><span>{filename}</span></div>
        {snapshot.accepted.document.features.map(feature => <div key={feature.id} className="tree-body-row">
          <button data-testid={'feature-select-' + feature.id} className={'tree-body' + (snapshot.selectedFeatureId === feature.id ? ' selected' : '')} aria-pressed={snapshot.selectedFeatureId === feature.id} onClick={() => run(() => session.selectFeature(feature.id))}>
            <span className="body-symbol surface">{feature.kind === 'normal-extrusion' ? '▣' : '▱'}</span><span>{name(feature.id)}<small>{(dependencies.find(item => item.featureId === feature.id)?.dependencyIds ?? []).map(name).join(' + ') || 'Original face'}</small></span>
          </button>
          {feature.kind === 'normal-extrusion' && <input type="checkbox" data-testid={'output-visible-' + feature.id} aria-label={(visible.includes(feature.id) ? 'Hide ' : 'Show ') + name(feature.id)} checked={visible.includes(feature.id)} disabled={busy} onChange={() => run(() => session.prepareDisplayOutputs((visible.includes(feature.id) ? visible.filter(id => id !== feature.id) : [...visible,feature.id]).map(id => output(id))))} />}
          {feature.kind !== 'normal-extrusion' && <Button variant="ghost" size="xs" className="feature-replace-action"
            data-testid={'replace-feature-' + feature.id}
            ref={button => {if (button) replaceButtons.current.set(feature.id,button);else replaceButtons.current.delete(feature.id);}}
            disabled={busy || draft || lifecycle !== null || lengthDialog !== null || replaceDialog !== null}
            onClick={event => openReplacement(feature.id,event.currentTarget)}>Replace</Button>}
        </div>)}
        <div className="tree-section length-sidebar-heading"><span>LENGTHS · {snapshot.accepted.parameters.length}</span>
          <Button ref={addLengthButton} variant="ghost" size="xs" data-testid="add-length" disabled={busy || draft || lifecycle !== null || lengthDialog !== null || replaceDialog !== null}
            onClick={event => openLength('add',null,event.currentTarget)}>Add length</Button></div>
        {snapshot.accepted.parameters.map(parameter => <div key={parameter.id} className="length-sidebar-row">
          <div className="feature-parameter-summary" data-testid={'parameter-summary-' + parameter.id}><span>{name(parameter.id)}{parameter.dependencyIds.length > 0 && <small>{parameter.dependencyIds.map(name).join(' + ')}</small>}</span><strong>{Object.is(parameter.valueMM,-0) ? '-0' : parameter.valueMM} mm</strong></div>
          <div className="length-row-actions"><Button variant="ghost" size="xs" data-testid={'edit-length-' + parameter.id}
            disabled={busy || draft || lifecycle !== null || lengthDialog !== null || replaceDialog !== null} onClick={event => openLength('edit',parameter.id,event.currentTarget)}>Edit</Button>
            <Button variant="ghost" size="xs" data-testid={'remove-length-' + parameter.id}
              disabled={busy || draft || lifecycle !== null || lengthDialog !== null || replaceDialog !== null} onClick={event => openLength('remove',parameter.id,event.currentTarget)}>Remove</Button></div>
        </div>)}
        <div className="tree-details"><span>Units</span><strong>mm</strong><span>Axes</span><strong>XYZ</strong></div>
      </aside>
      <main className="main-workspace">{mounted && <CadEditorFeature key={mountKey} session={session} fitRequest={fitRequest} fitSelectedRequest={fitSelectedRequest || undefined} readRequest={readRequest}
        displayOptions={displayRefusal ? {mmToSceneUnit:0,translate:[0,0,0],background:[0.07,0.08,0.10],camera:{eye:[0.2,0.2,0.2],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:0.001,far:10}} : undefined}
        onError={failure => { pendingFilename.current = null; lifecycleToken.current = null; lengthToken.current = null; lengthExpectedGeneration.current = null;
          replaceToken.current=null;replaceExpectedGeneration.current=null;replaceFocusAfterAccept.current=null;setError(failure); }} onDisplay={setReceipt}
        onAccepted={accepted => { setError(null); if (lifecycleToken.current) { lifecycleToken.current = null; setLifecycle(null); }
          if (lengthToken.current !== null && accepted.generation === lengthExpectedGeneration.current) {
            lengthToken.current = null; lengthExpectedGeneration.current = null; setLengthDialog(null);
          }
          if (replaceToken.current !== null && accepted.generation === replaceExpectedGeneration.current) {
            replaceToken.current=null;replaceExpectedGeneration.current=null;setReplaceDialog(null);
          }
          if (pendingFilename.current) {setFilename(pendingFilename.current); pendingFilename.current = null;} location.hash = '/features/' + accepted.accepted.document.id; }}/>}</main>
    </div>
    <Dialog open={lifecycle !== null} onOpenChange={open => {if (!open && !busy) {setLifecycle(null);setError(null);}}}>
      <DialogContent className="cad-editor-help-dialog extrusion-dialog" showCloseButton={!busy} onCloseAutoFocus={event => {event.preventDefault();const trigger=lifecycleTrigger.current; if (trigger instanceof HTMLButtonElement && !trigger.disabled && trigger.isConnected) trigger.focus(); else addExtrusionButton.current?.focus();}} onEscapeKeyDown={event => {if (busy) event.preventDefault();}} onPointerDownOutside={event => {if (busy) event.preventDefault();}}>
        <DialogHeader><DialogTitle>{lifecycle?.mode === 'remove' ? 'Remove extrusion' : lifecycle?.mode === 'edit' ? 'Edit extrusion' : 'Add extrusion'}</DialogTitle>
          <DialogDescription>{lifecycle?.mode === 'remove' ? 'Choose which remaining extrusions to display.' : 'Set a height and choose which extrusions to display.'}</DialogDescription></DialogHeader>
        {lifecycle && <>
          {lifecycle.mode === 'remove' ? <p>Remove {name(lifecycle.feature.id)}?{extrusionFeatures.length === 1 && ' Keep at least one extrusion in this graph.'}</p> : <div className="extrusion-fields">
            <label>Height definition<select data-testid="extrusion-definition" value={lifecycle.kind} onChange={event => setLifecycle({...lifecycle,kind:event.target.value as 'literal'|'offset'})}><option value="literal">Literal</option><option value="offset">Parameter + offset</option></select></label>
            {lifecycle.kind === 'offset' && <label>Length parameter<select data-testid="extrusion-parameter" value={lifecycle.parameterId} onChange={event => setLifecycle({...lifecycle,parameterId:event.target.value})}>{snapshot.accepted.document.parameters.map(parameter => <option key={parameter.id} value={parameter.id}>{name(parameter.id)}</option>)}</select></label>}
            <label>{lifecycle.kind === 'literal' ? 'Height (mm)' : 'Offset (mm)'}<input data-testid="extrusion-value" value={lifecycle.raw} onChange={event => setLifecycle({...lifecycle,raw:event.target.value})}/></label>
          </div>}
          <fieldset className="extrusion-outputs"><legend>Display after this change</legend>{dialogLeaves.map((feature,index) => <label key={feature.id}><input type="checkbox" data-testid={'lifecycle-visible-' + feature.id} checked={lifecycle.shown.includes(feature.id)} onChange={() => setLifecycle({...lifecycle,shown:lifecycle.shown.includes(feature.id) ? lifecycle.shown.filter(id => id !== feature.id) : [...lifecycle.shown,feature.id]})}/>{feature.id === lifecycle.feature.id && lifecycle.mode === 'add' ? 'New extrusion' : name(feature.id)}{index === dialogLeaves.length - 1 && lifecycle.mode === 'add' ? ' (new)' : ''}</label>)}</fieldset>
          {error && <p role="alert" className="extrusion-error">{message(error)}</p>}
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => {setLifecycle(null);setError(null);}}>Cancel</Button><Button data-testid="extrusion-confirm" disabled={busy || lifecycle.shown.length === 0 || lifecycle.shown.length > 4 || (lifecycle.mode === 'remove' && extrusionFeatures.length === 1)} onClick={submitExtrusion}>{busy ? 'Preparing display' : lifecycle.mode === 'remove' ? 'Remove' : lifecycle.mode === 'edit' ? 'Apply' : 'Add'}</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
    <Dialog open={replaceDialog !== null} onOpenChange={open => {if (!open) cancelReplacement();}}>
      <DialogContent className="cad-editor-help-dialog length-dialog replacement-dialog" data-testid="replace-dialog" showCloseButton={!busy}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const acceptedId=replaceFocusAfterAccept.current;
          replaceFocusAfterAccept.current=null;
          const preferred=acceptedId ? replaceButtons.current.get(acceptedId) : replaceTrigger.current;
          if (preferred instanceof HTMLButtonElement && preferred.isConnected && !preferred.disabled) preferred.focus();
        }}
        onEscapeKeyDown={event => {if (busy) event.preventDefault();}}
        onPointerDownOutside={event => {if (busy) event.preventDefault();}}>
        <DialogHeader><DialogTitle>{replaceDialog?.target.kind === 'face-input' ? 'Replace face' : 'Replace combination'}</DialogTitle>
          <DialogDescription>Choose each dependent feature that will use the replacement.</DialogDescription></DialogHeader>
        {replaceDialog && <>
          <div className="length-dialog-body">
            <p>Replace {name(replaceDialog.target.id)} with {name(replaceDialog.replacement.id)}.</p>
            {replaceDialog.target.kind === 'face-input' ? <p>Keep the current face shape.</p>
              : <div className="extrusion-fields"><label>Operation<select data-testid="replace-operation" disabled={busy}
                value={replaceDialog.operation} onChange={event => setReplaceDialog(current => current
                  ? {...current,operation:event.target.value as 'union'|'intersection'|'difference'} : current)}>
                <option value="union">Union</option><option value="intersection">Intersection</option><option value="difference">Difference</option>
              </select></label></div>}
            <fieldset className="extrusion-outputs replacement-repairs"><legend>Use the replacement</legend>
              {replaceDialog.repairs.map(repair => <label key={repair.id}><input type="checkbox" disabled={busy}
                data-testid={'replace-repair-' + repair.id} checked={repair.enabled}
                onChange={event => {
                  const enabled=event.target.checked;
                  setReplaceDialog(current => current ? {...current,repairs:current.repairs.map(value => value.id === repair.id ? {...value,enabled} : value)} : current);
                }}/>{replaceDialog.target.kind === 'face-input' ? 'Use replacement face' : 'Use replacement combination'} for {name(repair.id)}</label>)}
            </fieldset>
            {error && <p className="extrusion-error" role="alert">{message(error)}</p>}
          </div>
          <DialogFooter>
            <Dialog><DialogTrigger asChild><Button variant="ghost" disabled={busy} className="length-help-trigger" data-testid="replace-help">Help</Button></DialogTrigger>
              <DialogContent className="cad-editor-help-dialog" data-testid="replace-help-dialog">
                <DialogHeader><DialogTitle>Referenced feature replacement</DialogTitle><DialogDescription>Same-shape replacement with explicit reference repairs.</DialogDescription></DialogHeader>
                <p>Face replacement keeps the current authored Plane and ordered Line input. It creates a fresh logical feature and output slot; it does not edit coordinates or import geometry.</p>
                <p>Combination replacement copies the original operands and budgets, creates a fresh logical/native evaluation context, and uses Union, Intersection or Difference.</p>
                <p>Every direct reference starts unchecked. Choose each Boolean operand or extrusion region repair explicitly. Only checked repairs enter the same native transaction before the old target is removed. Missing repairs reach the actual native dependency refusal.</p>
                <p>The accepted view stays current while you choose. Operation and checkbox changes do not preview or modify the native graph. Native or GPU refusal keeps this dialog, choices, error, history, selection and current frame.</p>
                <p>Replace commits after complete native evaluation, full GPU scene admission and a fresh RGBA read. Cancel or Escape drops only dialog choices and restores the old Replace trigger. Acceptance focuses the new Replace row without selecting it.</p>
                <p>The native transaction supports 1–8 unique targets and a working table of at most 8. The final graph keeps two Faces, one Boolean and 1–4 extrusion leaves. This workflow does not create/remove extrusions, change parameters, suppress features, reorder them or perform general solid Boolean operations.</p>
                <p>Manual topics: Referenced feature transactions in the package README; Replace referenced features in the app README.</p>
                {error && <details><summary>Technical details</summary><pre>{JSON.stringify({code:error.code,message:error.message,cause:causeReceipt(error.cause)},null,2)}</pre></details>}
                <DialogClose asChild><Button variant="outline" data-testid="replace-help-close">Close help</Button></DialogClose>
              </DialogContent>
            </Dialog>
            <Button variant="outline" disabled={busy} onClick={cancelReplacement}>Cancel</Button>
            <Button data-testid="replace-confirm" disabled={busy} onClick={submitReplacement}>{busy ? 'Preparing display' : 'Replace'}</Button>
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
    <Dialog open={lengthDialog !== null} onOpenChange={open => {if (!open) cancelLength();}}>
      <DialogContent className="cad-editor-help-dialog length-dialog" data-testid="length-dialog" showCloseButton={!busy}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const trigger = lengthTrigger.current;
          if (trigger instanceof HTMLButtonElement && trigger.isConnected && !trigger.disabled) trigger.focus({preventScroll:true});
          else addLengthButton.current?.focus({preventScroll:true});
        }}
        onEscapeKeyDown={event => {if (busy) event.preventDefault();}}
        onPointerDownOutside={event => {if (busy) event.preventDefault();}}>
        <DialogHeader><DialogTitle>{lengthDialog?.mode === 'remove' ? 'Remove length' : lengthDialog?.mode === 'edit' ? 'Edit length' : 'Add length'}</DialogTitle>
          <DialogDescription>{lengthDialog?.mode === 'remove' ? 'Choose a replacement for each dependent length or extrusion height.' : 'Set a value in mm or use another length plus an offset.'}</DialogDescription></DialogHeader>
        {lengthDialog && <>
          <div className="length-dialog-body">
          {lengthDialog.mode !== 'remove' ? <div className="extrusion-fields">
            {lengthDialog.mode === 'edit' && <p>{name(lengthDialog.parameter.id)}</p>}
            <label>Definition<select data-testid="length-definition" disabled={busy} value={lengthDialog.definition.kind}
              onChange={event => updateLengthDefinition({kind:event.target.value as 'literal'|'offset'})}>
              <option value="literal">Literal</option><option value="offset">Parameter + offset</option></select></label>
            {lengthDialog.definition.kind === 'offset' && <label>Length parameter<select data-testid="length-parameter" disabled={busy}
              value={lengthDialog.definition.parameterId} onChange={event => updateLengthDefinition({parameterId:event.target.value})}>
              <option value="">Choose a length</option>{snapshot.accepted.document.parameters.map(parameter => <option key={parameter.id} value={parameter.id}>{name(parameter.id)}</option>)}
            </select></label>}
            <label>{lengthDialog.definition.kind === 'literal' ? 'Value (mm)' : 'Offset (mm)'}<input data-testid="length-value" disabled={busy}
              inputMode="decimal" value={lengthDialog.definition.raw} onChange={event => updateLengthDefinition({raw:event.target.value})}/></label>
          </div> : <>
            <p>Remove {name(lengthDialog.parameter.id)}?</p>
            {lengthDialog.repairs.length === 0 && <p>No lengths or extrusion heights refer to this length.</p>}
            {lengthDialog.repairs.map(repair => <fieldset key={repair.id} className="length-repair-row">
              <legend>{name(repair.id)} · {repair.target === 'parameter' ? 'length' : 'extrusion height'}</legend>
              <label className="length-repair-enable"><input type="checkbox" disabled={busy} data-testid={'repair-enable-' + repair.id}
                checked={repair.enabled} onChange={event => updateRepair(repair.id,{enabled:event.target.checked})}/>Set a replacement</label>
              <div className="extrusion-fields">
                <label>Definition<select data-testid={'repair-definition-' + repair.id} disabled={busy || !repair.enabled} value={repair.kind}
                  onChange={event => updateRepair(repair.id,{kind:event.target.value as 'literal'|'offset'})}>
                  <option value="literal">Literal</option><option value="offset">Parameter + offset</option></select></label>
                {repair.kind === 'offset' && <label>Length parameter<select data-testid={'repair-parameter-' + repair.id}
                  disabled={busy || !repair.enabled} value={repair.parameterId} onChange={event => updateRepair(repair.id,{parameterId:event.target.value})}>
                  <option value="">Choose a length</option>{replacementParameters.map(parameter => <option key={parameter.id} value={parameter.id}>{name(parameter.id)}</option>)}
                </select></label>}
                <label>{repair.kind === 'literal' ? 'Value (mm)' : 'Offset (mm)'}<input data-testid={'repair-value-' + repair.id}
                  disabled={busy || !repair.enabled} inputMode="decimal" value={repair.raw} onChange={event => updateRepair(repair.id,{raw:event.target.value})}/></label>
              </div>
            </fieldset>)}
          </>}
          {error && <p className="extrusion-error" role="alert">{message(error,lengthDialog.mode)}</p>}
          </div>
          <DialogFooter>
            <Dialog><DialogTrigger asChild><Button variant="ghost" disabled={busy} className="length-help-trigger" data-testid="length-help">Help</Button></DialogTrigger>
              <DialogContent className="cad-editor-help-dialog" data-testid="length-help-dialog">
                <DialogHeader><DialogTitle>Length editing help</DialogTitle><DialogDescription>Length definitions and explicit reference repairs.</DialogDescription></DialogHeader>
                <p>Use a literal value in mm or another length plus an offset in mm. Every parameter must resolve without circular references. Each extrusion height must be from 0.0001 to 10000 mm.</p>
                <p>When removing a length, enable and choose a replacement for each dependent length and extrusion height. Unchecked rows are not repaired. No dependent value is replaced automatically.</p>
                <p>Apply evaluates one native parameter transaction and rebuilds all displayed outputs. The graph changes after the GPU accepts the full scene and a fresh frame is read. Cancel or Escape keeps the accepted graph. Raw dialog values stay pending if evaluation or display fails.</p>
                <p>The native table supports 0–8 lengths, 1–16 unique operations and 0–4 explicit distance repairs per transaction. Feature lifecycle is a separate transaction.</p>
                <p>Manual topics: Shared length changes in Feature properties Help; Native parameter table lifecycle in the package README; Length parameter lifecycle in the app README.</p>
                {error && <details><summary>Technical details</summary><pre>{JSON.stringify({code:error.code,message:error.message,cause:causeReceipt(error.cause)},null,2)}</pre></details>}
                <DialogClose asChild><Button variant="outline" data-testid="length-help-close">Close help</Button></DialogClose>
              </DialogContent>
            </Dialog>
            <Button variant="outline" disabled={busy} onClick={cancelLength}>Cancel</Button>
            <Button data-testid="length-confirm" disabled={busy} onClick={submitLength}>{busy ? 'Preparing display' : lengthDialog.mode === 'remove' ? 'Remove' : lengthDialog.mode === 'edit' ? 'Apply' : 'Add'}</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
    <footer className="app-status"><span className="status-led"/><span>{busy ? 'Preparing display' : draft ? 'Pending values' : 'Accepted graph'}</span><span className="status-divider"/><span>{snapshot.downloadStatus}</span><span className="status-spacer"/><span>{visible.length} visible</span><span className="status-divider"/><span>XYZ · mm</span></footer>
  </div>;
}
