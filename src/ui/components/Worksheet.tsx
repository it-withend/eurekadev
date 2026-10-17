import { useEffect, useState } from 'react';
import type { ExperimentDefinition } from '@core/types';
import { load, save } from '../storage';
import { StepHeading } from './Steps';

interface Sheet {
  name: string;
  hypothesis: string;
  conclusion: string;
}

const EMPTY: Sheet = { name: '', hypothesis: '', conclusion: '' };

/**
 * Turns a measurement into a lab assignment: the student states a hypothesis,
 * writes a conclusion and reflects on error sources. Printed with the report.
 */
export function Worksheet({ def }: { def: ExperimentDefinition }) {
  const key = `pocketlab.sheet.${def.id}`;
  const [sheet, setSheet] = useState<Sheet>(() => ({ ...EMPTY, ...load<Partial<Sheet>>(key, {}) }));
  useEffect(() => save(key, sheet), [key, sheet]);
  const field = (k: keyof Sheet) => ({
    value: sheet[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setSheet({ ...sheet, [k]: e.target.value }),
  });

  return (
    <section className="worksheet" id="step-report" data-tour="worksheet">
      <StepHeading id="step-report">Write up your lab report</StepHeading>
      <div className="no-print sheet-form">
        <label>
          <span>Name and class</span>
          <input type="text" placeholder="e.g. Aigerim, Grade 10B" {...field('name')} />
        </label>
        <label>
          <span>Hypothesis: what do you expect, and why?</span>
          <textarea rows={2} placeholder="I expect g to be close to 9.8 m/s² because…" {...field('hypothesis')} />
        </label>
        <label>
          <span>Conclusion: did the result support your hypothesis?</span>
          <textarea rows={3} placeholder="My measured value was … which differs from the accepted value by … because…" {...field('conclusion')} />
        </label>
      </div>
      <div className="print-only sheet-print">
        <p><strong>Student:</strong> {sheet.name || '________________'}</p>
        <p><strong>Hypothesis:</strong> {sheet.hypothesis || '________________________________'}</p>
        <p><strong>Conclusion:</strong> {sheet.conclusion || '________________________________'}</p>
      </div>
      {def.errorSources && (
        <>
          <h3>Discuss: possible sources of error</h3>
          <ul className="error-sources">
            {def.errorSources.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
