// Import/identity gate only. No World or numerical stepping.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = await import(pathToFileURL(resolve('packages/barocss-physics/dist/index.js')).href);
const canonical = await import(pathToFileURL(resolve('packages/barocss-physics/dist/types.js')).href);
assert.equal(root.PhysicsError, canonical.PhysicsError);
assert.equal(typeof root.createPhysicsWorld, 'function');
console.log(JSON.stringify({status:'PASS_NATIVE_ENTRY_AND_ERROR_IDENTITY',WorldCalls:0}));
