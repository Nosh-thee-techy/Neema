/**
 * Dev server: GET /api/readings pulls the latest sensor document.
 */

import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { fetchLatestReading } from '../../readingsServer.mjs';

export function readingsPlugin(): Plugin {
  return {
    name: 'neema-readings',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '');
      for (const [key, value] of Object.entries(env)) {
        if (!process.env[key]) process.env[key] = value;
      }
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (req.method !== 'GET' || path !== '/api/readings') {
          next();
          return;
        }
        try {
          const query = Object.fromEntries(new URL(req.url || '', 'http://localhost').searchParams);
          const result = await fetchLatestReading(typeof query.device_id === 'string' ? query.device_id : '');
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'The readings database could not be reached.' }));
        }
      });
    },
  };
}
