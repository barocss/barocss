import * as PhysicsSampleAPI from '@barocss/physics';

const PHYSICS_SAMPLE_STEP = 1 / 120;

function preparePhysicsSample(text) {
  const config = JSON.parse(text);
  const world = PhysicsSampleAPI.createPhysicsWorld(config);
  try {
    if (config.fixedStepSeconds !== PHYSICS_SAMPLE_STEP || config.bodies.length !== 1
      || config.bodies[0].kind !== 'dynamic' || config.bodies[0].shape.kind !== 'sphere') {
      throw new Error('This host requires one dynamic sphere and fixedStepSeconds equal to 1/120.');
    }
    return { world, state: world.getState() };
  } catch (error) {
    world.dispose();
    throw error;
  }
}

/** Manual public Physics steps, displayed by caller-owned browser Canvas2D. */
export function createPhysicsExample(canvas, source) {
  const prepared = preparePhysicsSample(source);
  let context;
  try {
    context = canvas.getContext('2d');
    if (!context) throw new Error('The Physics sample needs a host Canvas2D context.');
    canvas.width = 640;
    canvas.height = 420;
  } catch (error) {
    prepared.world.dispose();
    throw error;
  }
  let world = prepared.world;
  let state = prepared.state;
  let baseline = prepared.state;
  let acceptedSource = source;
  let lastAction = 'initial';
  let disposed = false;

  function active() {
    if (disposed) throw new Error('The Physics example is disposed. Open a new example.');
  }

  function draw(current, initial, action) {
    const body = current.bodies[0], original = initial.bodies[0];
    const left = 62, right = 380, top = 72, bottom = 334;
    const xValues = [0, body.positionM[0] - body.shape.radiusM, body.positionM[0] + body.shape.radiusM,
      original.positionM[0] - original.shape.radiusM, original.positionM[0] + original.shape.radiusM];
    const yValues = [0, body.positionM[1] - body.shape.radiusM, body.positionM[1] + body.shape.radiusM,
      original.positionM[1] - original.shape.radiusM, original.positionM[1] + original.shape.radiusM];
    const xMin = Math.min(...xValues), xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues), yMax = Math.max(...yValues);
    const xSpan = Math.max(xMax - xMin, 0.5) * 1.15;
    const ySpan = Math.max(yMax - yMin, 0.5) * 1.15;
    const scale = Math.min((right - left) / xSpan, (bottom - top) / ySpan);
    const project = point => [(left + right) / 2 + (point[0] - (xMin + xMax) / 2) * scale,
      (top + bottom) / 2 - (point[1] - (yMin + yMax) / 2) * scale];
    const value = number => number.toFixed(8);
    context.save();
    try {
      context.fillStyle = '#101820';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.font = '15px sans-serif';
      context.fillStyle = '#D2E2ED';
      context.fillText('Actual Physics state / host XY projection in metres', 22, 28);
      context.font = '12px sans-serif';
      context.fillStyle = '#92A5B9';
      context.fillText('No clock. Each action requests fixed public steps.', 22, 49);

      for (let index = 0; index <= 4; index++) {
        const yM = yMin + (yMax - yMin) * index / 4;
        const y = project([0, yM])[1];
        context.strokeStyle = '#293B4B';
        context.setLineDash([]);
        context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
        context.fillStyle = '#92A5B9';
        context.fillText(yM.toFixed(3) + ' m', 8, y + 4);
      }
      const zeroY = project([0, 0])[1];
      context.strokeStyle = '#6B7D90';
      context.setLineDash([5, 5]);
      context.beginPath(); context.moveTo(left, zeroY); context.lineTo(right, zeroY); context.stroke();
      context.fillStyle = '#92A5B9';
      context.fillText('Y=0 reference / no collision ground', left, bottom + 24);

      const initialPoint = project(original.positionM);
      context.strokeStyle = '#92A5B9';
      context.lineWidth = 2;
      context.setLineDash([4, 4]);
      context.beginPath(); context.arc(initialPoint[0], initialPoint[1], original.shape.radiusM * scale, 0, Math.PI * 2); context.stroke();
      const point = project(body.positionM);
      context.setLineDash([]);
      context.fillStyle = '#F1AA55';
      context.beginPath(); context.arc(point[0], point[1], body.shape.radiusM * scale, 0, Math.PI * 2); context.fill();

      const rows = [
        'Accepted step: ' + current.stepIndex,
        'Time: ' + value(current.timeSeconds) + ' s',
        'Y: ' + value(body.positionM[1]) + ' m',
        'Vy: ' + value(body.velocityMps[1]) + ' m/s',
        'X: ' + value(body.positionM[0]) + ' m',
        'Z: ' + value(body.positionM[2]) + ' m',
        'Radius: ' + value(body.shape.radiusM) + ' m',
        'Contacts: ' + current.contacts.length,
        'Initial Y: ' + value(original.positionM[1]) + ' m',
      ];
      context.fillStyle = '#D2E2ED';
      rows.forEach((text, index) => context.fillText(text, 405, 88 + index * 23));
      context.fillStyle = '#92A5B9';
      context.fillText('Dashed circle: copied initial state', 22, 388);
      context.fillText('Action: ' + action + ' / no automatic next step', 22, 408);
    } finally {
      context.restore();
    }
  }

  function report() {
    const body = state.bodies[0];
    return {
      backend: 'Physics CPU steps → host Canvas2D projection',
      sourceType: 'PhysicsWorldConfig',
      fixedStepSeconds: PHYSICS_SAMPLE_STEP,
      stepIndex: state.stepIndex, timeSeconds: state.timeSeconds,
      bodyId: body.id, radiusM: body.shape.radiusM,
      positionM: [...body.positionM], velocityMps: [...body.velocityMps],
      yM: body.positionM[1], velocityYMps: body.velocityMps[1],
      baselinePositionM: [...baseline.bodies[0].positionM],
      contactCount: state.contacts.length, lastAction, disposed,
      projection: 'Host XY in metres; Y=0 is a reference line, not a collider.',
      canvasSize: { width: 640, height: 420 },
    };
  }

  function replace(text, action) {
    active();
    // JSON/native/profile admission completes before touching accepted authority or pixels.
    const candidate = preparePhysicsSample(text);
    try { draw(candidate.state, candidate.state, action); }
    catch (error) { candidate.world.dispose(); throw error; }
    const previous = world;
    world = candidate.world; state = candidate.state; baseline = candidate.state;
    acceptedSource = text; lastAction = action;
    previous.dispose();
    return report();
  }

  const controller = {
    update(text) { return replace(text, 'new accepted input'); },
    report,
    action(id) {
      active();
      if (id === 'reset') return replace(acceptedSource, 'reset');
      if (id === 'invalid-step') {
        // Actual INVALID_STEP occurs before any host state or frame assignment.
        world.step(1 / 60);
        throw new Error('Unexpected acceptance of the sample invalid step.');
      }
      if (id !== 'step-1' && id !== 'step-20') throw new Error('Unknown Physics sample action.');
      const count = id === 'step-1' ? 1 : 20;
      for (let index = 0; index < count; index++) {
        // Every step commits through the actual API; a multi-step action is not atomic.
        state = world.step(PHYSICS_SAMPLE_STEP);
        lastAction = id;
        draw(state, baseline, id);
      }
      return report();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      world.dispose();
    },
  };
  try { draw(state, baseline, lastAction); }
  catch (error) { controller.dispose(); throw error; }
  return controller;
}
