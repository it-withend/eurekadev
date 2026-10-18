import { useState } from 'react';
import { validateParams } from '@core/params';
import type { ExperimentDefinition, Recording } from '@core/types';
import { ParamForm } from './ParamForm';
import { StepHeading } from './Steps';
import { useTone, VirtualScene } from './VirtualScene';

/**
 * Virtual-lab mode: set up the apparatus with sliders, watch it move, and run
 * a simulated measurement that is analysed exactly like a real one.
 */
export function VirtualPanel({
  def,
  params,
  onParamsChange,
  onResult,
}: {
  def: ExperimentDefinition;
  params: Record<string, number>;
  onParamsChange: (p: Record<string, number>) => void;
  onResult: (rec: Recording) => void;
}) {
  const lab = def.virtual!;
  const [knobs, setKnobs] = useState<Record<string, number>>(() => Object.fromEntries(lab.controls.map((c) => [c.id, c.default])));
  const [runs, setRuns] = useState(0);
  const playTone = useTone();
  const invalid = Object.keys(validateParams(def.params, params)).length > 0;

  const tubeNote = () => {
    const v = 331.3 * Math.sqrt(1 + (params.temperature ?? 20) / 273.15);
    const open = params.mode === 1;
    return open ? v / (2 * (params.length + 0.6 * params.diameter)) : v / (4 * (params.length + 0.3 * params.diameter));
  };

  return (
    <section className="panel measure virtual-panel no-print" id="step-measure" data-tour="measure">
      <StepHeading id="step-measure">Virtual lab</StepHeading>
      <p className="hint step-intro">
        Change the set-up and watch what happens. Then run the experiment: the simulated sensor data is analysed exactly like a
        real measurement.
      </p>
      <VirtualScene lab={lab} params={params} knobs={knobs} />
      {lab.scene === 'tube' && !invalid && (
        <button className="chip" onClick={() => playTone(tubeNote())}>
          🔊 Hear the note ({tubeNote().toFixed(0)} Hz)
        </button>
      )}
      <ParamForm specs={def.params} values={params} onChange={onParamsChange} />
      {lab.controls.map((c) => (
        <div key={c.id} className="param slider">
          <label className="param-label" htmlFor={`knob-${c.id}`}>
            {c.label}: <strong>{knobs[c.id]}</strong> {c.unit}
          </label>
          <input
            id={`knob-${c.id}`}
            type="range"
            min={c.min}
            max={c.max}
            step={c.step}
            value={knobs[c.id]}
            onChange={(e) => setKnobs({ ...knobs, [c.id]: Number(e.target.value) })}
          />
          {c.presets && (
            <span className="chips">
              {c.presets.map((p) => (
                <button key={p.label} className={`chip${knobs[c.id] === p.value ? ' on' : ''}`} onClick={() => setKnobs({ ...knobs, [c.id]: p.value })}>
                  {p.label}
                </button>
              ))}
            </span>
          )}
        </div>
      ))}
      <div className="actions">
        <button
          className="primary"
          data-tour="start"
          disabled={invalid}
          onClick={() => {
            setRuns(runs + 1);
            onResult(lab.simulate(params, knobs, Date.now() % 100000));
          }}
        >
          ▶ Run virtual experiment
        </button>
        {invalid && <p className="param-error">Fix the highlighted values first.</p>}
      </div>
      <p className="hint">
        Try it: double the length — does the swing time double? Then switch to <strong>Real lab</strong> and measure it for real.
      </p>
    </section>
  );
}
