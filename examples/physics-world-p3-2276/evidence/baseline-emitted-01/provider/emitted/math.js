export function multiplyQuaternion(a, b) {
    const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
    return [aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz];
}
export function advanceOrientation(orientation, angularVelocity, dt) {
    const speed = Math.hypot(...angularVelocity);
    if (speed === 0)
        return [...orientation];
    const halfAngle = speed * dt / 2;
    const scale = Math.sin(halfAngle) / speed;
    const delta = [angularVelocity[0] * scale, angularVelocity[1] * scale,
        angularVelocity[2] * scale, Math.cos(halfAngle)];
    const next = multiplyQuaternion(delta, orientation);
    const norm = Math.hypot(...next);
    return next.map((component) => component / norm);
}
export const add = (a, b) => a.map((value, index) => value + b[index]);
export const sub = (a, b) => a.map((value, index) => value - b[index]);
export const scale = (a, value) => a.map((component) => component * value);
export const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const inverse = (q) => [-q[0], -q[1], -q[2], q[3]];
export function rotate(q, v) {
    const axis = [q[0], q[1], q[2]];
    const t = scale(cross(axis, v), 2);
    return add(v, add(scale(t, q[3]), cross(axis, t)));
}
export const localPoint = (body, point) => rotate(inverse(body.orientation), sub(point, body.positionM));
export const worldPoint = (body, point) => add(body.positionM, rotate(body.orientation, point));
export function inverseInertia(body, vector) {
    const local = rotate(inverse(body.orientation), vector);
    return rotate(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]));
}
export function inertia(body, vector) {
    const local = rotate(inverse(body.orientation), vector);
    return rotate(body.orientation, local.map((value, index) => value / body.inverseInertiaLocal[index]));
}
