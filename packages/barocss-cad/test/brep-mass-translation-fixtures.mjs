import { baselineBox } from './brep-boundary-binding-fixtures.mjs';
/** The literal meridian/pole sphere profile, with independent affine frame data. */
export function massTranslationSphereStep({ radius = .001, center = [999000,-998000,997000], compound = true, reversed = false } = {}) {
  const x=compound?[.36,.48,-.8]:[1,0,0],z=compound?[.48,.64,.6]:[0,0,1],normal=compound?[.8,-.6,0]:[0,-1,0];
  const point=t=>center.map((v,k)=>v+t*z[k]).join(','),list=p=>p.join(',');
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('mass translation'),'2;1');
FILE_NAME('mass-translation.step','',(''),(''),'','','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
#1=CARTESIAN_POINT('',(${point(-radius)}));
#2=VERTEX_POINT('',#1);
#3=CARTESIAN_POINT('',(${point(radius)}));
#4=VERTEX_POINT('',#3);
#5=CARTESIAN_POINT('',(${list(center)}));
#6=DIRECTION('',(${list(normal)}));
#7=DIRECTION('',(${list(x)}));
#8=AXIS2_PLACEMENT_3D('',#5,#6,#7);
#9=CIRCLE('',#8,${radius});
#10=SEAM_CURVE('',#9,(),.PCURVE_S1.);
#11=EDGE_CURVE('',#2,#4,#10,.${reversed?'F':'T'}.);
#12=CARTESIAN_POINT('',(${list(center)}));
#13=DIRECTION('',(${list(z)}));
#14=DIRECTION('',(${list(x)}));
#15=AXIS2_PLACEMENT_3D('',#12,#13,#14);
#16=SPHERICAL_SURFACE('',#15,${radius});
#17=ORIENTED_EDGE('',*,*,#11,.T.);
#18=ORIENTED_EDGE('',*,*,#11,.F.);
#19=EDGE_LOOP('',(#17,#18));
#20=FACE_OUTER_BOUND('',#19,.T.);
#21=ADVANCED_FACE('literal-sphere',(#20),#16,.T.);
#22=CLOSED_SHELL('',(#21));
#23=MANIFOLD_SOLID_BREP('independent',#22);
#24=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));
#25=(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNIT_ASSIGNED_CONTEXT((#24))REPRESENTATION_CONTEXT('',''));
#26=ADVANCED_BREP_SHAPE_REPRESENTATION('',(#23),#25);
ENDSEC;
END-ISO-10303-21;
`;
}
/** Fixture qualification limits, fixed before candidate execution; not universal shape-error certificates. */
export const MASS_TRANSLATION_BUDGET = Object.freeze({
  units: { length:'mm', volume:'mm3', area:'mm2', mass:'g', inertia:'g*mm2' },
  // Exact native tensor shell <=1.574e-10mm, or1.574e-7R; shell alone does not certify trim area/volume.
  representedRadius: 1.574e-10,
  literalVolumeRelative: 1e-6, literalAreaRelative: 1e-6, literalInertiaRelative: 1e-6,
  // Same already-stored geometry: pure translation has no shape error, only integration/evaluation rounding.
  sameGeometryRelative: 1e-7,
  centroid: 8 * 2**-33,
});
export function massTranslationSphereOracle({ radius=.001, center=[999000,-998000,997000], density=2.7 }={}) {
  const volume=4/3*Math.PI*radius**3,mass=density*volume*.001,inertia=2/5*mass*radius**2;
  return {radius,center,density,volume,mass,area:4*Math.PI*radius**2,inertia,budget:MASS_TRANSLATION_BUDGET};
}
/** Exact polynomial top h=1+.4*x*(1-x)*y*(1-y), with the original straight boundary and box topology. */
export function quadraticRoofBox() {
  const b=baselineBox(),top=b.faces.find(f=>f.name==='top');
  top.surface={kind:'surface',id:'quadratic_roof',degreeU:2,degreeV:2,knotsU:[0,0,0,1,1,1],knotsV:[0,0,0,1,1,1],controlPoints:[0,.5,1].map((x,i)=>[0,.5,1].map((y,j)=>[x,y,1+(i===1&&j===1?.1:0)])),weights:[[1,1,1],[1,1,1],[1,1,1]]};
  return b;
}
