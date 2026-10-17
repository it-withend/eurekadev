import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// `npm run dev:phone` serves over HTTPS on the LAN: phones only expose
// motion sensors and the microphone to secure origins.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@core': r('./src/core'),
      '@dsp': r('./src/dsp'),
      '@experiments': r('./src/experiments'),
      '@ui': r('./src/ui'),
      '@testing': r('./src/testing'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
