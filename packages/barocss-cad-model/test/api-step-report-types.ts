// Additive public contract. This guard is checked after the API is implemented; it is not a runtime baseline.
import { part, type StepReport as ModelStepReport } from '../src/api/index';
import { Part, kernelBackend, type PartBackend, type StepReport } from '../../barocss-cad/src/api/index';

const legacyBackend: PartBackend<ReturnType<typeof kernelBackend.empty>> = {
  ...kernelBackend,
  step: (_doc, _name): string => 'legacy text',
};
const legacyPart = new Part(legacyBackend, 'legacy', legacyBackend.empty());
const legacyText: string = legacyPart.step();
const report: StepReport = part('example').stepReport();
const sameShape: ModelStepReport = report;
const text: string = report.text;
const source: string = report.source;
const omitted: string[] | undefined = report.omitted;
const withoutLosses: StepReport = { text: 'STEP', source: 'revision' };
const supported: PartBackend<ReturnType<typeof kernelBackend.empty>> = {
  ...legacyBackend,
  stepReport: (_doc, _name) => ({ text: 'STEP', source: 'producer', omitted: ['loss'] }),
};
// @ts-expect-error legacy step remains a string, not a report
const wrongLegacy: StepReport = legacyPart.step();
// @ts-expect-error source provenance is required when a backend supports reports
const missingSource: StepReport = { text: 'STEP' };
// @ts-expect-error loss messages are strings, not inferred loss flags
const wrongLosses: StepReport = { text: 'STEP', source: 'revision', omitted: [true] };
void [legacyText, sameShape, text, source, omitted, withoutLosses, supported, wrongLegacy, missingSource, wrongLosses];
