import type { ExperimentDefinition } from '@core/types';
import type { CapturePhase, LiveBuffer } from '../hooks/useCapture';
import { LiveChart } from './LiveChart';

const PROMPT: Record<string, { countdown: string; recording: string }> = {
  motion: { countdown: 'Get into position…', recording: 'Recording — let it move' },
  audio: { countdown: 'Get ready to blow…', recording: 'Recording — blow now' },
};

/** Full-screen countdown and recording view: big enough to read from across the room. */
export function CaptureOverlay({
  def,
  state,
  live,
  onCancel,
}: {
  def: ExperimentDefinition;
  state: CapturePhase;
  live: React.MutableRefObject<LiveBuffer>;
  onCancel: () => void;
}) {
  if (state.phase !== 'countdown' && state.phase !== 'recording' && state.phase !== 'preparing') return null;
  const prompt = def.capturePrompts ?? PROMPT[def.sensor];
  const progress = state.phase === 'recording' ? Math.min(1, state.elapsed / def.durationSec) : 0;
  return (
    <div className={`overlay ${state.phase}`} role="dialog" aria-modal="true" aria-label="Measurement in progress">
      <div className="overlay-inner">
        <p className="overlay-title">{def.title}</p>
        {state.phase === 'preparing' && <p className="overlay-big small">Waiting for sensor permission…</p>}
        {state.phase === 'countdown' && (
          <>
            <p className="overlay-prompt">{prompt.countdown}</p>
            <p className="overlay-big" aria-live="assertive">
              {state.remaining}
            </p>
          </>
        )}
        {state.phase === 'recording' && (
          <>
            <p className="overlay-prompt">
              <span className="rec-dot" /> {prompt.recording}
            </p>
            <p className="overlay-big small" aria-live="off">
              {Math.max(0, def.durationSec - state.elapsed).toFixed(0)} s
            </p>
            <div className="overlay-progress">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <LiveChart buffer={live} label={def.previewLabel} />
          </>
        )}
        <button className="overlay-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
