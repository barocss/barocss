/** Exact World predicates on one publicly validated complete material Body. */
export function classifyPairedSurfaceMaterialBodyWorldQueriesTrusted(body, queries, q, counts, callbacks) {
    const check = (condition, detail) => { if (!condition)
        callbacks.fail('BINDING', detail); };
    const same = (a, b) => {
        if (Array.isArray(a) || Array.isArray(b))
            return Array.isArray(a) && Array.isArray(b) &&
                a.length === b.length && a.every((value, i) => same(value, b[i]));
        if (a && b && typeof a === 'object' && typeof b === 'object') {
            const x = a, y = b;
            return Object.keys(x).length === Object.keys(y).length &&
                Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
        }
        return Object.is(a, b);
    };
    const compare = (a, b) => { counts.signComparisonCount++; return q.compare(a, b); };
    const fractionCache = new Map();
    const read = (f) => {
        const key = f.numerator + '/' + f.denominator;
        let result = fractionCache.get(key);
        if (result === undefined) {
            result = q.rat(BigInt(f.numerator), BigInt(f.denominator));
            fractionCache.set(key, result);
        }
        return result;
    };
    const zero = q.integer(0), one = q.integer(1);
    const material = body.proof.material, profile = material.profile;
    const paired = body.request.a.request.section;
    check(same(paired, body.request.b.request.section) && material.bodyId === body.body.id &&
        material.shellId === body.shell.id && material.certificateId === body.body.materialCertificateId &&
        body.body.closed && body.body.solid && body.body.restrictedSolidCertified &&
        material.sourceDefinedOccupiedRegion && material.wholeBoundaryImage && material.outwardMaterial &&
        material.embeddedClosedBoundary && material.restrictedSolidCertified && material.parentFlagsUnchanged &&
        material.cubeMap.globallyInjective && profile.aXIdentity && profile.aYIdentity && profile.bXShiftIdentity &&
        profile.bZIdentity && profile.unitPositiveAxes && profile.constantPositiveWeights, 'Actual full material Body/source-defined certificate and unit-axis authority required');
    const aProfile = paired.proof.profiles[0], bProfile = paired.proof.profiles[1];
    const offset = read(profile.originalUBOffset), ubScale = read(profile.originalUBScale);
    check(compare(ubScale, one) === 0 && compare(read(paired.proof.originalUB.scale), one) === 0 &&
        compare(offset, read(paired.proof.originalUB.offset)) === 0, 'OriginalUB map must retain the actual certified unit scale and offset');
    check(compare(read(aProfile.xU[0]), zero) === 0 && compare(read(aProfile.xU[1]), one) === 0 &&
        aProfile.xU.slice(2).every(f => compare(read(f), zero) === 0) &&
        aProfile.yU.every(f => compare(read(f), zero) === 0) && compare(read(aProfile.yV[0]), zero) === 0 &&
        compare(read(aProfile.yV[1]), one) === 0 && compare(read(bProfile.xU[0]), q.neg(offset)) === 0 &&
        compare(read(bProfile.xU[1]), one) === 0 && bProfile.xU.slice(2).every(f => compare(read(f), zero) === 0) &&
        bProfile.yV.every(f => compare(read(f), zero) === 0) && compare(read(bProfile.zUV[0][0]), zero) === 0 &&
        compare(read(bProfile.zUV[0][1]), one) === 0 &&
        bProfile.zUV.slice(1).every(row => row.every(f => compare(read(f), zero) === 0)), 'Actual original-UA/VA/UB/VB power profiles must prove the physical unit axes without normalization');
    check(profile.bYPower.length === bProfile.yU.length && profile.aZPower.length === aProfile.zUV.length &&
        profile.bYPower.every((f, i) => compare(read(f), read(bProfile.yU[i])) === 0) &&
        profile.aZPower.every((row, i) => row.length === 2 && row.every((f, j) => compare(read(f), read(aProfile.zUV[i][j])) === 0)), 'Material query coefficients must match the complete actual ORIGINAL native-coordinate source coefficients');
    for (const index of [0, 1]) {
        const asset = paired.request.assets[index], model = paired.originalModels[index], selection = paired.report.selections[index];
        const sourceProfile = paired.proof.profiles[index], surface = asset.surface;
        check(selection.assetIndex === index && selection.sourceId === asset.sourceId && selection.surfaceId === surface.id &&
            selection.modelName === model.name && same(model.objects[selection.objectIndex], surface) &&
            same(sourceProfile.domain, selection.nativeDomains) && sourceProfile.degreeU === surface.degreeU &&
            sourceProfile.degreeV === surface.degreeV && sourceProfile.originalCartesian.length === surface.controlPoints.length, 'Actual original Surface selection/profile/whole Model context must bind');
        const weight = surface.weights[0][0];
        check(weight > 0 && surface.weights.every(row => row.every(value => Object.is(value, weight))) &&
            compare(read(sourceProfile.uniformWeight), q.from(weight)) === 0 &&
            surface.controlPoints.every((row, i) => row.length === sourceProfile.originalCartesian[i].length &&
                row.every((point, j) => point.every((value, axis) => compare(q.from(value), read(sourceProfile.originalCartesian[i][j][axis])) === 0))), 'Whole actual selected control grid and positive constant weights must match the inherited source polynomial certificate');
    }
    const window = material.cubeMap.domain.u, lowY = read(material.cubeMap.lowY), lowZ = read(material.cubeMap.lowZ);
    check(same(window, paired.request.uAInterval) && same(material.cubeMap.domain.s, [0, 1]) &&
        same(material.cubeMap.domain.t, [0, 1]) && compare(q.from(window[1]), q.from(window[0])) > 0 &&
        compare(lowY, q.from(paired.report.selections[0].nativeDomains.v[0])) === 0 &&
        compare(lowZ, q.from(paired.report.selections[1].nativeDomains.v[0])) === 0 &&
        compare(read(material.cubeMap.minimumHeightY), zero) > 0 &&
        compare(read(material.cubeMap.minimumHeightZ), zero) > 0 && compare(read(material.cubeMap.minimumJacobian), zero) > 0, 'Actual occupied window/lows/strict positive-height inverse authority required');
    const resolve = (ref) => {
        let value = body;
        for (const part of ref.modelField.match(/[A-Za-z_][A-Za-z0-9_]*|\d+/g) ?? []) {
            check(value !== null && typeof value === 'object' && Object.hasOwn(value, part), 'Actual parent Model reference path must resolve');
            value = value[part];
        }
        const model = value;
        check(model.name === ref.modelName && Number.isInteger(ref.objectIndex) && ref.objectIndex >= 0 &&
            ref.objectIndex < model.objects.length && model.objects[ref.objectIndex].id === ref.objectId, 'Actual source-qualified Model/name/object selector must bind');
        let source = body;
        for (const part of ref.sourceField.match(/[A-Za-z_][A-Za-z0-9_]*|\d+/g) ?? []) {
            check(source !== null && typeof source === 'object' && Object.hasOwn(source, part), 'Actual parent source reference path must resolve');
            source = source[part];
        }
        check(typeof source === 'string', 'Actual retained native source string required');
        return model.objects[ref.objectIndex];
    };
    const roles = ['roof', 'side', 'yMin', 'zMin', 'xMin', 'xMax'];
    check(body.faces.length === 6 && material.faceImages.length === 6 && same(material.faceIds, body.faces.map(f => f.id)) &&
        same(body.shell.faceIds, body.faces.map(f => f.id)), 'Actual six Face/Shell/material identities must bind');
    const faceRefs = roles.map((role, i) => {
        const face = body.faces[i], image = material.faceImages[i];
        check(face.role === role && image.role === role && image.faceId === face.id && image.wholeImageEqual &&
            image.storedLocalUsesUnchanged && same(image.supportRef, face.supportRef) &&
            same(image.originalSupport, face.support) && same(resolve(face.supportRef), face.support), 'Every actual boundary role/Face/whole source image must resolve without guessing IDs');
        return { parentField: 'request.body', role, faceId: face.id, supportRef: { ...face.supportRef } };
    });
    const sourceRefs = material.sourceRefs.map((reference) => {
        resolve(reference);
        return { parentField: 'request.body', reference: { ...reference } };
    });
    const source = { bodyId: body.body.id, shellId: body.shell.id,
        materialCertificateId: material.certificateId, originalUAInterval: [...window],
        originalUBOffset: q.text(offset), originalUBScale: q.text(ubScale), lowY: q.text(lowY), lowZ: q.text(lowZ),
        bYOriginalUBPower: profile.bYPower.map(f => ({ ...f })),
        aZOriginalUAVAPower: profile.aZPower.map(row => row.map(f => ({ ...f }))), sourceRefs, faceRefs,
        unitAxisSourceAuthority: true, wholeMaterialParentUnchanged: true };
    const yCoefficients = profile.bYPower.map(read), zCoefficients = profile.aZPower.map(row => row.map(read));
    const horner = (values, argument) => {
        let result = zero;
        for (let i = values.length - 1; i >= 0; i--)
            result = q.add(q.mul(result, argument), values[i]);
        return result;
    };
    const constraint = (role, difference) => ({ role, difference: q.text(difference), sign: compare(difference, zero) });
    const classifications = [], queryProofs = [];
    for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
        const query = queries[queryIndex];
        callbacks.beginQuery(queryIndex);
        counts.queryCount++;
        callbacks.beginStage('x');
        const [x, y, z] = query.pointMM.map(value => q.from(value));
        const xConstraints = [constraint('xMin', q.sub(x, q.from(window[0]))),
            constraint('xMax', q.sub(q.from(window[1]), x))];
        let originalUB = null, yRoof = null, zRoof = null;
        let yConstraints = null, zConstraints = null;
        let decision = 'outside-x';
        if (xConstraints.every(c => c.sign >= 0)) {
            callbacks.beginStage('y');
            originalUB = q.add(x, offset);
            counts.yRoofEvaluationCount++;
            yRoof = horner(yCoefficients, originalUB);
            yConstraints = [constraint('yMin', q.sub(y, lowY)), constraint('side', q.sub(yRoof, y))];
            decision = 'outside-y';
            if (yConstraints.every(c => c.sign >= 0)) {
                callbacks.beginStage('z');
                counts.zRoofEvaluationCount++;
                zRoof = horner(zCoefficients.map(row => horner(row, y)), x);
                zConstraints = [constraint('zMin', q.sub(z, lowZ)), constraint('roof', q.sub(zRoof, z))];
                decision = zConstraints.some(c => c.sign < 0) ? 'outside-z' : 'inside';
            }
        }
        const boundaryFaces = [];
        if (decision === 'inside') {
            const zeroRoles = new Set([...xConstraints, ...yConstraints, ...zConstraints].filter(c => c.sign === 0).map(c => c.role));
            for (const face of source.faceRefs)
                if (zeroRoles.has(face.role))
                    boundaryFaces.push({ ...face, supportRef: { ...face.supportRef } });
            if (boundaryFaces.length)
                decision = 'boundary';
        }
        const classification = { queryId: query.queryId,
            status: decision === 'inside' ? 'inside' : decision === 'boundary' ? 'boundary' : 'outside', bodyId: source.bodyId,
            materialCertificateId: source.materialCertificateId, boundaryFaces };
        const proof = { queryId: query.queryId, pointExact: [q.text(x), q.text(y), q.text(z)], decision,
            x: xConstraints, originalUB: originalUB === null ? null : q.text(originalUB),
            yRoof: yRoof === null ? null : q.text(yRoof), y: yConstraints,
            zRoof: zRoof === null ? null : q.text(zRoof), z: zConstraints, classification };
        classifications.push(classification);
        queryProofs.push(proof);
        callbacks.retainQuery(classification, proof);
    }
    return { source, classifications, queries: queryProofs };
}
