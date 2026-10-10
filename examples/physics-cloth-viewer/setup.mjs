import {mkdir,readlink,symlink} from 'node:fs/promises';
import {dirname,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),namespace=resolve(here,'node_modules/@barocss');await mkdir(namespace,{recursive:true});for(const name of ['physics','viewer','cad-interop','gpu']){const link=resolve(namespace,name),target=resolve(here,'../../packages','barocss-'+name);try{await symlink(relative(namespace,target),link,'dir');}catch(error){if(error.code!=='EEXIST'||resolve(namespace,await readlink(link))!==target)throw error;}}
console.log('Four declared workspace links ready; no packages installed.');
