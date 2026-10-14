import { createNativeExtrusionPreviewAcceptanceV1 as sourceFactory } from '../src/index.js';
import { createNativeExtrusionPreviewAcceptanceV1 as packageSourceFactory } from '@barocss/cad';
import type {
  NativeExtrusionPreviewTicketV1 as SourceTicket,
  NativeExtrusionPreparedV1 as SourcePrepared,
  NativeExtrusionAcceptedV1 as SourceAccepted,
  NativeExtrusionPreviewAcceptanceSessionV1 as SourceSession,
} from '../src/index.js';
import type {
  NativeExtrusionPreviewTicketV1 as PackageSourceTicket,
  NativeExtrusionPreparedV1 as PackageSourcePrepared,
  NativeExtrusionAcceptedV1 as PackageSourceAccepted,
  NativeExtrusionPreviewAcceptanceSessionV1 as PackageSourceSession,
} from '@barocss/cad';
import { createNativeExtrusionPreviewAcceptanceV1 as emittedFactory } from '../dist/index.js';
import type {
  NativeExtrusionPreviewTicketV1 as EmittedTicket,
  NativeExtrusionPreparedV1 as EmittedPrepared,
  NativeExtrusionAcceptedV1 as EmittedAccepted,
  NativeExtrusionPreviewAcceptanceSessionV1 as EmittedSession,
} from '../dist/index.js';

const source: typeof emittedFactory = sourceFactory;
const packageSource: typeof sourceFactory = packageSourceFactory;
const emitted: typeof sourceFactory = emittedFactory;
declare const sourceSession: SourceSession;
declare const packageSourceSession: PackageSourceSession;
declare const emittedSession: EmittedSession;
const sourcePrepared: SourcePrepared = sourceSession.prepareDistanceMM(3);
const packageSourcePrepared: PackageSourcePrepared = packageSourceSession.prepareDistanceMM(3);
const emittedPrepared: EmittedPrepared = emittedSession.prepareDistanceMM(3);
const sourceTicket: SourceTicket = sourcePrepared.token;
const packageSourceTicket: PackageSourceTicket = packageSourcePrepared.token;
const emittedTicket: EmittedTicket = emittedPrepared.token;
const sourceAccepted: SourceAccepted = sourceSession.accept(sourceTicket);
const packageSourceAccepted: PackageSourceAccepted = packageSourceSession.accept(packageSourceTicket);
const emittedAccepted: EmittedAccepted = emittedSession.accept(emittedTicket);
sourceSession.cancel(sourceSession.prepareDistanceMM(4).token);
packageSourceSession.cancel(packageSourceSession.prepareDistanceMM(4).token);
emittedSession.cancel(emittedSession.prepareDistanceMM(4).token);
sourceSession.dispose();
packageSourceSession.dispose();
emittedSession.dispose();
void [source, packageSource, emitted, sourceAccepted, packageSourceAccepted, emittedAccepted];
