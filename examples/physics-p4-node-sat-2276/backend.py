"""Explicit Node compact backend; scalar and cold QP remain in Python."""
from dataclasses import dataclass
import struct


@dataclass(frozen=True)
class BodyInput:
    id: str
    body: dict


class GeometryFacade:
    @staticmethod
    def prepare(body, _):
        return BodyInput(body['id'], body)


class MeterFacade:
    def __init__(self, worker):
        self.worker = worker

    @property
    def models(self):
        return self.worker.stats['conventionProblems']

    @property
    def axes(self):
        return self.worker.stats['axisVisits']

    def stats(self):
        return dict(self.worker.stats)


class CompactBackend:
    def __init__(self, worker):
        self.worker = worker

    def compact(self, a, b, original_a, original_b, stage, scalar_query, _, __):
        candidate = self.worker.request('pair', stage=stage, aId=a.id, bId=b.id)
        if candidate['pairKey'] != a.id + '\0' + b.id:
            raise ValueError('NODE_PAIR_KEY')
        scalar = scalar_query(original_a, original_b)
        record = dict(pairKey=candidate['pairKey'])
        for name, value in candidate['fields'].items():
            record[name] = struct.unpack('<d', bytes.fromhex(value['word']))[0]
        record['selection'] = {name:scalar[name] for name in ('normal','boundM','candidateIndex','pointM','rawAxisLength','label','feature')}
        record['ties'] = scalar['ambiguity']
        record['satCertificateV2'] = dict(protocol='p4-compact-observer-v2', numericIntervals=candidate['fields'],
            raw=candidate['raw'], normalized=candidate['normalized'], physicalGates=candidate['physicalGates'],
            absoluteIntervalWidthLimitM='1e-25', axisArithmetic='EXACT_INTEGER_ALL_15_AXES_BOTH_MODELS',
            omittedLegacyField='precisionMaxDifferenceM', oldDecimalRuns=0,
            exactWinnerUsedForScalarSelection=False, scalarCandidateAxes=15)
        return record


def observer_type(original_type):
    class NodePositionObserver(original_type):
        def begin(self, request):
            super().begin(request)
            worker = self.compact_backend.worker
            worker.request('begin', **{stage:[v.body for v in self.states[stage]['prepared'].values()]
                                      for stage in ('PRE','HYP')})

        def evaluate(self, request):
            reply = super().evaluate(request)
            self.compact_backend.worker.request('barrier')
            return reply
    return NodePositionObserver
