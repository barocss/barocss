"""Exact Fraction simple-ring proof plus actual original closed-coordinate IGES."""
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys

PARENT=Path(__file__).with_name('read-xy-profile-ocp.py')
p=runpy.run_path(str(PARENT));h=p['h'];require=p['require']


def orientation(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def on_segment(a,b,c):return orientation(a,b,c)==0 and all(min(a[k],b[k])<=c[k]<=max(a[k],b[k]) for k in (0,1))

def simple_oracle(raw):
    points=[tuple(Fraction(str(x)) for x in point) for point in raw];n=len(points)
    require(3<=n<=63,'Independent region vertex ceiling');require(all(len(point)==2 and all(x.denominator==1 and abs(x)<=10000 for x in point) for point in points),'Independent exact integer XY family')
    if len(set(points))!=n:return {'valid':False,'reason':'duplicate vertices','pairs':[]}
    bad=[];maxdet=Fraction(0)
    for i in range(n):
        a,b=points[i],points[(i+1)%n]
        if a==b:return {'valid':False,'reason':'zero segment','pairs':[]}
        for j in range(i+1,n):
            c,d=points[j],points[(j+1)%n];det=[orientation(a,b,c),orientation(a,b,d),orientation(c,d,a),orientation(c,d,b)];maxdet=max(maxdet,*[abs(x) for x in det]);require(maxdet<=800000000,'Exact determinant bound exceeded')
            proper=det[0]*det[1]<0 and det[2]*det[3]<0;touch=any((on_segment(a,b,c),on_segment(a,b,d),on_segment(c,d,a),on_segment(c,d,b)));intersection=proper or touch;adjacent=j==i+1 or (i==0 and j==n-1)
            collinear=all(x==0 for x in det);axis=0 if a[0]!=b[0] else 1;overlap=collinear and min(max(a[axis],b[axis]),max(c[axis],d[axis]))>max(min(a[axis],b[axis]),min(c[axis],d[axis]))
            if intersection and (not adjacent or overlap):bad.append({'segments':[i,j],'parameterRanges':[[i,i+1],[j,j+1]],'kind':'overlap' if overlap else 'cross' if proper else 'touch'})
    total=sum(points[i][0]*points[(i+1)%n][1]-points[(i+1)%n][0]*points[i][1] for i in range(n));require(abs(total)<=12600000000,'Exact shoelace aggregate bound exceeded')
    return {'valid':not bad and total!=0,'pairs':bad,'pairCount':n*(n-1)//2,'maxOrientationMagnitude':int(maxdet),'signedDoubleArea':int(total),'signedAreaMM2':float(total/2),'areaMM2':float(abs(total)/2),'orientation':'ccw' if total>0 else 'cw','boundsMM':{'min':[float(min(x[k] for x in points)) for k in (0,1)]+[0],'max':[float(max(x[k] for x in points)) for k in (0,1)]+[0]}}


def main():
    output=Path(sys.argv[1]).resolve();mode=sys.argv[2] if len(sys.argv)>2 else '';require(mode in ('','--bad-pointer','--changed-vertex'),'Unknown polygon control');manifest=json.loads((output/'manifest.json').read_text(),parse_int=float);require(len(manifest['fixtures'])==7,'Seven exact polygon controls required');results=[]
    for index,fixture in enumerate(manifest['fixtures']):
        for key,relative in fixture['files'].items():
            filename=(output/relative).resolve();require(filename.is_relative_to(output),'Polygon evidence path escaped');require(hashlib.sha256(filename.read_bytes()).hexdigest()==fixture['hashes'][key],'Polygon original '+key+' hash mismatch')
        points=fixture['authoredPoints'];n=len(points);oracle=simple_oracle(points);require(oracle['valid'],'Independent Fraction ring is not simple');region=fixture['region'];expected={'valid':True,'geometryFamily':'exact-simple-integer-xy-polygon-v0','lengthUnit':'mm','regionCertified':True,'topologicalWire':False,'face':False,'solid':False,'orientation':oracle['orientation'],'vertexCount':n,'segmentCount':n,'parameterDomain':{'min':0,'max':n},'signedAreaMM2':oracle['signedAreaMM2'],'areaMM2':oracle['areaMM2'],'boundsMM':oracle['boundsMM'],'edges':[{'segmentIndex':i,'parameterRange':[i,i+1],'startVertexIndex':i,'endVertexIndex':(i+1)%n} for i in range(n)]};require(region==expected,'Exact Fraction simple-region area/bounds/ranges disagree with API')
        require(fixture['sourceVersion']==0 and fixture['geometryVersion']==0 and fixture['domain']==[0,n],'Polygon source/native/domain changed');filename=output/fixture['files']['iges'];valid,flags=p['records'](filename);require(valid and flags==[126,n,1,0,0,1,0],'Polygon original general/open/polynomial/nonperiodic flags changed');baseline=h['read_fixture'](output,fixture,'');reader,adapter,structure=p['raw_adapter'](filename);spline=adapter.BSpline();require([adapter.FirstParameter(),adapter.LastParameter()]==[0,n],'Polygon original parameter domain changed');poles=[h['xyz'](spline.Pole(i)) for i in range(1,spline.NbPoles()+1)];require(poles==fixture['authoredPoles'] and [spline.Weight(i) for i in range(1,spline.NbPoles()+1)]==[1]*(n+1),'Polygon original pole order/weights changed')
        maxpoint=0
        for sample in fixture['positionSamples']:
            a,b=fixture['authoredPoles'][int(sample['span']):int(sample['span'])+2];expected_point=[x+sample['t']*(y-x) for x,y in zip(a,b)];actual=h['xyz'](adapter.Value(sample['parameter']));error=math.dist(actual,expected_point);require(error<=1e-7,'Polygon region geometry comparison failed: actual span endpoint/interior '+str(error));maxpoint=max(maxpoint,error)
        mapping=fixture['exportMapping'];require(mapping['id']==fixture['id'] and mapping['entity']==126 and mapping['directoryPointer']==mapping['parameterPointer']==1,'Polygon explicit original ID/DE association changed');require([sample['parameter'] for sample in fixture['c0Refusals']]==list(range(1,n)),'Polygon exact C0 refusal set changed')
        if mode and index==0:
            control=json.loads((output/'negative-files.json').read_text())[mode[2:]];changed=(output/control['file']).resolve();require(changed.is_relative_to(output) and hashlib.sha256(changed.read_bytes()).hexdigest()==control['sha256'] and control['originalSHA256']==fixture['hashes']['iges'],'Polygon actual corrupt byte lineage changed')
            if mode=='--bad-pointer':
                changed_reader=h['IGESControl_Reader']();status=changed_reader.ReadFile(str(changed));observed={'readStatus':str(status),'loadDiagnostics':h['diagnostics'](changed_reader.WS().ModelCheckList(True)),'pointerValid':p['records'](changed)[0]};(output/'bad-pointer-observed.json').write_text(json.dumps(observed,indent=2)+'\n');require(observed['pointerValid'],'Polygon region load comparison failed: actual corrupted pointer')
            else:
                require(p['records'](changed)==(valid,flags),'Readable wrong polygon must preserve flags and pointers');_,altered,observed=p['raw_adapter'](changed);(output/'changed-vertex-observed.json').write_text(json.dumps(observed,indent=2)+'\n')
                for sample in fixture['positionSamples']:
                    actual=h['xyz'](altered.Value(sample['parameter']));require(math.dist(actual,sample['analyticPoint'])<=1e-7,'Polygon region geometry comparison failed: readable changed vertex')
            raise AssertionError('Polygon negative unexpectedly passed')
        baseline.update({'region':region,'exactRegionOracle':oracle,'positionSampleCount':len(fixture['positionSamples']),'maxSpanPositionDeviationMM':maxpoint,'structuralRead':structure,'originalFlags':{'planar':0,'closed':0,'polynomial':1,'periodic':0},'kernelGeometricClosed':spline.IsClosed(),'kernelPeriodic':spline.IsPeriodic(),'topologicalWireCertified':False,'face':False,'solid':False});results.append(baseline)
    require(not mode,'Polygon negative did not reach its comparison');failures=[]
    for control in manifest['failures']:
        for key,relative in control['files'].items():require(hashlib.sha256((output/relative).read_bytes()).hexdigest()==control['hashes'][key],'Polygon rejected native artifact hash mismatch')
        require(control['status']=='rejected' and control['noPartialRegion'],'Polygon failure must not adopt a region')
        if control['name'].startswith('false-cache'):failures.append({'name':control['name'],'cachedProofRejected':True,'message':control['message'],'hashes':control['hashes']});continue
        raw=control['input']['points'] if control['method']=='builder' else [point[:2] for point in control['input']['controlPoints'][:-1]];oracle=simple_oracle(raw);require(not oracle['valid'],'Rejected native polygon unexpectedly passes independent exact ring oracle');failures.append({'name':control['name'],'exactRejectedOracle':oracle,'message':control['message'],'hashes':control['hashes']})
    recognition=manifest['rectangleRecognition'];require(hashlib.sha256((output/recognition['file']).read_bytes()).hexdigest()==recognition['sha256'],'Legacy rectangle recognition artifact changed');require(recognition['areaMM2']==35 and recognition['unchangedLegacyProfile'],'Separate rectangle validator must preserve original legacy report')
    report={'base':manifest['base'],'head':manifest['head'],'fixtures':results,'nativeFailureControls':failures,'rectangleRecognition':recognition,'readerDependencies':{PARENT.name:hashlib.sha256(PARENT.read_bytes()).hexdigest(),'read-derivatives-ocp.py':hashlib.sha256(p['UTIL'].read_bytes()).hexdigest()},'limits':manifest['limits'],'topologicalWireCertified':False,'face':False,'solid':False};(output/'polygon-region-readback.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'fixtures':len(results),'entities':len(results),'positionSamples':sum(row['positionSampleCount'] for row in results),'d1Samples':sum(row['sampleCount'] for row in results),'nativeRejectedControls':len(failures)}))


if __name__=='__main__':main()
