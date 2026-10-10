#!/usr/bin/env python3
"""Offline row residuals from immutable, already validated #1197 data."""
import argparse
from decimal import Decimal, localcontext
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
from residual_math import make_row, normal_velocity, tangent_speed, complementarity_residual, decomposition, dec
HERE = Path(__file__).resolve().parent
INPUT = HERE.parent / 'physics-rigid-velocity-diagnostic' / 'evidence' / 'native-92402add'
SPEC = importlib.util.spec_from_file_location('validated_phase', HERE.parent / 'physics-rigid-velocity-diagnostic' / 'phase-analysis.py')
PHASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PHASE)
TARGETS = (('b2', 'b3'), ('b3', 'b4'))
BAND = Decimal('1e-10')
LIMIT = Decimal('1e-25')

def digest(data): return hashlib.sha256(data).hexdigest()
def read(path):
    with (gzip.open(path, 'rt') if path.suffix == '.gz' else open(path)) as handle:
        return json.load(handle)
def serial(value):
    if isinstance(value, Decimal): return str(value)
    if isinstance(value, dict): return {key: serial(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)): return [serial(item) for item in value]
    return value

def agrees(low, high):
    if isinstance(low, Decimal):
        PHASE.require(isinstance(high, Decimal) and abs(low-high) <= LIMIT, 'row precision disagreement')
    elif isinstance(low, dict):
        PHASE.require(low.keys() == high.keys(), 'precision schema disagreement')
        for key in low: agrees(low[key], high[key])
    elif isinstance(low, (tuple, list)):
        PHASE.require(len(low) == len(high), 'precision count disagreement')
        for a,b in zip(low,high): agrees(a,b)
    else: PHASE.require(low == high, 'precision classification disagreement')

def analyze_graph(directory, graph):
    # This is the new consumer input gate; it reuses the exact sealed validator.
    case, parity = PHASE.analyze_case(directory, graph)
    report = read(directory / f'{graph}-OFFSET-report.json.gz')
    _, raw_frames = PHASE.read_raw(directory / f'{graph}-OFFSET-trace.f64le.gz', 3489, report['traceRawSha256'])
    frames = report['traces']
    decoded = {}
    for index, frame in enumerate(frames):
        if frame['metadata']['stepIndex'] == 15:
            saved = PHASE.decode_state(frame['state'], raw_frames[index], 15, f'{graph}:{index}')
            decoded[index] = {body['id']: body for body in saved['bodies']}
    local_rows, transitions, refreshes, unmatched = [], [], [], []
    selected_count = 0
    for index, frame in enumerate(frames):
        meta = frame['metadata']
        pair = tuple(meta['pair'] or ())
        if meta['stepIndex'] != 15 or pair not in TARGETS or meta['phase'] != 'after-response': continue
        if meta['path'] != 'manifold':
            unmatched.append({'frame':index,'pair':pair,'pass':meta['pass'],'reason':'non-manifold; point complementarity unmeasured'})
            continue
        selected_count += 1
        next_index = next((j for j in range(index+1,len(frames)) if frames[j]['metadata']['stepIndex']==15 and tuple(frames[j]['metadata']['pair'] or ())==pair and frames[j]['metadata']['phase']=='pair-before'),None)
        end = next_index if next_index is not None else max(decoded)
        current_points = {point['id']:point for point in meta['manifold']}
        fresh = frames[next_index]['metadata'] if next_index is not None else None
        fresh_points = {point['id']:point for point in (fresh['manifold'] or [])} if fresh else {}
        if fresh:
            unmatched.append({'frame':next_index,'pair':pair,'fromPass':meta['pass'],'toPass':fresh['pass'],'removedIDs':sorted(current_points.keys()-fresh_points.keys()),'newIDs':sorted(fresh_points.keys()-current_points.keys()),'path':fresh['path']})
        cache = {row['key']:row for row in meta['current']}
        for point_id,point in current_points.items():
            key = '\0'.join((*pair,point_id))
            PHASE.require(key in cache, 'response point has no recorded accumulated impulse',frame=index,point=point_id)
            impulse = cache[key]['normalNs']
            def calculate(precision):
                with localcontext() as context:
                    context.prec = precision
                    a0,b0 = (decoded[index][name] for name in pair)
                    old = make_row(point['pointM'],meta['hit']['normalAtoB'],a0['positionM'],b0['positionM'])
                    initial = normal_velocity(old,a0,b0)
                    local = {'frame':index,'pair':pair,'pass':meta['pass'],'pointID':point_id,'normalImpulseNs':dec(impulse),'normalMps':initial,'normalComplementarityMps':complementarity_residual(initial,dec(impulse)),'tangentSpeedMps':tangent_speed(old,a0,b0)}
                    trajectory = []
                    for j in range(index+1,end+1):
                        later_meta = frames[j]['metadata']
                        a1,b1 = (decoded[j][name] for name in pair)
                        held = normal_velocity(old,a1,b1)
                        translated = make_row(point['pointM'],meta['hit']['normalAtoB'],a1['positionM'],b1['positionM'])
                        translated_u = normal_velocity(translated,a1,b1)
                        trajectory.append({'frame':j,'phase':later_meta['phase'],'workPair':later_meta['pair'],'pass':later_meta['pass'],'heldNormalMps':held,'heldVelocityDeltaMps':held-initial,'translatedNormalMps':translated_u,'armTranslationTermMps':translated_u-held,'heldComplementarityMps':complementarity_residual(held,dec(impulse)),'translatedTangentSpeedMps':tangent_speed(translated,a1,b1),'reopenedHeld':initial>=-BAND and held < -BAND,'existingClosingIncreased':initial < -BAND and held < initial-BAND})
                    refreshed = None
                    if fresh and point_id in fresh_points and fresh['hit']:
                        a1,b1 = (decoded[next_index][name] for name in pair)
                        new = make_row(fresh_points[point_id]['pointM'],fresh['hit']['normalAtoB'],a1['positionM'],b1['positionM'])
                        terms = decomposition(old,new,a0,b0,a1,b1)
                        PHASE.require(abs(terms['identityError'])<=LIMIT,'row decomposition identity unresolved',frame=next_index,point=point_id)
                        refreshed = {'frame':next_index,'pair':pair,'fromPass':meta['pass'],'toPass':fresh['pass'],'pointID':point_id,**terms}
                    return {'local':local,'trajectory':trajectory,'refresh':refreshed}
            low,high = calculate(80),calculate(120)
            agrees(low,high)
            local_rows.append(high['local'])
            transitions.append({'responseFrame':index,'pair':pair,'pass':meta['pass'],'pointID':point_id,'frames':high['trajectory']})
            if high['refresh']: refreshes.append(high['refresh'])
    PHASE.require(selected_count==16,'selected pair/pass coverage differs',graph=graph)
    all_transitions=[{'responseFrame':r['responseFrame'],'responsePair':r['pair'],'responsePass':r['pass'],'pointID':r['pointID'],**v} for r in transitions for v in r['frames']]
    reopenings=[r for r in all_transitions if r['reopenedHeld']]
    for r in all_transitions:
        if r['phase'] in ('after-position','projection-before','projection-after','pair-before','pass-end'):
            previous=next(t for t in transitions if t['responseFrame']==r['responseFrame'] and t['pointID']==r['pointID'])['frames']
            pos=next(k for k,v in enumerate(previous) if v['frame']==r['frame'])
            prior=previous[pos-1]['heldNormalMps'] if pos else next(x['normalMps'] for x in local_rows if x['frame']==r['responseFrame'] and x['pointID']==r['pointID'])
            PHASE.require(abs(r['heldNormalMps']-prior)<=LIMIT,'held row changed at a phase with no velocity update',frame=r['frame'],point=r['pointID'])
    return {'graph':graph,'selectedPairVisits':selected_count,'localRows':local_rows,'heldTrajectories':transitions,'refreshedRows':refreshes,'unmatchedRows':unmatched,'reopenings':reopenings,'largestHeldChanges':sorted(all_transitions,key=lambda r:abs(r['heldVelocityDeltaMps']),reverse=True)[:12],'largestGeometryTerms':sorted(refreshes,key=lambda r:abs(r['geometryTerm']),reverse=True)[:12],'sourceTraceRawSha256':case['traceRawSha256'],'positionOnlyHeldRowInvariant':True,'decimalPrecisionResolved':True}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('output');args=parser.parse_args()
    output=Path(args.output).resolve();output.mkdir(parents=True,exist_ok=True)
    try:
        manifest=read(INPUT/'manifest.json')
        for row in manifest['files']:
            PHASE.require(digest((INPUT/row['path']).read_bytes())==row['sha256'],'immutable native input hash differs',file=row['path'])
        original=read(INPUT/'analysis.json.gz');PHASE.require(original['diagnosticValid'] is True and original['physicalModelGO'] is False,'validated phase receipt absent')
        results=[analyze_graph(INPUT,graph) for graph in PHASE.GRAPHS]
        normalized=[{k:v for k,v in result.items() if k!='graph'} for result in results]
        PHASE.require(normalized[0]==normalized[1]==normalized[2],'residual source/repeat/compiled parity mismatch')
        named=results[0]['largestHeldChanges']
        result={'result':'PASS' if named else 'INCONCLUSIVE','diagnosticValid':True,'physicalModelGO':False,'inputNative':'d2aec4d564a7fb835bc902ac62fce74af9999bbf','inputAdoption':'4f6a8ce1cf51b1cd671b4fb8274db4fca7f827e4','measuredHead':__import__('subprocess').check_output(['git','rev-parse','HEAD'],cwd=HERE,text=True).strip(),'decimalPrecisions':[80,120],'absoluteAgreement':'1e-25','classificationBandMps':'1e-10','graphParity':True,'results':results,'limits':['Recorded point-ID match does not certify geometric feature identity.','Held normal impulse is its recorded response-end value; later complementarity is a row observable, not a force certificate.','This is original1197OFFSETstep15 only, not guarded1204 causal evidence.','No new world/solver/quality/refinement/cost/Chrome/Viewer flow.']}
        status=0
    except (PHASE.InvalidDiagnostic,ValueError,KeyError,TypeError,OSError) as error:
        result={'result':'INVALID','diagnosticValid':False,'physicalModelGO':False,'firstFailure':{'message':str(error),**getattr(error,'location',{})}};status=1
    raw=json.dumps(serial(result),indent=2,allow_nan=False).encode();(output/'analysis.json.gz').write_bytes(gzip.compress(raw,mtime=0))
    print(json.dumps({'result':result['result'],'diagnosticValid':result['diagnosticValid'],'firstFailure':result.get('firstFailure'),'analysisPath':str(output/'analysis.json.gz')}))
    return status
if __name__=='__main__':raise SystemExit(main())
