import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev-only middleware: executes the Vercel serverless function handler for
 * POST /api/send-certificates locally, so Vite dev server doesn't return 404.
 * Requires RESEND_API_KEY and SENDER_EMAIL set in .env.local.
 */
function localApiPlugin(): Plugin {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/send-certificates', (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
          }

          try {
            const mod = await server.ssrLoadModule('/api/send-certificates.ts');
            let statusCode = 200;
            const shimRes = {
              status(code: number) { statusCode = code; return shimRes; },
              json(data: unknown) {
                res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
              },
            };
            const shimReq = { method: req.method, headers: req.headers, body: parsed };
            await mod.default(shimReq, shimRes);
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localApiPlugin()],
})
