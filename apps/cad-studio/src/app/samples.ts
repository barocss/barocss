// RS1 (owner 2026-10-24, "로봇 관련해서 좀 더 다양한 샘플"): the robot samples the outer lane keeps in cad-model
// (samples/robots: index.json and a .bcad each, every one with a demo motion), listed in Templates and opened as Open
// opens a file. The index is read when the studio loads; a sample's document only when it is opened.

export interface RobotSample { id: string; title: string; about: string; file: string }

const index = import.meta.glob('../../../../packages/barocss-cad-model/samples/robots/index.json', { eager: true, import: 'default' }) as Record<string, RobotSample[]>;
const files = import.meta.glob('../../../../packages/barocss-cad-model/samples/robots/*.bcad', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

/** The samples, in the index's order. */
export const ROBOT_SAMPLES: readonly RobotSample[] = Object.values(index)[0] ?? [];

/** A sample's document as a file, as Open takes it (its name the sample's file name). */
export async function robotSampleFile(sample: RobotSample): Promise<File> {
  const load = Object.entries(files).find(([path]) => path.endsWith('/' + sample.file))?.[1];
  if (!load) throw new Error(`The sample ${sample.title} has no file ${sample.file}.`);
  return new File([await load()], sample.file, { type: 'application/json' });
}
