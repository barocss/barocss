"""Exact Fraction rank controls and independent actual solved-line IGES reader."""
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys

UTIL=Path(__file__).with_name('read-derivatives-ocp.py')
h=runpy.run_path(str(UTIL));require=h['require']


def rank(rows):
    if not rows:return 0
    a=[[Fraction(str(x)) for x in row] for row in rows];pivot=0
    for column in range(len(a[0])):
        selected=next((i for i in range(pivot,len(a)) if a[i][column]),None)
        if selected is None:continue
        a[pivot],a[selected]=a[selected],a[pivot];scale=a[pivot][column];a[pivot]=[x/scale for x in a[pivot]]
        for i in range(len(a)):
            if i!=pivot and a[i][column]:
                scale=a[i][column];a[i]=[x-scale*y for x,y in zip(a[i],a[pivot])]
        pivot+=1
        if pivot==len(a):break
    return pivot


def equations(document):
    require(2<=len(document['points'])<=16 and 1<=len(document['segments'])<=8 and len(document['constraints'])<=32,'Rank oracle input exceeds bounded subset')
    ids={p['id']:i for i,p in enumerate(document['points'])};segments={s['id']:s for s in document['segments']};n=len(ids)*2;rows=[];values=[];redundant=[]
    for constraint in document['constraints']:
        before=rank(rows);kind=constraint['kind'];add=[]
        if kind in ('horizontal','vertical'):
            segment=segments[constraint['segmentId']];axis=1 if kind=='horizontal' else 0;add=[(segment['startPointId'],segment['endPointId'],axis,0)]
        elif kind=='coincident':add=[(constraint['pointA'],constraint['pointB'],axis,0) for axis in (0,1)]
        elif kind=='fixed':add=[(constraint['pointId'],None,axis,constraint['target'][axis]) for axis in (0,1)]
        else:raise AssertionError('Rank oracle unsupported constraint')
        for first,second,axis,target in add:
            row=[0]*n;row[ids[first]*2+axis]=1
            if second is not None:row[ids[second]*2+axis]=-1
            rows.append(row);values.append(target)
        if rank(rows)==before:redundant.append(constraint['id'])
    return rows,values,rank(rows),rank([row+[value] for row,value in zip(rows,values)]),redundant


def pointer_guard(filename,mappings):
    lines=filename.read_text().splitlines();require(1<=len(lines)<=4096 and all(len(line)==80 for line in lines),'Linear sketch load comparison failed: records')
    ds=[line for line in lines if line[72]=='D'];ps=[line for line in lines if line[72]=='P'];require(len(ds)==len(mappings)*2,'Linear sketch load comparison failed: directory count');valid=True
    for index,mapping in enumerate(mappings):
        owner=mapping['directoryPointer'];rows=[line for line in ps if int(line[64:72])==owner]
        valid=valid and owner==index*2+1 and int(ds[index*2][8:16])==mapping['parameterPointer'] and len(rows)==mapping['parameterRecords'] and int(rows[0][73:])==mapping['parameterPointer']
        fields=[int(value.strip()) for value in ''.join(row[:64] for row in rows).replace(';',',').split(',')[:7]]
        require(fields==[126,1,1,0,0,1,0],'Original selected line general/open/polynomial/nonperiodic flags changed')
    return valid


def load(filename,count):
    reader=h['IGESControl_Reader']();settings={'xstep.cascade.unit':'MM','read.iges.bspline.continuity':0,'read.precision.mode':0,'read.iges.faulty.entities':0,'read.surfacecurve.mode':0,'read.iges.sequence':''}
    for key,value in settings.items():
        success=h['Interface_Static'].SetCVal_s(key,value) if isinstance(value,str) else h['Interface_Static'].SetIVal_s(key,value);actual=h['Interface_Static'].CVal_s(key) if isinstance(value,str) else h['Interface_Static'].IVal_s(key);require(success and actual==value,'Installed sketch reader setting unavailable: '+key)
    status=reader.ReadFile(str(filename));check=h['diagnostics'](reader.WS().ModelCheckList(True));require(status==h['IFSelect_RetDone'] and not check['failures'] and not check['warnings'],'Linear sketch load comparison failed: '+str(check))
    model=reader.IGESModel();require(model.NbEntities()==count and all(model.Entity(i).TypeNumber()==126 for i in range(1,count+1)),'Linear sketch actual entity count/type changed');gs=model.GlobalSection();require(gs.UnitFlag()==2 and gs.UnitName().ToCString().strip().upper()=='MM' and gs.Scale()==1,'Linear sketch units changed')
    require(reader.NbRootsForTransfer()==count,'Linear sketch load comparison failed: roots');transfers=[]
    for i in range(1,count+1):
        require(reader.TransferOneRoot(i),'Linear sketch load comparison failed: transfer');check=h['diagnostics'](reader.WS().TransferReader().LastCheckList());require(not check['failures'] and not check['warnings'],'Linear sketch load comparison failed: transfer diagnostics');transfers.append(check)
    require(reader.NbShapes()==count,'Linear sketch transferred shape count changed');adapters=[]
    for index in range(count):
        shape=reader.Shape(index+1);require(shape.Location().IsIdentity(),'Linear sketch unexpected placement');explorer=h['TopExp_Explorer'](shape,h['TopAbs_EDGE']);require(explorer.More(),'Linear sketch transferred edge missing');adapter=h['BRepAdaptor_Curve'](h['TopoDS'].Edge(explorer.Current()));explorer.Next();require(not explorer.More(),'Linear sketch extra edge');require(adapter.GetType()==h['GeomAbs_BSplineCurve'],'Original line B-spline type changed');adapters.append(adapter)
    return reader,adapters,{'readStatus':str(status),'roots':count,'entities':count,'loadDiagnostics':h['diagnostics'](reader.WS().ModelCheckList(True)),'transferDiagnostics':transfers,'settings':settings,'units':'MM','modelScale':1}


def compare(adapters,fixture):
    checks=[]
    for index,line in enumerate(fixture['lines']):
        adapter=adapters[index];require([adapter.FirstParameter(),adapter.LastParameter()]==[0,1],'Original line parameter domain changed');spline=adapter.BSpline();direction=h['spline_direction'](spline,False);require(direction['degree']==1 and direction['expandedKnots']==[0,0,1,1],'Original line degree/knots changed');a,b=line['authoredPoles'];expected_derivative=[y-x for x,y in zip(a,b)];rows=[];maxpoint=maxderivative=0
        for sample in line['samples']:
            expected=[x+sample['parameter']*d for x,d in zip(a,expected_derivative)];require(math.dist(sample['point'],expected)<=1e-9,'Native/analytic solved-line point mismatch');h['compare'](sample['derivative'],expected_derivative,1e-9,'Native/analytic solved-line derivative mismatch');point,vector=h['gp_Pnt'](),h['gp_Vec']();adapter.D1(sample['parameter'],point,vector);actual,derivative=h['xyz'](point),h['xyz'](vector);error=math.dist(actual,expected);require(error<=1e-7,'Linear sketch geometry comparison failed: shifted solved line '+str(error));_,scaled=h['compare'](derivative,expected_derivative,1e-7,'Linear sketch derivative comparison failed');maxpoint=max(maxpoint,error);maxderivative=max(maxderivative,scaled);rows.append({'parameter':sample['parameter'],'point':actual,'derivative':derivative,'analyticPoint':expected,'analyticDerivative':expected_derivative})
        require(spline.NbPoles()==2 and [h['xyz'](spline.Pole(i)) for i in (1,2)]==line['authoredPoles'] and [spline.Weight(i) for i in (1,2)]==[1,1],'Original solved line poles/weights changed');checks.append({'id':line['id'],'index':index,'domain':[0,1],'degreeKnots':direction,'sampleCount':len(rows),'samples':rows,'maxPointDeviationMM':maxpoint,'maxDerivativeScaledDeviation':maxderivative})
    return checks


def main():
    output=Path(sys.argv[1]).resolve();mode=sys.argv[2] if len(sys.argv)>2 else '';require(mode in ('','--bad-pointer','--shifted-line'),'Unknown linear sketch control');manifest=json.loads((output/'manifest.json').read_text(),parse_int=float);require(len(manifest['fixtures'])==7,'Seven bounded solve controls required');results=[]
    for index,fixture in enumerate(manifest['fixtures']):
        for key,relative in fixture['files'].items():
            filename=(output/relative).resolve();require(filename.is_relative_to(output),'Sketch evidence path escaped');require(hashlib.sha256(filename.read_bytes()).hexdigest()==fixture['hashes'][key],'Sketch original '+key+' hash mismatch')
        document=fixture['document'];rows,values,coefficient_rank,augmented_rank,redundant=equations(document);n=len(document['points'])*2
        require(coefficient_rank==augmented_rank,'Successful sketch is mathematically inconsistent');report=fixture['report'];require(report=={'degreesOfFreedom':n-coefficient_rank,'rank':coefficient_rank,'fullyConstrained':coefficient_rank==n,'redundantConstraintIds':redundant},'Exact Fraction matrix rank/redundancy disagrees with actual solver')
        solved=fixture['solution']['points'];require([p['id'] for p in solved]==[p['id'] for p in document['points']],'Solved point identity/order changed');coordinates=[value for point in solved for value in point['position']]
        residuals=[sum(Fraction(str(x))*Fraction(str(y)) for x,y in zip(row,coordinates))-Fraction(str(target)) for row,target in zip(rows,values)];require(all(value==0 for value in residuals),'Solved equality residual is not exactly zero');require([p['position'] for p in solved]==fixture['expectedPoints'],'Independent authored solved coordinates changed')
        require(fixture['sourceVersion']==0 and fixture['geometryVersion']==0 and fixture['irSchemaVersion']==1,'Sketch source/IR/native versions changed');filename=output/fixture['files']['iges'];mappings=fixture['exportReport']['objects'];require(pointer_guard(filename,mappings),'Linear sketch load comparison failed: original pointer mapping');require([m['id'] for m in mappings]==[s['id'] for s in document['segments']],'Selected original segment ID mapping changed');reader,adapters,structure=load(filename,len(mappings));checked=compare(adapters,fixture)
        if mode and index==0:
            control=json.loads((output/'negative-files.json').read_text())[mode[2:]];changed=(output/control['file']).resolve();require(changed.is_relative_to(output) and hashlib.sha256(changed.read_bytes()).hexdigest()==control['sha256'] and control['originalSHA256']==fixture['hashes']['iges'],'Sketch changed-file lineage mismatch')
            if mode=='--bad-pointer':
                changed_reader=h['IGESControl_Reader']();status=changed_reader.ReadFile(str(changed));observed={'readStatus':str(status),'loadDiagnostics':h['diagnostics'](changed_reader.WS().ModelCheckList(True)),'pointerValid':pointer_guard(changed,mappings)};(output/'bad-pointer-observed.json').write_text(json.dumps(observed,indent=2)+'\n');require(observed['pointerValid'],'Linear sketch load comparison failed: actual corrupt pointer')
            else:
                require(pointer_guard(changed,mappings),'Readable shifted sketch must preserve pointers');_,altered,observed=load(changed,len(mappings));(output/'shifted-line-observed.json').write_text(json.dumps(observed,indent=2)+'\n');compare(altered,fixture)
            raise AssertionError('Sketch negative unexpectedly passed')
        results.append({'name':fixture['name'],'sourceVersion':0,'geometryVersion':0,'irSchemaVersion':1,'report':report,'exactRankOracle':{'method':'Fraction Gaussian elimination of authored equality rows','variables':n,'equationRows':len(rows),'coefficientRank':coefficient_rank,'augmentedRank':augmented_rank,'redundantConstraintIds':redundant,'exactResiduals':[str(v) for v in residuals]},'structuralRead':structure,'mapping':mappings,'lines':checked,'files':fixture['files'],'hashes':fixture['hashes']})
    require(not mode,'Sketch negative did not reach comparison');failures=[]
    for fixture in manifest['failures']:
        for key,relative in fixture['files'].items():require(hashlib.sha256((output/relative).read_bytes()).hexdigest()==fixture['hashes'][key],'Failed sketch artifact hash mismatch')
        result=fixture['result'];require(result['ok'] is False and set(result)=={'ok','diagnostics'} and fixture['noPartialGeometry'],'Failed sketch must not contain partial Model/source/report');require(result['diagnostics'][0]['code']==fixture['expectedCode'],'Failed sketch diagnostic class changed');rows,values,r,ar,_=equations(fixture['document'])
        if fixture['expectedCode']=='CONFLICT':require(ar>r,'Conflict must have an inconsistent augmented Fraction matrix')
        else:require(r==ar,'Degenerate sketch must remain a consistent equality system')
        failures.append({'name':fixture['name'],'expectedCode':fixture['expectedCode'],'coefficientRank':r,'augmentedRank':ar,'noPartialGeometry':True,'diagnostics':result['diagnostics'],'hashes':fixture['hashes']})
    report={'base':manifest['base'],'head':manifest['head'],'fixtures':results,'failureControls':failures,'readerDependencies':{UTIL.name:hashlib.sha256(UTIL.read_bytes()).hexdigest()},'limits':manifest['limits'],'regionCertified':False,'solid':False,'constraintHistoryInterchange':False};(output/'linear-sketch-readback.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'fixtures':len(results),'entities':sum(len(row['lines']) for row in results),'pointD1Samples':sum(line['sampleCount'] for row in results for line in row['lines']),'failureControls':len(failures)}))


if __name__=='__main__':main()
