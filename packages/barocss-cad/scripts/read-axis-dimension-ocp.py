"""Exact signed affine equation controls and independent original IGES126 bytes."""
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys

PARENT=Path(__file__).with_name('read-linear-sketch-ocp.py')
p=runpy.run_path(str(PARENT));h=p['h'];require=p['require'];rank=p['rank']


def equations(document):
    require(2<=len(document['points'])<=16 and 1<=len(document['segments'])<=8 and len(document['constraints'])<=32,'Axis rank oracle exceeds bounded subset')
    ids={point['id']:i for i,point in enumerate(document['points'])};segments={segment['id']:segment for segment in document['segments']};n=len(ids)*2;rows=[];targets=[];redundant=[]
    for constraint in document['constraints']:
        before=rank(rows);kind=constraint['kind'];add=[]
        if kind in ('horizontal','vertical'):
            segment=segments[constraint['segmentId']];add=[(segment['startPointId'],segment['endPointId'],1 if kind=='horizontal' else 0,0)]
        elif kind=='coincident':add=[(constraint['pointA'],constraint['pointB'],axis,0) for axis in (0,1)]
        elif kind=='fixed':add=[(None,constraint['pointId'],axis,constraint['target'][axis]) for axis in (0,1)]
        elif kind in ('distance-x','distance-y'):add=[(constraint['pointA'],constraint['pointB'],0 if kind=='distance-x' else 1,constraint['distanceMM'])]
        else:raise AssertionError('Axis rank oracle unsupported kind')
        for first,second,axis,target in add:
            row=[0]*n
            if first is not None:row[ids[first]*2+axis]=-1
            row[ids[second]*2+axis]=1
            rows.append(row);targets.append(target)
        if rank(rows)==before:redundant.append(constraint['id'])
    return rows,targets,rank(rows),rank([row+[target] for row,target in zip(rows,targets)]),redundant


def main():
    output=Path(sys.argv[1]).resolve();mode=sys.argv[2] if len(sys.argv)>2 else '';require(mode in ('','--bad-pointer','--wrong-length','--wrong-endpoint'),'Unknown axis dimension control');manifest=json.loads((output/'manifest.json').read_text(),parse_int=float);require(len(manifest['fixtures'])==8,'Eight signed driving cases required');results=[]
    for index,fixture in enumerate(manifest['fixtures']):
        for key,relative in fixture['files'].items():
            filename=(output/relative).resolve();require(filename.is_relative_to(output),'Axis evidence path escaped');require(hashlib.sha256(filename.read_bytes()).hexdigest()==fixture['hashes'][key],'Axis original '+key+' hash mismatch')
        document=fixture['document'];require(document['version']==1,'Axis document1 is distinct from original source0');rows,targets,r,ar,redundant=equations(document);n=len(document['points'])*2;require(r==ar,'Successful signed dimension equations inconsistent')
        solved=fixture['solution']['points'];coordinates=[x for point in solved for x in point['position']];residuals=[sum(Fraction(str(x))*Fraction(str(y)) for x,y in zip(row,coordinates))-Fraction(str(target)) for row,target in zip(rows,targets)];require(all(x==0 for x in residuals),'Signed B-A=d residual is not exactly0');require([point['position'] for point in solved]==fixture['expectedPoints'],'Independent authored axis solution changed');report=fixture['report'];require({key:report[key] for key in ('degreesOfFreedom','rank','fullyConstrained','redundantConstraintIds')}=={'degreesOfFreedom':n-r,'rank':r,'fullyConstrained':n==r,'redundantConstraintIds':redundant},'Fraction signed coefficient rank/redundancy differs from solver')
        pointmap={point['id']:point['position'] for point in solved};dimensions=[]
        for constraint in document['constraints']:
            if constraint['kind'] not in ('distance-x','distance-y'):continue
            axis=0 if constraint['kind']=='distance-x' else 1;actual=pointmap[constraint['pointB']][axis]-pointmap[constraint['pointA']][axis];require(actual==constraint['distanceMM'],'Solved actual signed dimension differs from authored target');dimensions.append({'id':constraint['id'],'axis':'x' if axis==0 else 'y','pointA':constraint['pointA'],'pointB':constraint['pointB'],'requestedMM':constraint['distanceMM'],'actualMM':actual})
        require(report['dimensions']==dimensions,'Actual driving report order/values differ from returned solved points')
        for authored,reported in zip([c for c in document['constraints'] if c['kind'] in ('distance-x','distance-y')],report['dimensions']):require(math.copysign(1,authored['distanceMM'])==math.copysign(1,reported['requestedMM']),'Requested signed-zero authoring bits changed')
        filename=output/fixture['files']['iges'];mappings=fixture['exportReport']['objects'];require(p['pointer_guard'](filename,mappings),'Axis dimension load comparison failed: original pointers');require([m['id'] for m in mappings]==[segment['id'] for segment in document['segments']],'Signed dimension original selected ID order changed');reader,adapters,structure=p['load'](filename,len(mappings));checks=p['compare'](adapters,fixture)
        observed_points={}
        for segment,adapter in zip(document['segments'],adapters):
            for point_id,parameter in ((segment['startPointId'],0),(segment['endPointId'],1)):
                point=h['xyz'](adapter.Value(parameter))
                if point_id in observed_points:require(math.dist(point,observed_points[point_id])<=1e-7,'Axis dimension geometry comparison failed: repeated endpoint association')
                observed_points[point_id]=point
        observed_dimensions=[]
        for dimension in dimensions:
            axis=0 if dimension['axis']=='x' else 1;actual=observed_points[dimension['pointB']][axis]-observed_points[dimension['pointA']][axis];require(abs(actual-dimension['requestedMM'])<=1e-7,'Axis dimension geometry comparison failed: actual reader signed distance');observed_dimensions.append({**dimension,'readerActualMM':actual})
        if mode and index==0:
            control=json.loads((output/'negative-files.json').read_text())[mode[2:]];changed=(output/control['file']).resolve();require(changed.is_relative_to(output) and hashlib.sha256(changed.read_bytes()).hexdigest()==control['sha256'] and control['originalSHA256']==fixture['hashes']['iges'],'Axis corrupt byte lineage changed')
            if mode=='--bad-pointer':
                changed_reader=h['IGESControl_Reader']();status=changed_reader.ReadFile(str(changed));observed={'readStatus':str(status),'loadDiagnostics':h['diagnostics'](changed_reader.WS().ModelCheckList(True)),'pointerValid':p['pointer_guard'](changed,mappings)};(output/'bad-pointer-observed.json').write_text(json.dumps(observed,indent=2)+'\n');require(observed['pointerValid'],'Axis dimension load comparison failed: corrupted pointer')
            else:
                require(p['pointer_guard'](changed,mappings),'Readable wrong axis line must preserve pointers');_,altered,observed=p['load'](changed,len(mappings));(output/(mode[2:]+'-observed.json')).write_text(json.dumps(observed,indent=2)+'\n');p['compare'](altered,fixture)
            raise AssertionError('Axis dimension negative unexpectedly passed')
        results.append({'name':fixture['name'],'documentVersion':1,'sourceVersion':0,'irSchemaVersion':1,'geometryVersion':0,'report':report,'exactRankOracle':{'method':'Fraction Gaussian signed B-A=d rows','variables':n,'equationRows':len(rows),'coefficientRank':r,'augmentedRank':ar,'redundantConstraintIds':redundant,'exactResiduals':[str(x) for x in residuals]},'structuralRead':structure,'mapping':mappings,'lines':checks,'readerDimensions':observed_dimensions,'files':fixture['files'],'hashes':fixture['hashes']})
    require(not mode,'Axis negative did not reach actual comparison');failures=[]
    for fixture in manifest['failures']:
        for key,relative in fixture['files'].items():require(hashlib.sha256((output/relative).read_bytes()).hexdigest()==fixture['hashes'][key],'Axis failure artifact hash mismatch')
        result=fixture['result'];require(result['ok'] is False and set(result)=={'ok','diagnostics'} and fixture['noPartialGeometry'],'Axis failure must contain no partial Model/source/report');require(result['diagnostics'][0]['code']==fixture['expectedCode'],'Axis diagnostic class changed');_,_,r,ar,_=equations(fixture['document'])
        if fixture['expectedCode']=='CONFLICT':require(ar>r,'Affine cycle/anchor conflict needs inconsistent augmented Fraction rank')
        else:require(ar==r,'Unsupported/degenerate family must remain mathematically consistent')
        failures.append({'name':fixture['name'],'expectedCode':fixture['expectedCode'],'coefficientRank':r,'augmentedRank':ar,'noPartialGeometry':True,'diagnostics':result['diagnostics'],'hashes':fixture['hashes']})
    report={'base':manifest['base'],'head':manifest['head'],'fixtures':results,'failureControls':failures,'readerDependencies':{PARENT.name:hashlib.sha256(PARENT.read_bytes()).hexdigest(),'read-derivatives-ocp.py':hashlib.sha256(p['UTIL'].read_bytes()).hexdigest()},'limits':manifest['limits'],'regionCertified':False,'solid':False,'dimensionHistoryInterchange':False};(output/'axis-dimension-readback.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'fixtures':len(results),'entities':sum(len(row['lines']) for row in results),'pointD1Samples':sum(line['sampleCount'] for row in results for line in row['lines']),'failureControls':len(failures)}))


if __name__=='__main__':
    try:main()
    except AssertionError as error:raise AssertionError(str(error).replace('Linear sketch','Axis dimension')) from error
