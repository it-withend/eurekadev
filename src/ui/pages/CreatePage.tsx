import { useRef, useState } from 'react';
import { compileFormula, evaluate } from '@core/expression';
import { MEASURES, type MeasureKind } from '@experiments/custom/measures';
import { validateSpec, type CustomExperimentSpec, type CustomVariable } from '@experiments/custom/spec';
import { fromTemplate, TEMPLATES } from '@experiments/custom/templates';
import { customStore } from '../customStore';
import { DecimalInput } from '../components/DecimalInput';
import { downloadText } from '../download';
import { href } from '../router';
import { Tour } from '../tour/Tour';
import { CREATE_TOUR } from '../tour/tours';

const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

function FieldError({ errors, field }: { errors: Record<string, string>; field: string }) {
  return errors[field] ? <span className="param-error">{errors[field]}</span> : null;
}

/** Live check of the formula: either a worked example or a precise error. */
function FormulaStatus({ spec }: { spec: CustomExperimentSpec }) {
  const measure = MEASURES[spec.measure];
  const formula = spec.formula.trim();
  if (!formula) {
    return (
      <p className="formula-status ok">
        No formula: the result will be the measured {measure.quantity.toLowerCase()} {measure.symbol} itself.
      </p>
    );
  }
  const compiled = compileFormula(formula, [measure.symbol, ...spec.variables.map((v) => v.symbol)]);
  if (!compiled.ok) {
    return (
      <p className="formula-status bad" role="alert">
        <code>
          {formula.slice(0, compiled.position)}
          <mark>{formula.slice(compiled.position, compiled.position + 1) || ' '}</mark>
          {formula.slice(compiled.position + 1)}
        </code>
        <br />
        {compiled.error}
      </p>
    );
  }
  const vals: Record<string, number> = { [measure.symbol]: measure.example };
  spec.variables.forEach((v) => (vals[v.symbol] = v.value));
  let value = NaN;
  try {
    value = evaluate(compiled.node, vals);
  } catch {
    // shown below as "no number"
  }
  const given = Object.entries(vals)
    .map(([k, v]) => `${k} = ${v}`)
    .join(', ');
  return (
    <p className={`formula-status ${Number.isFinite(value) ? 'ok' : 'bad'}`}>
      ✓ Formula understood. Example: with {given} → {spec.result.symbol || 'result'} ={' '}
      {Number.isFinite(value) ? value.toPrecision(4) : 'no number (division by zero?)'} {spec.result.unit}
    </p>
  );
}

function TemplatePicker({ onPick }: { onPick: (spec: CustomExperimentSpec) => void }) {
  return (
    <section>
      <h2>Start from an idea</h2>
      <p className="hint">Pick a ready-made idea and change it, or start from scratch.</p>
      <div className="templates">
        {TEMPLATES.map((t) => (
          <button key={t.key} className="template" onClick={() => onPick(fromTemplate(t.spec))}>
            <span className="template-emoji" aria-hidden="true">
              {t.emoji}
            </span>
            <strong>{t.name}</strong>
            <span>{t.spec.description || 'An empty experiment you design yourself.'}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function CreatePage({ id }: { id?: string }) {
  const existing = id ? customStore.get(id) : undefined;
  const [spec, setSpec] = useState<CustomExperimentSpec | null>(existing ? structuredClone(existing) : null);
  const [showErrors, setShowErrors] = useState(false);
  const formulaInput = useRef<HTMLInputElement>(null);

  if (id && !existing) {
    return (
      <p className="prose">
        This experiment no longer exists on this device. <a href={href({ page: 'create' })}>Create a new one</a>.
      </p>
    );
  }

  if (!spec) {
    return (
      <article className="create">
        <h1>Design your own experiment</h1>
        <p className="lede">
          Anything that swings, bounces, spins, jolts or makes a sound can be measured. Choose what the phone measures,
          add your own variables and formula — PocketLab does the signal processing, uncertainty and lab report.
        </p>
        <TemplatePicker onPick={setSpec} />
      </article>
    );
  }

  const measure = MEASURES[spec.measure];
  const errors = validateSpec(spec);
  const visibleErrors = showErrors ? errors : { formula: errors.formula };
  const update = (patch: Partial<CustomExperimentSpec>) => setSpec({ ...spec, ...patch });
  const setVar = (i: number, patch: Partial<CustomVariable>) =>
    update({ variables: spec.variables.map((v, k) => (k === i ? { ...v, ...patch } : v)) });

  const insert = (text: string) => {
    const el = formulaInput.current;
    const at = el?.selectionStart ?? spec.formula.length;
    update({ formula: spec.formula.slice(0, at) + text + spec.formula.slice(el?.selectionEnd ?? at) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + text.length, at + text.length);
    });
  };

  const saveAndOpen = () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      requestAnimationFrame(() => document.querySelector('.create .param-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    customStore.upsert(spec);
    window.location.hash = href({ page: 'experiment', id: spec.id });
  };

  return (
    <article className="create">
      <Tour id="create" steps={CREATE_TOUR} />
      <a className="back" href={href({ page: 'catalog' })}>
        ← All experiments
      </a>
      <h1>{existing ? 'Edit your experiment' : 'Design your own experiment'}</h1>

      <section className="panel" data-tour="create-basics">
        <h2 className="step-heading">
          <span className="step-no">1</span>Name it
        </h2>
        <div className="form-grid">
          <label className="wide">
            <span>Title</span>
            <input value={spec.title} maxLength={80} placeholder="e.g. Stiffness of a spring" onChange={(e) => update({ title: e.target.value })} />
            <FieldError errors={visibleErrors} field="title" />
          </label>
          <label className="wide">
            <span>What is it about? (optional)</span>
            <textarea rows={2} value={spec.description} maxLength={400} onChange={(e) => update({ description: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="panel" data-tour="create-measure">
        <h2 className="step-heading">
          <span className="step-no">2</span>What should the phone measure?
        </h2>
        <div className="measures" role="radiogroup">
          {(Object.keys(MEASURES) as MeasureKind[]).map((k) => {
            const m = MEASURES[k];
            return (
              <label key={k} className={`measure-option${spec.measure === k ? ' on' : ''}`}>
                <input type="radio" name="measure" checked={spec.measure === k} onChange={() => update({ measure: k })} />
                <span>
                  <strong>{m.label}</strong>
                  <span className="hint">
                    {m.sensor === 'audio' ? '🎤 Microphone' : '📱 Motion sensors'} · e.g. {m.examples}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <label className="inline-field">
          <span>Recording time</span>
          <DecimalInput value={spec.durationSec} onChange={(v) => update({ durationSec: v })} className="short" />
          <span className="unit">s</span>
        </label>
        <FieldError errors={visibleErrors} field="durationSec" />
      </section>

      <section className="panel">
        <h2 className="step-heading">
          <span className="step-no">3</span>Your variables
        </h2>
        <p className="hint">
          Things you measure yourself (a mass, a length…). The phone provides <code>{measure.symbol}</code> ({measure.quantity.toLowerCase()},{' '}
          {measure.unit}).
        </p>
        {spec.variables.map((v, i) => (
          <div key={i} className="var-row">
            <label>
              <span>Symbol</span>
              <input value={v.symbol} maxLength={8} className="short mono" onChange={(e) => setVar(i, { symbol: e.target.value.trim() })} />
            </label>
            <label className="grow">
              <span>Meaning</span>
              <input value={v.label} maxLength={60} placeholder="e.g. Mass of the weight" onChange={(e) => setVar(i, { label: e.target.value })} />
            </label>
            <label>
              <span>Value</span>
              <DecimalInput value={v.value} onChange={(x) => setVar(i, { value: x })} className="short" />
            </label>
            <label>
              <span>± how precise</span>
              <DecimalInput value={v.uncertainty} onChange={(x) => setVar(i, { uncertainty: x })} className="short" />
            </label>
            <label>
              <span>Unit</span>
              <input value={v.unit} maxLength={12} className="short" onChange={(e) => setVar(i, { unit: e.target.value })} />
            </label>
            <button className="icon" aria-label={`Remove variable ${v.symbol}`} onClick={() => update({ variables: spec.variables.filter((_, k) => k !== i) })}>
              ×
            </button>
            {['symbol', 'label', 'value', 'uncertainty'].map((f) => (
              <FieldError key={f} errors={visibleErrors} field={`variables.${i}.${f}`} />
            ))}
          </div>
        ))}
        <button
          onClick={() =>
            update({ variables: [...spec.variables, { symbol: '', label: '', unit: '', value: 1, uncertainty: 0 }] })
          }
          disabled={spec.variables.length >= 12}
        >
          + Add a variable
        </button>
      </section>

      <section className="panel" data-tour="create-formula">
        <h2 className="step-heading">
          <span className="step-no">4</span>Formula and result
        </h2>
        <div className="form-grid">
          <label className="wide">
            <span>Result name</span>
            <input value={spec.result.name} placeholder="e.g. Spring constant" onChange={(e) => update({ result: { ...spec.result, name: e.target.value } })} />
            <FieldError errors={visibleErrors} field="result.name" />
          </label>
          <label>
            <span>Symbol</span>
            <input value={spec.result.symbol} maxLength={8} className="short mono" onChange={(e) => update({ result: { ...spec.result, symbol: e.target.value } })} />
            <FieldError errors={visibleErrors} field="result.symbol" />
          </label>
          <label>
            <span>Unit</span>
            <input value={spec.result.unit} maxLength={12} className="short" onChange={(e) => update({ result: { ...spec.result, unit: e.target.value } })} />
          </label>
          <label>
            <span>Decimals</span>
            <DecimalInput value={spec.result.digits} onChange={(v) => update({ result: { ...spec.result, digits: Math.min(6, Math.max(0, Math.round(v || 0))) } })} className="short" />
          </label>
        </div>
        <label className="formula-field">
          <span>
            {spec.result.symbol || 'result'} = <em className="hint">(leave empty to use {measure.symbol} directly)</em>
          </span>
          <input
            ref={formulaInput}
            value={spec.formula}
            className="mono"
            placeholder={`e.g. 4*pi^2*m/${measure.symbol}^2`}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => update({ formula: e.target.value })}
          />
        </label>
        <div className="chips" aria-label="Insert into formula">
          {[measure.symbol, ...spec.variables.map((v) => v.symbol).filter(Boolean), 'pi', '^2', 'sqrt(', '*', '/', '(', ')'].map((t) => (
            <button key={t} className="chip" onClick={() => insert(t)}>
              {t}
            </button>
          ))}
        </div>
        <FormulaStatus spec={spec} />
        <p className="hint">Use * to multiply, / to divide, ^ for powers. Functions: sqrt, sin, cos, tan, ln, log, abs, exp.</p>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!spec.expected}
            onChange={(e) => update({ expected: e.target.checked ? { value: NaN, uncertainty: 0, source: '' } : undefined })}
          />
          I know what result to expect (from a textbook or label)
        </label>
        {spec.expected && (
          <div className="form-grid">
            <label>
              <span>Expected value</span>
              <DecimalInput value={spec.expected.value} onChange={(v) => update({ expected: { ...spec.expected!, value: v } })} className="short" />
              <FieldError errors={visibleErrors} field="expected.value" />
            </label>
            <label>
              <span>± tolerance</span>
              <DecimalInput value={spec.expected.uncertainty} onChange={(v) => update({ expected: { ...spec.expected!, uncertainty: v || 0 } })} className="short" />
            </label>
            <label className="wide">
              <span>Where it comes from</span>
              <input value={spec.expected.source} placeholder="e.g. the spring's packaging" onChange={(e) => update({ expected: { ...spec.expected!, source: e.target.value } })} />
            </label>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="step-heading">
          <span className="step-no">5</span>Instructions for whoever does it
        </h2>
        <div className="form-grid">
          <label className="wide">
            <span>What you need (one per line)</span>
            <textarea rows={3} defaultValue={spec.materials.join('\n')} onChange={(e) => update({ materials: lines(e.target.value) })} />
          </label>
          <label className="wide">
            <span>Steps (one per line)</span>
            <textarea rows={4} defaultValue={spec.instructions.join('\n')} onChange={(e) => update({ instructions: lines(e.target.value) })} />
          </label>
        </div>
      </section>

      <div className="create-actions" data-tour="create-save">
        <button className="primary" onClick={saveAndOpen}>
          {existing ? 'Save changes' : 'Save and start measuring'}
        </button>
        {showErrors && Object.keys(errors).length > 0 && (
          <span className="param-error">Fix the {Object.keys(errors).length} highlighted problem(s) first.</span>
        )}
        {existing && (
          <>
            <button onClick={() => downloadText(`${spec.id}.pocketlab.json`, JSON.stringify(spec, null, 2))}>Export file to share</button>
            <button
              className="danger"
              onClick={() => {
                if (!window.confirm(`Delete "${spec.title}"? Its trials will be lost.`)) return;
                customStore.remove(spec.id);
                window.location.hash = href({ page: 'catalog' });
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  );
}
