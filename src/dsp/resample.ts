/**
 * Phone motion events arrive with jittery timing (and different rates per
 * device). Every analysis assumes a uniform sample rate, so we linearly
 * interpolate onto a fixed grid first.
 *
 * @param times  strictly increasing timestamps in seconds
 * @param values one array per channel, same length as `times`
 */
export function resampleUniform(times: ArrayLike<number>, values: ArrayLike<number>[], rate: number): Float64Array[] {
  const n = times.length;
  if (n < 2) return values.map(() => new Float64Array(0));
  const t0 = times[0];
  const count = Math.floor((times[n - 1] - t0) * rate) + 1;
  const out = values.map(() => new Float64Array(count));
  let j = 0;
  for (let i = 0; i < count; i++) {
    const t = t0 + i / rate;
    while (j < n - 2 && times[j + 1] < t) j++;
    const span = times[j + 1] - times[j];
    const frac = span > 0 ? Math.min(1, Math.max(0, (t - times[j]) / span)) : 0;
    for (let c = 0; c < values.length; c++) {
      const v = values[c];
      out[c][i] = v[j] + (v[j + 1] - v[j]) * frac;
    }
  }
  return out;
}

/** Median sampling rate implied by timestamps (seconds). Robust to dropped events. */
export function estimateRate(times: ArrayLike<number>): number {
  const d: number[] = [];
  for (let i = 1; i < times.length; i++) d.push(times[i] - times[i - 1]);
  d.sort((a, b) => a - b);
  const mid = d[d.length >> 1];
  return mid > 0 ? 1 / mid : 0;
}
