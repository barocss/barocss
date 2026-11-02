import { PhysicsError } from '../capsule-query-error.js';
import { QUERY_CAP } from './profile.js';
import { clone, dot } from './math.js';
import { errorRecord } from './state.js';
export function queryContext(query, candidate, diagnostic, capture) {
    function raw(position, delta, kind, preview, excludeId = null) {
        if (candidate.queryCount >= (diagnostic.queryBudget ?? QUERY_CAP)) {
            throw new PhysicsError('WORLD_LIMIT', 'Controller per-step query limit exhausted');
        }
        const input = {
            revision: candidate.sceneRevision, centerM: [...position], displacementM: [...delta], excludeId,
        };
        const index = candidate.queryCount;
        candidate.queryCount++;
        let hit;
        try {
            hit = query.sweep(input);
        }
        catch (error) {
            if (capture)
                candidate.lastQueries.push({ kind, preview, input: clone(input), hit: null, error: errorRecord(error) });
            throw error;
        }
        if (capture)
            candidate.lastQueries.push({ kind, preview, input: clone(input), hit: clone(hit), error: null });
        return { hit, indices: [index] };
    }
    function sweep(position, delta, kind, preview = false) {
        const first = raw(position, delta, kind, preview);
        if (first.hit?.toiFraction === 0 && dot(first.hit.normalFixtureToCapsule, delta) >= -1e-12) {
            const second = raw(position, delta, kind + '-fresh-touch-departure', preview, first.hit.bodyId);
            if (second.hit?.toiFraction === 0)
                throw new PhysicsError('INVALID_COMMAND', 'Controller second fresh touch is unresolved');
            return { hit: second.hit, indices: [...first.indices, ...second.indices] };
        }
        return first;
    }
    function commit(position, delta, kind, indices) {
        const target = position.map((value, index) => value + delta[index]);
        if (capture)
            candidate.lastSegments.push({
                kind, fromM: [...position], displacementM: [...delta], toM: [...target], queryIndices: [...indices],
            });
        return target;
    }
    return { sweep, commit };
}
