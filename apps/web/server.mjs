/**
 * Production static + TTS + sign-plan proxies (CareLoop key patterns).
 * Serves dist/; POST /api/tts (Msingi); POST /api/sign-plan (OpenRouter allowlist).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLBACK_ORDER, planSignOrder } from './signPlanServer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 8080);
const API_KEY = (process.env.MSINGI_API_KEY || '').trim();
const BASE_URL = (process.env.MSINGI_BASE_URL || 'https://api.msingiai.com').replace(/\/$/, '');
const VOICE = (process.env.MSINGI_VOICE || 'female').trim();
const LLM_KEY = (
  process.env.OPENROUTER_API_KEY ||
  process.env.CARELOOP_LLM_API_KEY ||
  ''
).trim();
const LLM_BASE = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const LLM_MODEL = (process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini').trim();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleTts(req, res) {
  if (!API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Voice is not configured.' }));
    return;
  }
  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw || '{}');
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'text required' }));
      return;
    }
    let upstream = await fetch(`${BASE_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice: VOICE }),
    });
    if (upstream.status === 422) {
      upstream = await fetch(`${BASE_URL}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
    }
    if (!upstream.ok) {
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Voice service could not complete that turn.' }));
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': upstream.headers.get('content-type') || 'audio/wav',
      'Content-Length': buf.length,
    });
    res.end(buf);
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Voice service could not be reached.' }));
  }
}

async function handleSignPlan(req, res) {
  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw || '{}');
    const result = await planSignOrder({
      apiKey: LLM_KEY,
      baseUrl: LLM_BASE,
      model: LLM_MODEL,
      prompt: typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 400) : '',
      chapterId: typeof body.chapterId === 'string' ? body.chapterId : '',
      maxClips: body.maxClips,
    });
    const status = result.error === 'not_configured' ? 503 : 200;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        order: result.order?.length ? result.order : FALLBACK_ORDER.slice(0, 8),
        source: result.source,
        label: result.label,
        error: result.error === 'not_configured' ? 'Sign planning is not configured.' : undefined,
      }),
    );
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Planner could not be reached.', order: FALLBACK_ORDER.slice(0, 8) }));
  }
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(root, cleaned);
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = safeJoin(DIST, urlPath);
  if (!filePath) {
    res.writeHead(400);
    res.end('Bad path');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const pathOnly = req.url?.split('?')[0];
  if (req.method === 'POST' && pathOnly === '/api/tts') {
    void handleTts(req, res);
    return;
  }
  if (req.method === 'POST' && pathOnly === '/api/sign-plan') {
    void handleSignPlan(req, res);
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(
    `Neema listening on :${PORT} (Msingi ${API_KEY ? 'on' : 'off'}, sign-plan ${LLM_KEY ? 'on' : 'off'})`,
  );
});
