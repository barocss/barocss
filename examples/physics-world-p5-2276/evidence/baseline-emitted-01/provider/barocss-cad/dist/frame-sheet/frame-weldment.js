/** The signed sweep of an arc segment from its start to `end` (anticlockwise positive), a full turn when they meet. */
function arcSweep(g, end) {
    const c = g.center, r = Math.hypot(g.start[0] - c[0], g.start[1] - c[1]), a0 = Math.atan2(g.start[1] - c[1], g.start[0] - c[0]);
    let d = Math.atan2(end[1] - c[1], end[0] - c[0]) - a0;
    if (g.direction === 'ccw') {
        while (d <= 1e-15)
            d += 2 * Math.PI;
    }
    else {
        while (d >= -1e-15)
            d -= 2 * Math.PI;
    }
    return { r, a0, d };
}
/** The area a loop of lines and arcs encloses (each segment from its start to the next one's), by Green's theorem: closed form, unsigned. */
export function loopArea(loop) {
    let A = 0;
    for (let i = 0; i < loop.length; i++) {
        const g = loop[i], e = loop[(i + 1) % loop.length].start;
        if (g.kind === 'line') {
            A += (g.start[0] * e[1] - e[0] * g.start[1]) / 2;
            continue;
        }
        const { r, a0, d } = arcSweep(g, e), c = g.center;
        A += 0.5 * (r * r * d + c[0] * r * (Math.sin(a0 + d) - Math.sin(a0)) - c[1] * r * (Math.cos(a0 + d) - Math.cos(a0)));
    }
    return Math.abs(A);
}
/** A loop's perimeter: lines' lengths and arcs' r·|sweep|, closed form. */
export function loopPerimeter(loop) {
    let L = 0;
    for (let i = 0; i < loop.length; i++) {
        const g = loop[i], e = loop[(i + 1) % loop.length].start;
        if (g.kind === 'line') {
            L += Math.hypot(e[0] - g.start[0], e[1] - g.start[1]);
            continue;
        }
        const { r, d } = arcSweep(g, e);
        L += r * Math.abs(d);
    }
    return L;
}
