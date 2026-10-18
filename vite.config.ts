import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Serves POST /api/chat during `npm run dev`, with the same handler the
 * Vercel function uses. Put GROQ_API_KEY in .env.local (never committed).
 */
function tutorApi(env: Record<string, string>): Plugin {
  return {
    name: 'pocketlab-tutor-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let raw = '';
        for await (const chunk of req) raw += chunk;
        let body: unknown = null;
        try {
          body = JSON.parse(raw);
        } catch {
          // handled as invalid
        }
        const { handleChat } = await server.ssrLoadModule('/src/server/tutor.ts');
        const result = await handleChat(body, { apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, client: req.socket.remoteAddress ?? 'dev' });
        res.statusCode = result.status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

// `npm run dev:phone` serves over HTTPS on the LAN: phones only expose
// motion sensors and the microphone to secure origins.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tutorApi(env), ...(mode === 'phone' ? [basicSsl()] : [])],
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
  };
});
