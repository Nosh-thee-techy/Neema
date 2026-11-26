/**
 * Dev middleware: POST /api/care-chat → WHO cards + optional OpenRouter rephrase.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';

type Incoming = {
  method?: string;
  url?: string;
  on: (event: string, cb: (chunk?: Buffer) => void) => void;
};

function readBody(req: Incoming): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => {
      if (c) chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function careChatPlugin(): Plugin {
  return {
    name: 'neema-care-chat',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '');
      const apiKey = (env.OPENROUTER_API_KEY || env.CARELOOP_LLM_API_KEY || process.env.OPENROUTER_API_KEY || '').trim();
      const baseUrl = (env.OPENROUTER_BASE_URL || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(
        /\/$/,
        '',
      );
      const model = (env.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini').trim();

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url?.split('?')[0] !== '/api/care-chat') {
          next();
          return;
        }
        try {
          const raw = await readBody(req as Incoming);
          const body = JSON.parse(raw || '{}');
          const here = path.dirname(fileURLToPath(import.meta.url));
          const modPath = path.resolve(here, '../../careChatServer.mjs');
          if (!fs.existsSync(modPath)) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'careChatServer missing' }));
            return;
          }
          const { planCareChat } = await import(/* @vite-ignore */ modPath);
          const result = await planCareChat({ apiKey, baseUrl, model, body });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'care chat failed' }));
        }
      });
    },
  };
}
