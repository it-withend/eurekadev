export function AboutPage() {
  return (
    <article className="prose">
      <h1>Why PocketLab exists</h1>
      <p>
        Hands-on experiments are how most people actually learn physics, but lab equipment is expensive and many schools
        have little or none. Meanwhile almost every student carries a phone with an accelerometer, a gyroscope and a
        microphone that are precise enough for real measurements.
      </p>
      <p>
        PocketLab connects the two. It is a free, installable web app: open the link, pick an experiment, follow the
        procedure with household items, and get a measured value with an honest uncertainty, compared against the accepted
        value, plus a printable lab report.
      </p>

      <h2>How a measurement works</h2>
      <ol>
        <li>
          <strong>Capture.</strong> Sensor adapters read the DeviceMotion or Web Audio APIs and resample the data onto a
          uniform time grid, because every phone delivers samples at a different, jittery rate.
        </li>
        <li>
          <strong>Signal processing.</strong> A small DSP library written for this project does zero-phase Butterworth
          filtering, FFT and Welch spectra with sub-bin peak interpolation, zero-crossing period estimation and
          least-squares regression.
        </li>
        <li>
          <strong>Physics model.</strong> Each experiment turns the processed signal into a physical quantity (including
          corrections such as the large-swing pendulum correction and the end correction of an air column) and
          propagates uncertainties.
        </li>
        <li>
          <strong>Explanation.</strong> Every result lists its derivation with the student’s own numbers plugged in, so
          the app teaches the method rather than acting as a black box.
        </li>
      </ol>

      <h2>Open and extensible</h2>
      <p>
        An experiment is a self-contained plugin: metadata plus one pure <code>analyze(recording)</code> function. Adding
        a new one never touches the sensor layer or the interface. Recordings are plain JSON, so any measurement can be
        replayed, shared with a teacher, or used as a test case.
      </p>
      <p>
        Privacy by design: measurements and analysis run on the device. Nothing leaves the phone unless you save or share a file, or ask the optional AI tutor a question (then only that question and the experiment’s numbers are sent).
      </p>
    </article>
  );
}
