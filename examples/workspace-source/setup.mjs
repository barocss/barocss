import { mkdir, readlink, symlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const namespace = resolve(here, 'node_modules/@barocss');
await mkdir(namespace, { recursive: true });
for (const name of ['cad', 'cad-interop', 'gpu', 'physics', 'viewer']) {
  const link = resolve(namespace, name);
  const target = resolve(here, '../../packages', `barocss-${name}`);
  try {
    await symlink(relative(namespace, target), link, 'dir');
  } catch (error) {
    if (error.code !== 'EEXIST' || resolve(namespace, await readlink(link)) !== target) throw error;
  }
}
console.log('Six local workspace links are ready. No dependencies were installed.');
