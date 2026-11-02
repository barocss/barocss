// Authoring-only stage transform; no source/provider execution at import.
import {copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const home=dirname(fileURLToPath(import.meta.url));

// Run after the unchanged qualified producerTransform. Its return-apply anchor
// also proves actual producer accumulation remains on the same warm call path.
export function warmTransportTransform({src,edit,once}) {
  copyFileSync(resolve(home,'warm-transport.ts'),resolve(src,'warm-transport.ts'));
  edit('persistent-box-contact.ts',s=>{
    s="import {transportWarmTangent} from './warm-transport.js';\n"+s;
    return once(s,
      '  return apply(a, b, pointM, add(scale(normal, impulse.normalNs), impulse.tangentNs));',
      '  impulse.tangentNs = transportWarmTangent(impulse.tangentNs, normal);\n'
      +'  return apply(a, b, pointM, add(scale(normal, impulse.normalNs), impulse.tangentNs));');
  });
}
