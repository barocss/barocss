import { parseScene, compileGpu, compileMeshMaterial, lowerMeshMaterial } from '@barocss/gpu';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const cascade = parseScene(`
@scene cascade {
  version: 0;
  sphere #small;
  sphere #large;
}
sphere { radius: 1; color: #406080; }
#small { radius: .5; }
sphere { radius: 2; }
`);
assert(cascade.objects[0].radius === .5 && cascade.objects[1].radius === 2,
  'ID specificity or source order changed');

const sixShapes = compileGpu({ kind: 'scene', sourceVersion: 1, source: `
@scene sixShapes {
  version: 1;
  sphere #ball;
  box #block;
  cylinder #post;
  capsule #pill;
  rounded-box #case;
  torus #ring;
}
#ball { radius: .4; translate: -2 1 0; }
#block { size: .7 .9 .6; translate: 0 1 0; rotate-y: 25deg; }
#post { radius: .35; height: 1; translate: 2 1 0; }
#pill { radius: .25; start: 0 -.4 0; end: 0 .4 0; translate: -2 -1 0; }
#case { size: 1 .8 .6; radius: .1; translate: 0 -1 0; }
#ring { major-radius: .55; minor-radius: .15; translate: 2 -1 0; rotate-x: 90deg; }
` });
assert(sixShapes.ok, 'Expected the six-shape scene to compile');
assert(sixShapes.ir.pipeline === 'sdf' && sixShapes.ir.schemaVersion === 2,
  'Expected source1 SDF render IR');

const materialInputs = {
  blend: `@shader #blend {
    @uniform amount: float(0,1,0);
    @let ratio: float(smoothstep(0,1,amount));
    @fragment { color: mix(#2060D0,#F09030,ratio); }
  }`,
  pulse: `@shader #pulse {
    @uniform timeSeconds: float(0,2,0);
    @let phase: float(timeSeconds * 1.5707963267948966);
    @let ratio: float(sin(phase) * .5 + .5);
    @let cold: color(rgb(32,64,128));
    @let warm: color(#E08020);
    @fragment { color: mix(cold,warm,ratio); }
  }`,
  ease: `@shader #ease {
    @uniform amount: float(0,1,0);
    @let eased: float(smoothstep(.2,.8,amount));
    @fragment { color: mix(#2060D0,#F09030,eased); }
  }`,
  shape: `@shader #shape {
    @uniform amount: float(0,1,0);
    @let squared: float(pow(amount,2));
    @let limited: float(min(max(squared,.1),.9));
    @fragment { color: mix(#2060D0,#F09030,limited); }
  }`,
  angle: `@shader #angle {
    @uniform angleDegrees: float(-180,180,0);
    @let phase: float(radians(angleDegrees));
    @let ratio: float(abs(sin(phase)));
    @fragment { color: mix(#2060D0,#F09030,ratio); }
  }`
};
const materials = Object.fromEntries(Object.entries(materialInputs).map(([name, source]) => {
  const compiled = compileMeshMaterial(source);
  assert(compiled.ok, `Expected material ${name} to compile`);
  const lowered = lowerMeshMaterial(compiled.material);
  assert(lowered.expression.length > 0, `Expected material ${name} to lower`);
  return [name, { shaderId: compiled.material.shaderId,
    uniforms: lowered.uniformLayout.map(uniform => uniform.name) }];
}));

const wrongBoxProperty = compileGpu({ kind: 'scene', sourceVersion: 1,
  source: '@scene broken { version: 1; box #block; } #block { radius: 1; }' });
assert(!wrongBoxProperty.ok && wrongBoxProperty.diagnostics[0].code === 'VALIDATION',
  'Expected a box radius refusal');
const mixRange = compileMeshMaterial(`@shader #refused {
  @uniform amount: float(-1,1,0);
  @fragment { color: mix(#2060D0,#F09030,amount); }
}`);
assert(!mixRange.ok && mixRange.diagnostics[0].code === 'RANGE',
  'Expected the declared ratio range refusal');

console.log(JSON.stringify({
  example: 'gpu-language',
  cascadeRadii: cascade.objects.map(object => object.radius),
  sixShapes: sixShapes.ir.draws.map(draw => draw.kind),
  materials,
  refusedCodes: [wrongBoxProperty.diagnostics[0].code, mixRange.diagnostics[0].code],
  drawing: 'not executed in this CPU example'
}, null, 2));
