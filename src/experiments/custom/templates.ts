import { LIBRARY } from '../library';
import { newCustomId, type CustomExperimentSpec } from './spec';

type Template = Omit<CustomExperimentSpec, 'id' | 'format' | 'version'>;

/** Starting points in the builder: the library experiments, plus a blank page. */
export const TEMPLATES: { key: string; emoji: string; name: string; spec: Template }[] = [
  ...LIBRARY.map((e) => ({ key: e.key, emoji: e.icon, name: e.name, spec: e.spec })),
  {
    key: 'blank',
    emoji: '✏️',
    name: 'Start from scratch',
    spec: {
      title: '',
      description: '',
      measure: 'period',
      durationSec: 15,
      variables: [],
      formula: '',
      result: { name: '', symbol: '', unit: '', digits: 3 },
      materials: [],
      instructions: [],
    },
  },
];

export function fromTemplate(t: Template): CustomExperimentSpec {
  return { ...structuredClone(t), format: 'pocketlab.experiment', version: 1, id: newCustomId(t.title || 'experiment') };
}
