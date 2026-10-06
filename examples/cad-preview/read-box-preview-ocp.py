"""Independent installed reader of separate original native faces for whole-box GPU lineage."""
import json,sys,math,hashlib,importlib.metadata
from pathlib import Path
from OCP.IGESControl import IGESControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.gp import gp_Pnt,gp_Vec
TABLE=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]]
IDS=['x_min','x_max','y_min','y_max','z_min','z_max']
NORMALS=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]]
def diag(iterator):
 out=[];iterator.Start()
 while iterator.More():
  check=iterator.Value();out += [check.CFail(i)for i in range(1,check.NbFails()+1)]+[check.CWarning(i)for i in range(1,check.NbWarnings()+1)];iterator.Next()
 return out
def xyz(p):return [p.X(),p.Y(),p.Z()]
def error(a,b):return math.dist(a,b)
r=Path(sys.argv[1]);mode=sys.argv[2]if len(sys.argv)>2 else '';manifest=json.loads((r/'manifest.json').read_text());results=[]
for box in manifest['boxes'][:1]if mode else manifest['boxes']:
 o,s=box['request']['origin'],box['request']['sides'];assert len(o)==len(s)==3 and all(type(x)in(int,float)and math.isfinite(x)and int(x)==x for x in o+s);assert all(1<=x<=10000 for x in s)
 corners=[[o[k]+(((i>>k)&1)*s[k])for k in range(3)]for i in range(8)];assert all(abs(x)<=10000 for p in corners for x in p)
 assert box['solidReport']=={'valid':True,'geometryFamily':'exact-axis-box-solid-v0','closed':True,'solid':True,'volumeMM3':math.prod(s),'areaMM2':2*(s[0]*s[1]+s[1]*s[2]+s[2]*s[0]),'boundsMM':{'min':o,'max':[o[k]+s[k]for k in range(3)]}}
 assert box['lineage']['meshId']==box['request']['id']and box['packet']['surfaceId']==box['request']['id']and box['packet']['revision']==box['request']['revision']
 assert len(box['faces'])==6 and len(box['packet']['positions'])==72 and len(box['packet']['indices'])==36
 for face in box['faces'][:1]if mode else box['faces']:
  i=face['faceIndex'];assert face['nativeId']==IDS[i] and face['wrapperId']=='box_'+IDS[i];assert face['range']=={'faceId':face['wrapperId'],'surfaceId':IDS[i],'vertexStart':4*i,'vertexCount':4,'indexStart':6*i,'indexCount':6}
  native=json.loads((r/face['nativeFile']).read_text());a,b,c,d=TABLE[i];poles=[[corners[a],corners[d]],[corners[b],corners[c]]];assert native['id']==IDS[i]and native['degreeU']==native['degreeV']==1 and native['controlPoints']==poles and native['weights']==[[1,1],[1,1]]and native['knotsU']==native['knotsV']==[0,0,1,1]
  filename=r/('corrupt.iges'if mode=='--corrupt'else box['faces'][1]['igesFile']if mode=='--wrong-face'else face['igesFile'])
  reader=IGESControl_Reader();settings={'xstep.cascade.unit':'MM','read.iges.bspline.continuity':0,'read.precision.mode':0,'read.iges.faulty.entities':0,'read.surfacecurve.mode':0,'read.iges.sequence':''}
  for k,v in settings.items():assert (Interface_Static.SetCVal_s(k,v)if isinstance(v,str)else Interface_Static.SetIVal_s(k,v))
  lines=filename.read_text().splitlines();assert all(len(line)==80 for line in lines);directory=[line for line in lines if line[72]=='D'];assert len(directory)==2 and int(directory[0][:8])==128
  assert reader.ReadFile(str(filename))==IFSelect_RetDone;assert not diag(reader.WS().ModelCheckList(True));assert reader.NbRootsForTransfer()==1;assert reader.TransferRoots()==1;assert not diag(reader.WS().TransferReader().LastCheckList())
  model=reader.IGESModel();assert model.GlobalSection().UnitName().ToCString()=='MM'and model.GlobalSection().Scale()==1 and model.NbEntities()==1 and model.Entity(1).TypeNumber()==128
  exp=TopExp_Explorer(reader.OneShape(),TopAbs_FACE);assert exp.More();shape=TopoDS.Face(exp.Current());exp.Next();assert not exp.More();surface=BRepAdaptor_Surface(shape,False);assert [surface.FirstUParameter(),surface.LastUParameter(),surface.FirstVParameter(),surface.LastVParameter()]==[0,1,0,1]
  print('REACHED_GEOMETRY',box['name'],IDS[i],flush=True)
  du=[corners[b][k]-corners[a][k]for k in range(3)];dv=[corners[d][k]-corners[a][k]for k in range(3)];maximum=0
  for sample in face['samples']:
   u,v=sample['u'],sample['v'];expected=[corners[a][k]+u*du[k]+v*dv[k]for k in range(3)];assert error(sample['point'],expected)<=1e-9
   point=gp_Pnt();actual_du=gp_Vec();actual_dv=gp_Vec();surface.D1(u,v,point,actual_du,actual_dv);difference=error(xyz(point),expected);assert difference<=1e-7;maximum=max(maximum,difference);assert error(xyz(actual_du),du)<=1e-7*max(1,math.dist(du,[0,0,0]))and error(xyz(actual_dv),dv)<=1e-7*max(1,math.dist(dv,[0,0,0]))
  packet=face['packet'];assert packet['surfaceId']==IDS[i]and packet['revision']==box['request']['revision']and packet['parameters']==[0,0,0,1,1,0,1,1]
  for j in range(4):
   u,v=packet['parameters'][2*j:2*j+2];expected=[corners[a][k]+u*du[k]+v*dv[k]for k in range(3)];assert error(packet['positions'][3*j:3*j+3],expected)<=1e-9 and packet['normals'][3*j:3*j+3]==NORMALS[i]
  assert box['packet']['positions'][12*i:12*i+12]==packet['positions']and box['packet']['normals'][12*i:12*i+12]==packet['normals']and box['packet']['parameters'][8*i:8*i+8]==packet['parameters']and box['packet']['indices'][6*i:6*i+6]==[x+4*i for x in packet['indices']]
  results.append({'box':box['name'],'nativeId':IDS[i],'wrapperId':face['wrapperId'],'directoryType':128,'entities':1,'units':'MM','scale':1,'samples':len(face['samples']),'maxDeviationMM':maximum,'nativeHash':face['nativeHash'],'igesHash':face['igesHash'],'selectedNativeLimitMM':1e-9,'selectedReaderLimitMM':1e-7,'healing':'Named reader sequence disabled; no tolerance override'})
if not mode:(r/'readback.json').write_text(json.dumps({'head':manifest['head'],'reader':importlib.metadata.version('cadquery-ocp'),'faces':results,'claim':'Thirty separate original native face exports; no serialized whole-solid topology or UI whole-solid IGES action'},indent=2)+'\n')
