import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { serveTaskThread } from './thread';

let revision = 0;
await serveTaskThread(async doc => evaluatePart(doc, ++revision));
