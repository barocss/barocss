"""Actual seven-entity IGES readback of bounded source2 rectangle extrusion."""
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps

UTIL=Path(__file__).with_name('read-derivatives-ocp.py')
h=runpy.run_path(str(UTIL));require=h['require']


def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b):return sum(x*y for x,y in zip(a,b))

def pointers(filename,mappings):
    lines=filename.read_text().splitlines()
    require(1<=len(lines)<=4096 and all(len(line)==80 for line in lines),'Rectangle extrusion load comparison failed: record widths')
    ds=[line for line in lines if line[72]=='D'];ps=[line for line in lines if line[72]=='P']
    require(len(ds)==14,'Rectangle extrusion load comparison failed: directory count')
    valid=True
    for index,mapping in enumerate(mappings):
        first=ds[index*2]
        valid=valid and mapping['directoryPointer']==index*2+1 and int(first[8:16])==mapping['parameterPointer']
        rows=[line for line in ps if int(line[64:72])==mapping['directoryPointer']]
        valid=valid and len(rows)==mapping['parameterRecords'] and int(rows[0][73:])==mapping['parameterPointer']
    return valid


def load(filename):
    reader=h['IGESControl_Reader']()
    settings={'xstep.cascade.unit':'MM','read.iges.bspline.continuity':0,'read.precision.mode':0,'read.iges.faulty.entities':0,'read.surfacecurve.mode':0,'read.iges.sequence':''}
    for key,value in settings.items():
        success=h['Interface_Static'].SetCVal_s(key,value) if isinstance(value,str) else h['Interface_Static'].SetIVal_s(key,value)
        actual=h['Interface_Static'].CVal_s(key) if isinstance(value,str) else h['Interface_Static'].IVal_s(key)
        require(success and actual==value,'Installed rectangle consumer setting unavailable: '+key)
    status=reader.ReadFile(str(filename));diagnostics=h['diagnostics'](reader.WS().ModelCheckList(True))
    require(status==h['IFSelect_RetDone'] and not diagnostics['failures'] and not diagnostics['warnings'],'Rectangle extrusion load comparison failed: '+str(diagnostics))
    model=reader.IGESModel();require(model.NbEntities()==7 and [model.Entity(i).TypeNumber() for i in range(1,8)]==[126]+[128]*6,'Rectangle extrusion load comparison failed: actual entity order')
    gs=model.GlobalSection();require(gs.UnitFlag()==2 and gs.UnitName().ToCString().strip().upper()=='MM' and gs.Scale()==1,'Rectangle extrusion units changed')
    require(reader.NbRootsForTransfer()==7,'Rectangle extrusion load comparison failed: root count')
    transfers=[]
    for i in range(1,8):
        require(reader.TransferOneRoot(i),'Rectangle extrusion load comparison failed: root '+str(i))
        check=h['diagnostics'](reader.WS().TransferReader().LastCheckList());require(not check['failures'] and not check['warnings'],'Rectangle extrusion load comparison failed: transfer diagnostics');transfers.append(check)
    require(reader.NbShapes()==7,'Rectangle extrusion load comparison failed: transferred shape count')
    adapters,shapes=[],[]
    for index in range(7):
        shape=reader.Shape(index+1);require(shape.Location().IsIdentity(),'Rectangle extrusion unexpected placement')
        explorer=h['TopExp_Explorer'](shape,h['TopAbs_EDGE'] if index==0 else h['TopAbs_FACE']);require(explorer.More(),'Rectangle extrusion transferred geometry missing')
        typed=h['TopoDS'].Edge(explorer.Current()) if index==0 else h['TopoDS'].Face(explorer.Current())
        adapter=h['BRepAdaptor_Curve'](typed) if index==0 else h['BRepAdaptor_Surface'](typed,True)
        explorer.Next();require(not explorer.More(),'Rectangle extrusion extra local geometry')
        require(adapter.GetType()==(h['GeomAbs_BSplineCurve'] if index==0 else h['GeomAbs_BSplineSurface']),'Rectangle extrusion transferred B-spline type changed')
        adapters.append(adapter);shapes.append(typed)
    return reader,adapters,shapes,{'readStatus':str(status),'roots':7,'entities':7,'entityTypes':[126]+[128]*6,'loadDiagnostics':diagnostics,'transferDiagnostics':transfers,'settings':settings,'units':'MM','modelScale':1}


def geometry(adapters,shapes,fixture):
    curve=adapters[0];require([curve.FirstParameter(),curve.LastParameter()]==[0,4],'Rectangle profile original domain changed')
    spline=curve.BSpline();direction=h['spline_direction'](spline,False)
    require(direction['degree']==1 and direction['expandedKnots']==[0,0,1,2,3,4,4],'Rectangle profile degree/knots changed')
    require(direction['c0InteriorKnots']==[1,2,3],'Rectangle profile C0 guards changed')
    checks=[];area=flux=0
    for index,data in enumerate(fixture['faceChecks']):
        adapter=adapters[index+1];surface=adapter.BSpline()
        require([adapter.FirstUParameter(),adapter.LastUParameter(),adapter.FirstVParameter(),adapter.LastVParameter()]==[0,1,0,1],'Rectangle face original domain changed')
        ud,vd=h['spline_direction'](surface,True,'u'),h['spline_direction'](surface,True,'v')
        require(ud['degree']==vd['degree']==1 and ud['expandedKnots']==vd['expandedKnots']==[0,0,1,1],'Rectangle face degree/knots changed')
        samples=[];maxpoint=maxderivative=0
        for row in data['samples']:
            expected=[x+row['u']*a+row['v']*b for x,a,b in zip(data['origin'],data['A'],data['B'])]
            require(math.dist(row['point'],expected)<=1e-9,'Native/authored face position mismatch')
            h['compare'](row['du'],data['A'],1e-9,'Native/authored face U mismatch');h['compare'](row['dv'],data['B'],1e-9,'Native/authored face V mismatch')
            p,du,dv=h['gp_Pnt'](),h['gp_Vec'](),h['gp_Vec']();adapter.D1(row['u'],row['v'],p,du,dv)
            actual,u,v=h['xyz'](p),h['xyz'](du),h['xyz'](dv);deviation=math.dist(actual,expected)
            require(deviation<=1e-7,'Rectangle extrusion geometry comparison failed: face '+str(index)+' position '+str(deviation))
            _,eu=h['compare'](u,data['A'],1e-7,'Rectangle extrusion derivative comparison failed: U');_,ev=h['compare'](v,data['B'],1e-7,'Rectangle extrusion derivative comparison failed: V')
            normal=cross(u,v);h['compare'](normal,[x*data['areaMM2'] for x in data['normal']],1e-7,'Rectangle extrusion derivative comparison failed: outward normal')
            maxpoint=max(maxpoint,deviation);maxderivative=max(maxderivative,eu,ev);samples.append({'u':row['u'],'v':row['v'],'point':actual,'du':u,'dv':v,'normalArea':normal})
        expected_grid=[[data['origin'],[x+b for x,b in zip(data['origin'],data['B'])]],[[x+a for x,a in zip(data['origin'],data['A'])],[x+a+b for x,a,b in zip(data['origin'],data['A'],data['B'])]]]
        require(surface.NbUPoles()==surface.NbVPoles()==2 and [[h['xyz'](surface.Pole(u,v)) for v in range(1,3)] for u in range(1,3)]==expected_grid
                and all(surface.Weight(u,v)==1 for u in range(1,3) for v in range(1,3)),'Rectangle original surface poles/weights changed')
        corners=[h['xyz'](adapter.Value(u,v)) for u,v in [(0,0),(1,0),(1,1),(0,1)]]
        bounds={'min':[min(p[k] for p in corners) for k in range(3)],'max':[max(p[k] for p in corners) for k in range(3)]}
        require(all(math.dist(bounds[k],data['bounds'][k])<=1e-7 for k in ('min','max')),'Rectangle extrusion geometry comparison failed: face bounds')
        props=GProp_GProps();estimated=BRepGProp.SurfaceProperties_s(shapes[index+1],props,1e-10,False);actual_area=props.Mass()
        require(abs(actual_area-data['areaMM2'])<=1e-7*max(1,data['areaMM2']),'Rectangle extrusion geometry comparison failed: face area')
        center,du,dv=h['gp_Pnt'](),h['gp_Vec'](),h['gp_Vec']();adapter.D1(.5,.5,center,du,dv);normal=cross(h['xyz'](du),h['xyz'](dv));signed_flux=dot(h['xyz'](center),normal)/3
        area+=actual_area;flux+=signed_flux;checks.append({'id':data['id'],'wrapperId':data['wrapperId'],'samples':samples,'sampleCount':len(samples),'boundsMM':bounds,'areaMM2':actual_area,'signedSurfaceFluxMM3':signed_flux,'maxPointDeviationMM':maxpoint,'maxDerivativeScaledDeviation':maxderivative,'quadrature':{'requestedRelativePrecision':1e-10,'estimatedRelativePrecision':estimated}})
    require(abs(area-fixture['analyticAreaMM2'])<=1e-7*max(1,area),'Rectangle extrusion geometry comparison failed: area sum')
    require(abs(flux-fixture['analyticVolumeMM3'])<=1e-7*max(1,fixture['analyticVolumeMM3']),'Rectangle extrusion geometry comparison failed: signed face flux')
    expected_profile=[fixture['vertices'][i] for i in [0,1,3,2,0]]
    require(spline.NbPoles()==5 and [h['xyz'](spline.Pole(i)) for i in range(1,6)]==expected_profile
            and [spline.Weight(i) for i in range(1,6)]==[1]*5,'Rectangle original profile poles/weights changed')
    return {'faces':checks,'areaMM2':area,'signedFaceFluxMM3':flux,'actualSurfaceCount':6,'nativeSolidReport':fixture['solidReport'],'readerSolidConstructed':False,'wholeSolidInterchange':False}


def footprint(curve,fixture,wrong=False):
    spline=curve.BSpline();direction=h['spline_direction'](spline,False);checks=[]
    expected_indices=[0,3,5,1];expected_senses=['forward','forward','reverse','reverse']
    for index,data in enumerate(fixture['footprint']):
        association=data['association'];require(association['inputRange']==[index,index+1] and association['edgeId']==fixture['shell']['edges'][expected_indices[index]]['id'],'Rectangle extrusion association comparison failed: input range/edge')
        sense=('reverse' if association['sense']=='forward' else 'forward') if wrong and index==0 else association['sense']
        if not wrong:require(sense==expected_senses[index],'Rectangle extrusion association comparison failed: sense')
        a,b=data['canonicalPoints'];delta=[y-x for x,y in zip(a,b)];rows=[]
        for row in data['samples']:
            t=row['t'] if sense=='forward' else 1-row['t'];expected=[x+t*d for x,d in zip(a,delta)];actual=h['xyz'](curve.Value(row['parameter']))
            require(math.dist(actual,expected)<=1e-7,'Rectangle extrusion association comparison failed: actual footprint position')
            derivative=None
            if row['derivative'] is not None:
                p,d=h['gp_Pnt'](),h['gp_Vec']();span=h['selected_span'](direction,row['parameter']);spline.LocalD1(row['parameter'],*span,p,d);derivative=h['xyz'](d)
                wanted=[x if sense=='forward' else -x for x in delta];h['compare'](row['derivative'],wanted,1e-9,'Native footprint derivative mismatch');h['compare'](derivative,wanted,1e-7,'Rectangle extrusion association comparison failed: actual footprint derivative')
            rows.append({'parameter':row['parameter'],'canonicalParameter':t,'point':actual,'derivative':derivative})
        checks.append({'span':index,'edgeId':association['edgeId'],'sense':sense,'samples':rows,'sampleCount':len(rows)})
    return checks


def main():
    output=Path(sys.argv[1]).resolve();mode=sys.argv[2] if len(sys.argv)>2 else ''
    require(mode in ('','--bad-pointer','--changed-face','--changed-dimension','--reversed-footprint'),'Unknown rectangle extrusion control')
    manifest=json.loads((output/'manifest.json').read_text());require(len(manifest['fixtures'])==4,'Four bounded rectangle extrusion fixtures required');results=[]
    for index,fixture in enumerate(manifest['fixtures']):
        require(fixture['sourceVersion']==2 and fixture['geometryVersion']==0,'Rectangle source/native version changed')
        for key,relative in fixture['files'].items():
            filename=(output/relative).resolve();require(filename.is_relative_to(output),'Rectangle evidence path escaped')
            require(hashlib.sha256(filename.read_bytes()).hexdigest()==fixture['hashes'][key],'Rectangle original '+key+' hash mismatch')
        filename=output/fixture['files']['iges'];mappings=fixture['exportReport']['objects'];require(pointers(filename,mappings),'Rectangle extrusion load comparison failed: original DE mapping')
        require([m['id'] for m in mappings]==[o['id'] for o in fixture['model']['objects']],'Rectangle explicit original ID selection mapping changed')
        reader,adapters,shapes,structure=load(filename);checked=geometry(adapters,shapes,fixture);associations=footprint(adapters[0],fixture)
        if mode and index==0:
            if mode=='--reversed-footprint':
                (output/'reversed-footprint-observed.json').write_text(json.dumps(structure,indent=2)+'\n');footprint(adapters[0],fixture,True)
            else:
                control=json.loads((output/'negative-files.json').read_text())[mode[2:]];changed=(output/control['file']).resolve()
                require(changed.is_relative_to(output) and hashlib.sha256(changed.read_bytes()).hexdigest()==control['sha256'] and control['originalSHA256']==fixture['hashes']['iges'],'Rectangle control byte lineage mismatch')
                if mode=='--bad-pointer':
                    changed_reader=h['IGESControl_Reader']();status=changed_reader.ReadFile(str(changed));observed={'readStatus':str(status),'loadDiagnostics':h['diagnostics'](changed_reader.WS().ModelCheckList(True)),'pointerValid':pointers(changed,mappings)};(output/'bad-pointer-observed.json').write_text(json.dumps(observed,indent=2)+'\n');require(observed['pointerValid'],'Rectangle extrusion load comparison failed: corrupted directory pointer')
                else:
                    require(pointers(changed,mappings),'Readable rectangle corruption must preserve pointers');_,altered,altered_shapes,observed=load(changed);(output/(mode[2:]+'-observed.json')).write_text(json.dumps(observed,indent=2)+'\n');geometry(altered,altered_shapes,fixture)
            raise AssertionError('Rectangle extrusion negative unexpectedly passed')
        results.append({'name':fixture['name'],'sourceVersion':2,'geometryVersion':0,'mapping':mappings,'structuralRead':structure,'footprintChecks':associations,'hashes':fixture['hashes'],'files':fixture['files'],**checked})
    require(not mode,'Rectangle negative did not reach comparison')
    report={'base':manifest['base'],'head':manifest['head'],'fixtures':results,'readerDependencies':{'read-derivatives-ocp.py':hashlib.sha256(UTIL.read_bytes()).hexdigest()},'limits':manifest['limits'],'readerSolidConstructed':False,'wholeSolidInterchange':False,'scope':'Original source2-generated seven geometric IGES entities; native exact solid report is separate from reader face geometry.'};(output/'rectangle-extrusion-readback.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'fixtures':len(results),'entities':len(results)*7,'surfaces':len(results)*6,'surfaceD1Samples':sum(f['sampleCount'] for row in results for f in row['faces']),'footprintSamples':sum(f['sampleCount'] for row in results for f in row['footprintChecks'])}))


if __name__=='__main__':main()
