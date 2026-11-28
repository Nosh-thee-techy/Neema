/**
 * Dev-only Vite middleware: POST /api/tts → Msingi Sauti.
 * Keeps MSINGI_API_KEY off the browser bundle.
 */

import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { raiseToWoman, voiceForNeema, womanVoiceFallbacks } from '../../sautiVoice.mjs';

async function readBody(req: import('http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function msingiTtsPlugin(): Plugin {
  return {
    name: 'neema-msingi-tts',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '');
      const apiKey = (env.MSINGI_API_KEY || process.env.MSINGI_API_KEY || '').trim();
      const baseUrl = (env.MSINGI_BASE_URL || process.env.MSINGI_BASE_URL || 'https://api.msingiai.com').replace(
        /\/$/,
        '',
      );
      const voice = voiceForNeema(env.MSINGI_VOICE || process.env.MSINGI_VOICE);

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url?.split('?')[0] !== '/api/tts') {
          next();
          return;
        }
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Voice is not configured.' }));
          return;
        }
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw || '{}') as { text?: string };
          const text = typeof body.text === 'string' ? body.text.trim() : '';
          if (!text) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'text required' }));
            return;
          }
          const headers = {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          };
          let upstream = await fetch(`${baseUrl}/v1/audio/speech`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ text, voice }),
          });
          if (upstream.status === 422) {
            for (const alt of womanVoiceFallbacks(voice)) {
              upstream = await fetch(`${baseUrl}/v1/audio/speech`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ text, voice: alt }),
              });
              if (upstream.ok) break;
            }
          }
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Voice service could not complete that turn.' }));
            return;
          }
          const buf = raiseToWoman(Buffer.from(await upstream.arrayBuffer()));
          res.statusCode = 200;
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/wav');
          res.end(buf);
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Voice service could not be reached.' }));
        }
      });
    },
  };
}
