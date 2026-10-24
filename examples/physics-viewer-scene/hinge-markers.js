const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const sub = (a, b) => a.map((value, index) => value - b[index]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (value) => value.map((component) => component / Math.hypot(...value));

export function hingeProxyPoints(bodies) {
  const [a, b] = bodies;
  const anchor = (body, localX) => [
    body.positionM[0] + localX * (1 - 2 * body.orientation[2] ** 2),
    body.positionM[1] + localX * 2 * body.orientation[2] * body.orientation[3],
    body.positionM[2],
  ];
  const anchorA = anchor(a, 0.1), anchorB = anchor(b, -0.1);
  return { a: a.positionM, b: b.positionM,
    pivot: anchorA.map((value, index) => (value + anchorB[index]) / 2),
    gapM: Math.hypot(...sub(anchorA, anchorB)) };
}

/** Project proxy points with the Viewer camera. The overlay does not test depth occlusion. */
export function drawHingeMarkers(viewer, canvas, svg, bodies) {
  const { camera } = viewer.getState();
  const width = canvas.getBoundingClientRect().width;
  const height = canvas.getBoundingClientRect().height;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const backward = unit(sub(camera.eye, camera.target));
  const forward = backward.map((value) => -value);
  const right = unit(cross(camera.up, backward));
  const up = cross(backward, right);
  const tangent = Math.tan(camera.fovY * Math.PI / 360);
  const project = (point) => {
    const offset = sub(point, camera.eye);
    const depth = dot(offset, forward);
    if (depth < camera.near || depth > camera.far) return null;
    return [width * (1 + dot(offset, right) / (depth * tangent * width / height)) / 2,
      height * (1 - dot(offset, up) / (depth * tangent)) / 2];
  };
  const points = hingeProxyPoints(bodies);
  const projected = Object.fromEntries(['a', 'b', 'pivot'].map((key) =>
    [key, project(points[key])]));
  for (const key of ['a', 'b', 'pivot']) {
    const marker = document.getElementById(`marker-${key}`);
    const label = document.getElementById(`label-${key}`);
    const point = projected[key];
    marker.style.display = label.style.display = point ? '' : 'none';
    if (!point) continue;
    if (key === 'pivot') marker.setAttribute('transform', `translate(${point[0]} ${point[1]})`);
    else { marker.setAttribute('cx', point[0]); marker.setAttribute('cy', point[1]); }
    label.setAttribute('x', point[0] + 12);
    label.setAttribute('y', point[1] - 12);
  }
  for (const key of ['a', 'b']) {
    const arm = document.getElementById(`arm-${key}`);
    arm.style.display = projected[key] && projected.pivot ? '' : 'none';
    if (projected[key] && projected.pivot) {
      arm.setAttribute('x1', projected[key][0]); arm.setAttribute('y1', projected[key][1]);
      arm.setAttribute('x2', projected.pivot[0]); arm.setAttribute('y2', projected.pivot[1]);
    }
  }
  return { ...points, screen: projected };
}
