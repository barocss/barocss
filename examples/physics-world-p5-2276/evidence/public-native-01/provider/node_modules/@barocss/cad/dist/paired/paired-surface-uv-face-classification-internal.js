/** Trusted exact predicates after public full-parent admission; no native/provider calls. */
export function classifyPairedSurfaceUVQueriesTrusted(a, b, queries, q, counts, callbacks) {
    const check = (condition, detail) => {
        if (!condition)
            callbacks.fail('BINDING', detail);
    };
    const same = (left, right) => {
        if (Array.isArray(left) || Array.isArray(right))
            return Array.isArray(left) && Array.isArray(right) &&
                left.length === right.length && left.every((value, i) => same(value, right[i]));
        if (left && right && typeof left === 'object' && typeof right === 'object') {
            const x = left, y = right;
            return Object.keys(x).length === Object.keys(y).length &&
                Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
        }
        return Object.is(left, right);
    };
    // Every root sign comparison, including support admission, charges its actual q.compare call.
    const compare = (left, right) => {
        counts.signComparisonCount++;
        return q.compare(left, right);
    };
    const read = (value) => q.rat(BigInt(value.numerator), BigInt(value.denominator));
    const zero = q.integer(0), one = q.integer(1);
    check(same(a.request.section, b.request.section), 'Both complete original paired-section parents must be bit-identical');
    const section = a.request.section;
    const originalUAInterval = section.request.uAInterval;
    const mapOffset = read(section.proof.originalUB.offset), mapScale = read(section.proof.originalUB.scale);
    check(compare(mapScale, zero) > 0, 'Actual B affine map must keep its certified positive originalUB scale');
    check(same(b.proof.parameterMap.originalUAInterval, originalUAInterval) &&
        compare(read(b.proof.parameterMap.offset), mapOffset) === 0 &&
        compare(read(b.proof.parameterMap.scale), mapScale) === 0 &&
        same(b.proof.parameterMap.originalUBInterval, b.proof.window.u), 'B native-window/unchanged-UA parameter certificate must bind the actual paired map');
    const parents = [a, b];
    const supports = [0, 1].map((assetIndex) => {
        const parent = parents[assetIndex], asset = section.request.assets[assetIndex];
        const model = section.originalModels[assetIndex], selection = section.report.selections[assetIndex];
        const cut = parent.edges[6], proof = parent.proof, parentSupport = proof.support;
        const uv = assetIndex === 0 ? section.pcurves.a : section.pcurves.b;
        const offset = assetIndex === 0 ? zero : mapOffset, scale = assetIndex === 0 ? one : mapScale;
        const window = proof.window;
        check(parent.edges.length === 7 && cut.role === 'sharedCut' &&
            cut.id === parent.report.sharedCutEdgeId && same(cut.curve, section.world.curve) &&
            same(cut.pcurve.curve, uv.curve) && cut.curve.id === parent.report.sharedWorldCurveId &&
            cut.pcurve.curve.id === parent.report.sharedPcurveId && proof.cut.worldCurveId === cut.curve.id &&
            proof.cut.pcurveId === cut.pcurve.curve.id && proof.cut.parentEvaluationId === section.request.options.evaluationId, 'Actual shared World/original-UV cut and parent authority must remain unchanged');
        check(parentSupport.sourceId === asset.sourceId && parentSupport.surfaceId === asset.surface.id &&
            parentSupport.modelName === model.name && parentSupport.objectIndex === selection.objectIndex &&
            selection.assetIndex === assetIndex && selection.sourceId === asset.sourceId &&
            selection.surfaceId === asset.surface.id && selection.modelName === model.name &&
            same(model.objects[selection.objectIndex], asset.surface) &&
            parentSupport.sourceField === `request.section.request.assets[${assetIndex}].source` &&
            parentSupport.modelField === `request.section.originalModels[${assetIndex}]` &&
            same(parent.report.support, parentSupport) && same(parent.report.window, window) &&
            same(window.v, selection.nativeDomains.v), 'Actual original source/Model object selection and original Face-window frame must bind by asset');
        check(parent.world.model.objects.length === 8 && same(parent.world.model.objects[0], asset.surface) &&
            cut.sourceRef.sourceField === 'world.source' && cut.sourceRef.modelField === 'world.model' &&
            cut.sourceRef.modelName === parent.world.model.name && cut.sourceRef.objectIndex === 7 &&
            cut.sourceRef.curveId === cut.curve.id && same(parent.world.model.objects[7], cut.curve), 'Actual retained WorldModel8 cut/source-qualified reference must resolve');
        check(parent.faces.length === 2 && parent.loops.length === 2 &&
            parent.faces[0].region === 'below-cut' && parent.faces[1].region === 'above-cut' &&
            parent.faces[0].id !== parent.faces[1].id && parent.proof.faceCertificates.length === 2 &&
            parent.faces.every((face, i) => face.sourceId === asset.sourceId && face.surfaceId === asset.surface.id &&
                face.outerLoopId === parent.loops[i].id && proof.faceCertificates[i].faceId === face.id &&
                proof.faceCertificates[i].loopId === face.outerLoopId && proof.faceCertificates[i].region === face.region &&
                proof.faceCertificates[i].orientation === face.orientation && proof.faceCertificates[i].closedDiskCertified &&
                proof.faceCertificates[i].exactWorldSurfaceAgreement), 'Both real complementary Face references and disk certificates must bind unchanged');
        const curve = uv.curve;
        check(curve.degree === 4 && curve.controlPoints.length === 5 && curve.knots.length === 10 &&
            same([curve.knots[4], curve.knots[5]], originalUAInterval) &&
            curve.weights.every(weight => Object.is(weight, 1)) && proof.cut.degree === 4 &&
            proof.cut.uCoefficients.length === 5 && proof.cut.vCoefficients.length === 5 &&
            proof.cut.lowerGaps.length === 5 && proof.cut.upperGaps.length === 5, 'Actual originalUV cut must retain its common degree4 native UA basis and full coefficient certificate');
        const uaWidth = q.sub(q.from(originalUAInterval[1]), q.from(originalUAInterval[0]));
        check(compare(uaWidth, zero) > 0 && compare(q.from(window.u[1]), q.from(window.u[0])) > 0 &&
            compare(q.from(window.v[1]), q.from(window.v[0])) > 0, 'Certified original windows must remain ordered and nonzero');
        for (let i = 0; i < 5; i++) {
            const actualU = q.from(curve.controlPoints[i][0]), actualV = q.from(curve.controlPoints[i][1]);
            const uaCoefficient = q.add(q.from(originalUAInterval[0]), q.mul(uaWidth, q.div(q.integer(i), q.integer(4))));
            check(compare(actualU, q.add(offset, q.mul(scale, uaCoefficient))) === 0 &&
                compare(actualU, read(proof.cut.uCoefficients[i])) === 0 &&
                compare(actualV, read(proof.cut.vCoefficients[i])) === 0 &&
                compare(q.from(curve.controlPoints[i][2]), zero) === 0, 'Actual stored originalUV coefficients must bind the exact affine frame and cut proof');
            const lowerGap = q.sub(actualV, q.from(window.v[0])), upperGap = q.sub(q.from(window.v[1]), actualV);
            check(compare(lowerGap, zero) > 0 && compare(upperGap, zero) > 0 &&
                compare(lowerGap, read(proof.cut.lowerGaps[i])) === 0 &&
                compare(upperGap, read(proof.cut.upperGaps[i])) === 0, 'Strict actual V-cut hull gaps and their inherited certificates are required for natural-boundary shortcut');
        }
        for (let i = 0; i < 2; i++)
            check(compare(q.from(window.u[i]), q.add(offset, q.mul(scale, q.from(originalUAInterval[i])))) === 0, 'Actual A/B selected native-U window must agree with its inherited affine endpoint map');
        return {
            reference: { assetIndex, sourceId: asset.sourceId, surfaceId: asset.surface.id,
                modelName: model.name, objectIndex: selection.objectIndex,
                sourceField: assetIndex === 0 ? 'request.a.request.section.request.assets[0].source' :
                    'request.b.request.section.request.assets[1].source',
                modelField: assetIndex === 0 ? 'request.a.request.section.originalModels[0]' :
                    'request.b.request.section.originalModels[1]' },
            parentEvaluationId: parent.report.evaluationId,
            window: { u: [...window.u], v: [...window.v] },
            faceIds: [parent.faces[0].id, parent.faces[1].id],
            orientations: [parent.faces[0].orientation, parent.faces[1].orientation],
            sharedCutEdgeId: cut.id, worldCurveId: cut.curve.id, pcurveId: curve.id,
            originalUAInterval: [...originalUAInterval], uMap: { offset: q.text(offset), scale: q.text(scale) },
            vCoefficients: curve.controlPoints.map(point => q.text(q.from(point[1]))),
        };
    });
    const classifications = [], queryProofs = [];
    for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
        const query = queries[queryIndex], assetIndex = query.assetIndex, support = supports[assetIndex];
        callbacks.beginQuery(assetIndex, queryIndex);
        counts.queryCount++;
        const u = q.from(query.u), v = q.from(query.v);
        const boundSigns = {
            uMinimum: compare(u, q.from(support.window.u[0])), uMaximum: compare(u, q.from(support.window.u[1])),
            vMinimum: compare(v, q.from(support.window.v[0])), vMaximum: compare(v, q.from(support.window.v[1])),
        };
        const outside = boundSigns.uMinimum < 0 || boundSigns.uMaximum > 0 ||
            boundSigns.vMinimum < 0 || boundSigns.vMaximum > 0;
        const boundaries = [];
        if (!outside) {
            if (boundSigns.uMinimum === 0)
                boundaries.push('u-min');
            if (boundSigns.uMaximum === 0)
                boundaries.push('u-max');
            if (boundSigns.vMinimum === 0)
                boundaries.push('v-min');
            if (boundSigns.vMaximum === 0)
                boundaries.push('v-max');
        }
        let method = 'outside-window', relation = 'not-applicable';
        let originalUA = null, normalized = null;
        let cutValue = null, vMinusCut = null, cutSign = null;
        const deCasteljau = [];
        if (!outside && (boundSigns.vMinimum === 0 || boundSigns.vMaximum === 0)) {
            method = 'natural-v-boundary';
            relation = boundSigns.vMinimum === 0 ? 'below' : 'above';
        }
        else if (!outside) {
            method = 'exact-affine-quartic';
            if (assetIndex === 1) {
                counts.affineInversionCount++;
                originalUA = q.div(q.sub(u, read(support.uMap.offset)), read(support.uMap.scale));
            }
            else
                originalUA = u;
            normalized = q.div(q.sub(originalUA, q.from(support.originalUAInterval[0])), q.sub(q.from(support.originalUAInterval[1]), q.from(support.originalUAInterval[0])));
            counts.quarticEvaluationCount++;
            let coefficients = support.vCoefficients.map(read);
            deCasteljau.push(coefficients.map(value => q.text(value)));
            const complement = q.sub(one, normalized);
            while (coefficients.length > 1) {
                coefficients = coefficients.slice(0, -1).map((value, i) => q.add(q.mul(complement, value), q.mul(normalized, coefficients[i + 1])));
                deCasteljau.push(coefficients.map(value => q.text(value)));
            }
            cutValue = coefficients[0];
            vMinusCut = q.sub(v, cutValue);
            cutSign = compare(vMinusCut, zero);
            relation = cutSign < 0 ? 'below' : cutSign > 0 ? 'above' : 'on';
        }
        const selectedBoundary = boundaries.length > 0;
        const faces = [0, 1].map((faceIndex) => {
            let classification = 'outside';
            if (relation === 'on')
                classification = 'boundary';
            else if (relation === (faceIndex === 0 ? 'below' : 'above'))
                classification = selectedBoundary ? 'boundary' : 'inside';
            return { sourceId: support.reference.sourceId, surfaceId: support.reference.surfaceId,
                faceId: support.faceIds[faceIndex], region: faceIndex === 0 ? 'below-cut' : 'above-cut',
                orientation: support.orientations[faceIndex], classification };
        });
        const classification = { queryId: query.queryId, assetIndex,
            window: outside ? 'outside' : boundaries.length ? 'boundary' : 'interior',
            windowBoundaries: boundaries, cutRelation: relation, faces };
        const proof = { queryId: query.queryId, assetIndex, queryUV: [q.text(u), q.text(v)], method,
            boundSigns, originalUA: originalUA === null ? null : q.text(originalUA),
            normalizedParameter: normalized === null ? null : q.text(normalized), deCasteljau,
            cutValue: cutValue === null ? null : q.text(cutValue), vMinusCut: vMinusCut === null ? null : q.text(vMinusCut),
            cutSign, classification };
        classifications.push(classification);
        queryProofs.push(proof);
        callbacks.retainQuery(classification, proof);
    }
    return { supports, classifications, queries: queryProofs };
}
