/**
 * Dev-only Vite middleware: POST /api/sign-plan → OpenRouter clip allowlist picker.
 * Never invents motion — only returns existing How2Sign clip ids.
 */

import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { FALLBACK_ORDER, planSignOrder } from '../../signPlanServer.mjs';

async function readBody(req: import('http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function json(res: import('http').ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function signPlanPlugin(): Plugin {
  return {
    name: 'neema-sign-plan',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '');
      const apiKey = (
        env.OPENROUTER_API_KEY ||
        env.CARELOOP_LLM_API_KEY ||
        process.env.OPENROUTER_API_KEY ||
        process.env.CARELOOP_LLM_API_KEY ||
        ''
      ).trim();
      const baseUrl = (
        env.OPENROUTER_BASE_URL ||
        process.env.OPENROUTER_BASE_URL ||
        'https://openrouter.ai/api/v1'
      ).replace(/\/$/, '');
      const model = (
        env.OPENROUTER_MODEL ||
        process.env.OPENROUTER_MODEL ||
        'openai/gpt-4o-mini'
      ).trim();

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url?.split('?')[0] !== '/api/sign-plan') {
          next();
          return;
        }
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw || '{}') as {
            prompt?: string;
            chapterId?: string;
            maxClips?: number;
          };
          const result = await planSignOrder({
            apiKey,
            baseUrl,
            model,
            prompt: typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 400) : '',
            chapterId: typeof body.chapterId === 'string' ? body.chapterId : '',
            maxClips: body.maxClips,
          });
          const status = result.error === 'not_configured' ? 503 : 200;
          json(res, status, {
            order: result.order?.length ? result.order : FALLBACK_ORDER.slice(0, 8),
            source: result.source,
            label: result.label,
            error: result.error === 'not_configured' ? 'Sign planning is not configured.' : undefined,
          });
        } catch {
          json(res, 502, {
            error: 'Planner could not be reached.',
            order: FALLBACK_ORDER.slice(0, 8),
          });
        }
      });
    },
  };
}
