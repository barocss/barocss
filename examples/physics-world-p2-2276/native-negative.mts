// Type-only negative proof. This module must not execute.
// @ts-expect-error retired scene factory
import { createPhysicsScene } from '@barocss/physics/replay';
// @ts-expect-error retired session factory
import { createPhysicsReplaySession } from '@barocss/physics/replay';
// @ts-expect-error retired restore factory
import { restorePhysicsReplaySession } from '@barocss/physics/replay';
// @ts-expect-error retired snapshot writer
import { serializePhysicsSnapshot } from '@barocss/physics/replay';
// @ts-expect-error retired snapshot reader
import { deserializePhysicsSnapshot } from '@barocss/physics/replay';
// @ts-expect-error retired scene type
import type { PhysicsSceneV1 } from '@barocss/physics/replay';
// @ts-expect-error retired snapshot type
import type { PhysicsSnapshotV1 } from '@barocss/physics/replay';
// @ts-expect-error retired session type
import type { PhysicsReplaySession } from '@barocss/physics/replay';
// @ts-expect-error retired root creation type
import type { PhysicsWorldConfig } from '@barocss/physics';
import { createPhysicsWorld, type PhysicsModel, type WorldOptions } from '@barocss/physics';
declare const model: PhysicsModel, options: WorldOptions;
const world = createPhysicsWorld(model, options);
// @ts-expect-error retired flat constructor
createPhysicsWorld({ bodies: [] });
// @ts-expect-error commands are not a per-step duration
world.step(1 / 120);
// @ts-expect-error tagged query replaces old raycast method
world.raycast({});
// @ts-expect-error arbitrary checkpoint loading is not public
world.setState({});
