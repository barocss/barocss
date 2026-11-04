"""One fixed20-row independent audit; new acceptance needs exact face proof, not legacy refusal parity."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
PURE = HOME/'repair-oracle.py'
BANK = ROOT/'examples/physics-box-contact-features-2276/cases.json'
if hashlib.sha256(PURE.read_bytes()).hexdigest() != '657ed9f3c6f97468ca6d905eae9471e406f68e35b60ec6c8056f85826524068d':
    raise RuntimeError('immutable exact repair reference pin')
if hashlib.sha256(BANK.read_bytes()).hexdigest() != '97623de2d6a8795384d6985d4415579e9b6ef7410cdd90be1facdd5d9740af83':
    raise RuntimeError('immutable known20-case bank pin')
spec = importlib.util.spec_from_file_location('unchanged_exact_repair_primitives',PURE)
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)
CASES = json.loads(BANK.read_bytes())['cases']


def same(a,b):
    if type(a) in (int,float) and type(b) in (int,float):
        return struct.pack('<d',R.number(a)) == struct.pack('<d',R.number(b))
    if type(a) is not type(b):
        return False
    if type(a) is dict:
        return list(a) == list(b) and all(same(a[key],b[key]) for key in a)
    if type(a) is list:
        return len(a) == len(b) and all(same(x,y) for x,y in zip(a,b))
    return a == b


def geometry_value(value):
    return None if value is None else {key:item for key,item in value.items() if key != 'conditioning'}


def stats(value,limits):
    for field,bound in (('rationalOperations',limits['rationalOperations']),
                        ('integerOperations',limits['integerOperations']),('peakIntegerBits',limits['integerBits'])):
        actual = R.number(value[field])
        R.need(actual.is_integer() and 0 < actual <= bound,'positive unchanged native work budget '+field)


def verify(data):
    R.need(data['mode'] == 'bank' and len(CASES) == 20,'fixed bank mode')
    rows,limits = data['rows'],data['limits']
    R.need(type(rows) is list and len(rows) == 20,'all known20 rows received')
    R.need(limits == {'rationalOperations':200000,'integerOperations':2000000,'integerBits':16384,'roundingSteps':16},'unchanged limits')
    old_successes,retained_refusals,resolutions,saved_rows = 0,0,[],0
    evidence = []
    for index,(row,case) in enumerate(zip(rows,CASES)):
        R.need(row['caseId'] == case['id'],'fixed bank order/identity')
        for side,original in (('left',case['a']),('right',case['b'])):
            body = row[side]
            R.need(body['id'] == original['id'] and same(body['positionM'],original['positionM']) and
                   same(body['orientation'],original['orientationXYZW']) and
                   same(body['shape'],{'kind':'box','halfExtentsM':original['halfExtentsM']}), 'actual bank pose/extent provenance')
        old,new = row['old'],row['candidate']
        old_error,new_error = old['error'],new['error']
        if old_error is None:
            R.need(new_error is None and same(geometry_value(old['value']),geometry_value(new['value'])),
                   'all old successful geometry words retained '+case['id'])
            old_successes += 1
            evidence.append({'caseId':case['id'],'classification':'OLD_SUCCESS_WORDS_PRESERVED'})
        elif old_error.get('code') != 'NUMERIC_LIMIT' or new_error is not None:
            R.need(same(old_error,new_error),'invalid or retained refusal changed '+case['id'])
            retained_refusals += 1
            evidence.append({'caseId':case['id'],'classification':'ORIGINAL_REFUSAL_RETAINED','oldRefusal':old_error})
        else:
            geometry,trace,proof = new['value'],new['trace'],row['resolutionProof']
            R.need(type(geometry) is dict and geometry['family'] == 'face','no unexplained edge acceptance')
            R.need(type(trace) is dict and type(proof) is dict,'actual trace and native certificate required')
            R.need(same(trace['a'],row['left']) and same(trace['b'],row['right']) and
                   same(trace['selection'],geometry['selection']) and same(trace['normal'],geometry['planeNormalAtoB']),
                   'actual pre-correction input/selection provenance')
            points,originals = geometry['points'],trace['originals']
            R.need(1 <= len(points) <= 4 and len(points) == len(originals) == len(proof['checks']), 'same actual retained rows')
            R.need(proof['limits'] == limits,'native same limits')
            stats(proof['stats'],limits)
            conditioning = geometry['conditioning']
            R.need(conditioning['strictLineCertified'] is True and 0 <= conditioning['boundaryRoundingMaximumSteps'] <= 16,
                   'same16 correction placements')
            stats({'rationalOperations':conditioning['exactRationalOperations'],'integerOperations':conditioning['exactIntegerOperations'],
                   'peakIntegerBits':conditioning['exactPeakIntegerBits']},limits)
            point_certificates = []
            for point,original,native in zip(points,originals,proof['checks']):
                R.need(point['key'] == original['key'] == native['key'],'same actual point key/order')
                R.need(all(value is True for key,value in native.items() if key != 'key'),'unchanged actual native predicates')
                exact = R.certify({'a':row['left'],'b':row['right'],'normal':geometry['planeNormalAtoB']},
                                  point,trace['faceA'],trace['faceB'],original)
                R.need(all(exact['predicates'].values()),'independent exact new resolution predicates '+case['id'])
                point_certificates.append({'key':point['key'],'predicates':exact['predicates'],
                    'normalizedPhysicalSlabsNonempty':exact['models'][0]['eachBoxLineNonempty'],
                    'representedSlabsNonempty':exact['models'][1]['eachBoxLineNonempty'],
                    'slabEpsilon':0,'movementWithin1eMinus12M':exact['predicates']['movement']})
            item = {'caseId':case['id'],'classification':'PRESERVED_OLD_NUMERIC_REFUSAL_WITH_NEW_EXACT_FACE_RESOLUTION',
                    'oldRefusal':old_error,'points':point_certificates,'sameWorkLimits':True}
            resolutions.append(item);evidence.append(item)
        if case.get('populationGroup') == 'original-P4-32':
            R.need(new_error is None and new['value'] is not None,'saved original32 still successful')
            points = new['value']['points']
            R.need(len(points) == len(case['expectedOriginalPoints']),'saved32 population')
            for expected in case['expectedOriginalPoints']:
                matches = [point for point in points if point['key'] == expected['id']]
                R.need(len(matches) == 1 and same(matches[0]['midpointM'],expected['pointM']),'saved32 exact midpoint word '+expected['id'])
                saved_rows += 1
    R.need(saved_rows == 32,'all saved32 midpoint rows')
    return {'ok':True,'resolved':True,'executionFailure':False,'status':'BANK_NEW_FACE_RESOLUTIONS_CERTIFIED',
            'knownCases':20,'oldSuccessfulCases':old_successes,'retainedRefusals':retained_refusals,
            'newFaceResolutions':len(resolutions),'savedRawMidpointRows':saved_rows,'evidence':evidence,
            'oldEdgeWordsPreserved':True,'newEdgeAcceptanceAllowed':False,'candidateImports':0,'worldCalls':0,
            'normalSolverCalls':0,'positionSolverCalls':0,'criteriaRelaxed':False}


def main():
    try:
        raw = sys.stdin.buffer.readline(R.LIMIT+1)
        R.need(0 < len(raw) <= R.LIMIT and raw.endswith(b'\n') and sys.stdin.buffer.read(1) == b'','one bounded bank request+EOF')
        packet = json.loads(raw)
        R.need(packet['format'] == 'repair-479-v1','bank format')
        response = verify(R.restore(packet['data'],packet['numericWordsF64leHex']))
    except (R.Invalid,KeyError,TypeError,ValueError,IndexError,OverflowError,ZeroDivisionError) as error:
        response = {'ok':False,'resolved':False,'executionFailure':True,'status':'BANK_CERTIFICATE_NO_GO','reason':str(error)}
    encoded = json.dumps(response,separators=(',',':'),allow_nan=False)
    R.need(len(encoded.encode()) <= 65536,'64KiB bank reply cap')
    print(encoded)


if __name__ == '__main__':
    main()
