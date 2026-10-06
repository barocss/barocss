"""Independent rational quarter/circle oracle and actual original IGES126 reader."""
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys

UTIL = Path(__file__).with_name('read-derivatives-ocp.py')
h = runpy.run_path(str(UTIL))
require = h['require']


def oracle(request, quadrant, t):
    # Direct quadratic rational quotient. t is the original span parameter,
    # rather than an angular parameter or a regenerated kernel curve.
    r,w,a = request['radius'], math.sqrt(0.5), 1-t
    d,dd = a*a+2*w*a*t+t*t, -2*a+2*w*(1-2*t)+2*t
    nx,ny = r*(a*a+2*w*a*t),r*(2*w*a*t+t*t)
    dx,dy = r*(-2*a+2*w*(1-2*t)),r*(2*w*(1-2*t)+2*t)
    x,y = nx/d,ny/d
    vx,vy = (dx*d-nx*dd)/(d*d),(dy*d-ny*dd)/(d*d)
    rotations = [(x,y,vx,vy),(-y,x,-vy,vx),(-x,-y,-vx,-vy),(y,-x,vy,-vx)]
    x,y,vx,vy = rotations[quadrant]
    return [request['center'][0]+x,request['center'][1]+y,0],[vx,vy,0]


def load_file(filename):
    reader = h['IGESControl_Reader']()
    settings = {'xstep.cascade.unit':'MM','read.iges.bspline.continuity':0,'read.precision.mode':0,
                'read.iges.faulty.entities':0,'read.surfacecurve.mode':0,'read.iges.sequence':''}
    for key,value in settings.items():
        success = h['Interface_Static'].SetCVal_s(key,value) if isinstance(value,str) else h['Interface_Static'].SetIVal_s(key,value)
        actual = h['Interface_Static'].CVal_s(key) if isinstance(value,str) else h['Interface_Static'].IVal_s(key)
        require(success and actual == value,'Required installed reader setting unavailable: '+key)
    status = reader.ReadFile(str(filename))
    load = h['diagnostics'](reader.WS().ModelCheckList(True))
    require(status == h['IFSelect_RetDone'] and not load['failures'] and not load['warnings'],
            'XY arc load comparison failed: '+str(status)+' '+str(load))
    model = reader.IGESModel()
    require(model.NbEntities() == 1 and model.Entity(1).TypeNumber() == 126,'XY arc load comparison failed: entities')
    gs = model.GlobalSection()
    require(gs.UnitFlag() == 2 and gs.UnitName().ToCString().strip().upper() == 'MM' and gs.Scale() == 1,'XY arc units changed')
    require(reader.NbRootsForTransfer() == 1 and reader.TransferOneRoot(1) and reader.NbShapes() == 1,'XY arc load comparison failed: roots')
    transfer = h['diagnostics'](reader.WS().TransferReader().LastCheckList())
    require(not transfer['failures'] and not transfer['warnings'],'XY arc load comparison failed: transfer '+str(transfer))
    shape = reader.Shape(1)
    require(shape.Location().IsIdentity(),'XY arc unexpected placement')
    explorer = h['TopExp_Explorer'](shape,h['TopAbs_EDGE'])
    require(explorer.More(),'XY arc load comparison failed: edge absent')
    adapter = h['BRepAdaptor_Curve'](h['TopoDS'].Edge(explorer.Current()))
    require(adapter.GetType() == h['GeomAbs_BSplineCurve'],'XY arc transferred curve type changed')
    explorer.Next()
    require(not explorer.More(),'XY arc load comparison failed: extra edge')
    return reader,adapter,{'readStatus':str(status),'roots':1,'entities':1,'loadDiagnostics':load,'transferDiagnostics':transfer,'settings':settings,'units':'MM','modelScale':1,'fileResolutionMM':gs.Resolution()}


def records(filename):
    lines = filename.read_text().splitlines()
    require(1 <= len(lines) <= 4096 and all(len(line) == 80 for line in lines),'XY arc load comparison failed: fixed records')
    ds,ps = [line for line in lines if line[72]=='D'],[line for line in lines if line[72]=='P']
    require(len(ds)==2 and ps,'XY arc load comparison failed: directory/parameters')
    valid = int(ds[0][8:16]) == 1 and all(int(line[64:72]) == 1 for line in ps)
    body = ''.join(line[:64] for line in ps)
    return valid,[int(value.strip()) for value in body.replace(';',',').split(',')[:7]]


def compare_geometry(adapter, fixture):
    spline = adapter.BSpline()
    direction = h['spline_direction'](spline,False)
    local = bool(direction['c0InteriorKnots'])
    points,derivatives = [],[]
    maximum_point = maximum_circle = maximum_derivative = maximum_native = 0
    for sample in fixture['positionSamples']:
        expected,_ = oracle(fixture['request'],sample['quadrant'],sample['t'])
        require(math.dist(expected,sample['analyticPoint']) <= 1e-9 and math.dist(expected,sample['point']) <= 1e-9,'Native/authored rational position mismatch')
        actual = h['xyz'](adapter.Value(sample['parameter']))
        error = math.dist(actual,expected)
        require(error <= 1e-7,'XY arc geometry comparison failed: '+str(error)+' mm')
        radius_error = abs(math.hypot(actual[0]-fixture['request']['center'][0],actual[1]-fixture['request']['center'][1])-fixture['request']['radius'])
        require(radius_error <= 1e-7,'XY arc geometry comparison failed: circle equation '+str(radius_error))
        maximum_point,maximum_circle = max(maximum_point,error),max(maximum_circle,radius_error)
        points.append({'parameter':sample['parameter'],'point':actual,'analyticPoint':expected,'deviationMM':error,'circleRadiusDeviationMM':radius_error})
    for sample in fixture['samples']:
        u = sample['parameter']
        expected_point,expected = oracle(fixture['request'],sample['quadrant'],sample['t'])
        _,native_error = h['compare'](sample['derivative'],expected,1e-9,'Native/authored rational derivative mismatch')
        h['compare'](sample['analyticDerivative'],expected,1e-9,'Stored authored rational derivative mismatch')
        span = h['selected_span'](direction,u)
        point,vector = h['gp_Pnt'](),h['gp_Vec']()
        if local:spline.LocalD1(u,*span,point,vector)
        else:adapter.D1(u,point,vector)
        require(math.dist(h['xyz'](point),expected_point) <= 1e-7,'XY arc geometry comparison failed: D1 position')
        actual = h['xyz'](vector)
        absolute,scaled = h['compare'](actual,expected,1e-7,'XY arc derivative comparison failed')
        # CCW orientation is checked independently in XY at every retained D1.
        radial = [h['xyz'](point)[i]-fixture['request']['center'][i] for i in range(2)]
        require(radial[0]*actual[1]-radial[1]*actual[0] > 0,'XY arc derivative comparison failed: CCW orientation')
        maximum_derivative,maximum_native = max(maximum_derivative,scaled),max(maximum_native,native_error)
        derivatives.append({'parameter':u,'point':h['xyz'](point),'derivative':actual,'analyticDerivative':expected,'distinctKnotInterval':span,'method':'Geom_BSpline.LocalD1' if local else 'BRepAdaptor.D1','absoluteMMPerParameter':absolute,'scaled':scaled})
    return {'positionSamples':points,'samples':derivatives,'positionSampleCount':len(points),'sampleCount':len(derivatives),
            'maxPointDeviationMM':maximum_point,'maxCircleRadiusDeviationMM':maximum_circle,
            'maxDerivativeScaledDeviation':maximum_derivative,'maxNativeAnalyticScaledDeviation':maximum_native}


def main():
    output = Path(sys.argv[1]).resolve()
    mode = sys.argv[2] if len(sys.argv)>2 else ''
    require(mode in ('','--bad-pointer','--changed-pole','--changed-radius','--changed-weight'),'Unknown XY arc mode')
    manifest = json.loads((output/'manifest.json').read_text())
    require(len(manifest['fixtures']) == 6,'Four quadrants and two circles required')
    results = []
    for index,fixture in enumerate(manifest['fixtures']):
        for key,relative in fixture['files'].items():
            filename=(output/relative).resolve()
            require(filename.is_relative_to(output),'XY arc path escaped evidence')
            require(hashlib.sha256(filename.read_bytes()).hexdigest()==fixture['hashes'][key],'XY arc original '+key+' hash mismatch')
        require(fixture['sourceVersion']==0 and fixture['geometryVersion']==0 and fixture['report']['periodic'] is False
                and fixture['report']['regionCertified'] is False and fixture['report']['solid'] is False,'XY arc source/native scope changed')
        filename=output/fixture['files']['iges']
        valid,flags = records(filename)
        require(valid and flags == [126,len(fixture['authoredPoles'])-1,2,0,0,0,0],'XY arc original general/open/rational/nonperiodic flags changed')
        reader,adapter,structure = load_file(filename)
        require([adapter.FirstParameter(),adapter.LastParameter()] == fixture['domain'],'Original XY arc domain changed')
        checked = compare_geometry(adapter,fixture)
        spline = adapter.BSpline()
        direction = h['spline_direction'](spline,False)
        poles=[h['xyz'](spline.Pole(i)) for i in range(1,spline.NbPoles()+1)]
        weights=[spline.Weight(i) for i in range(1,spline.NbPoles()+1)]
        require(direction['degree']==2 and direction['expandedKnots']==fixture['authoredKnots'],'Original arc degree/knots changed')
        require(poles==fixture['authoredPoles'] and weights==fixture['authoredWeights'],'Original arc poles/weights changed')
        mapping=fixture['exportMapping']
        require(mapping['id']==fixture['id'] and mapping['entity']==126 and mapping['directoryPointer']==1 and mapping['parameterPointer']==1,'Arc native ID/export mapping changed')
        expected_c0=[1,2,3] if fixture['request']['kind']=='circle' else []
        require(direction['c0InteriorKnots']==expected_c0 and [row['parameter'] for row in fixture['c0Refusals']]==expected_c0,'Original exact C0 seam refusal changed')
        if mode and index==0:
            control=json.loads((output/'negative-files.json').read_text())[mode[2:]]
            changed=(output/control['file']).resolve()
            require(changed.is_relative_to(output) and hashlib.sha256(changed.read_bytes()).hexdigest()==control['sha256'],'Arc control byte hash mismatch')
            require(control['originalSHA256']==fixture['hashes']['iges'],'Arc control original lineage changed')
            if mode=='--bad-pointer':
                observed_reader=h['IGESControl_Reader']();status=observed_reader.ReadFile(str(changed))
                observed={'readStatus':str(status),'loadDiagnostics':h['diagnostics'](observed_reader.WS().ModelCheckList(True)),'pointerValid':records(changed)[0]}
                (output/(mode[2:]+'-observed.json')).write_text(json.dumps(observed,indent=2)+'\n')
                require(observed['pointerValid'],'XY arc load comparison failed: actual corrupted directory pointer')
            else:
                require(records(changed)==(valid,flags),'Readable arc corruption must preserve pointers and flags')
                _,altered,observed=load_file(changed)
                (output/(mode[2:]+'-observed.json')).write_text(json.dumps(observed,indent=2)+'\n')
                compare_geometry(altered,fixture)
            raise AssertionError('XY arc negative control unexpectedly passed')
        results.append({'name':fixture['name'],'id':fixture['id'],'entity':126,'sourceVersion':0,'geometryVersion':0,
                        'hashes':fixture['hashes'],'files':fixture['files'],'request':fixture['request'],'report':fixture['report'],
                        'nativeDomain':fixture['domain'],'transferredDomain':[adapter.FirstParameter(),adapter.LastParameter()],
                        'transferredDegreeKnots':direction,'transferredPoles':poles,'transferredWeights':weights,'structuralRead':structure,
                        'originalFlags':{'planar':0,'closed':0,'polynomial':0,'periodic':0},
                        'kernelGeometricClosed':spline.IsClosed(),'kernelPeriodic':spline.IsPeriodic(),
                        'exactC0Refusals':fixture['c0Refusals'],**checked})
    require(not mode,'Arc negative did not reach expected stage')
    report={'base':manifest['base'],'head':manifest['head'],'fixtures':results,'readerDependencies':{'read-derivatives-ocp.py':hashlib.sha256(UTIL.read_bytes()).hexdigest()},'limits':manifest['limits'],'periodic':False,'regionCertified':False,'solid':False,'scope':'Actual original IGES126 rational XY geometry; no certified closed wire/region/solid.'}
    (output/'xy-arc-readback.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'fixtures':len(results),'derivativeSamples':sum(f['sampleCount'] for f in results),'positionSamples':sum(f['positionSampleCount'] for f in results)}))


if __name__=='__main__':main()
