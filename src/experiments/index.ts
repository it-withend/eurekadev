import { createRegistry } from '@core/registry';
import { centripetal } from './centripetal';
import { pendulum } from './pendulum';
import { resonance } from './resonance';

/** The only place that knows which experiments exist. Add a plugin here. */
export const registry = createRegistry([pendulum, resonance, centripetal]);
