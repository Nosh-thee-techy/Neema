/**
 * Dev server: POST /api/notify places the SOS call and SMS.
 * GET/POST /api/calls/voice is what Africa's Talking asks when the call connects.
 */

import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { handleVoice, noticesConfigured, placeNotices, phoneFromCallback } from '../../notifyServer.mjs';

async function readBody(req: import('http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function notifyPlugin(): Plugin {
  return {
    name: 'neema-notify',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '');
      for (const [key, value] of Object.entries(env)) {
        if (!process.env[key]) process.env[key] = value;
      }
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path === '/api/calls/voice' && (req.method === 'GET' || req.method === 'POST')) {
          const raw = req.method === 'POST' ? await readBody(req) : '';
          const query = Object.fromEntries(new URL(req.url || '', 'http://localhost').searchParams);
          const phone = phoneFromCallback(query, raw);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/xml');
          res.end(handleVoice(phone));
          return;
        }
        if (req.method !== 'POST' || path !== '/api/notify') {
          next();
          return;
        }
        try {
          const body = JSON.parse((await readBody(req)) || '{}') as { calls?: unknown; sms?: unknown };
          if (!noticesConfigured()) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ configured: false, callsPlaced: 0, smsSent: 0 }));
            return;
          }
          const result = await placeNotices(body);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ configured: true, callsPlaced: 0, smsSent: 0 }));
        }
      });
    },
  };
}
