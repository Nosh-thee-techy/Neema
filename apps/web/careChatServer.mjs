/**
 * Guardrailed care chat: retrieve WHO cards, optional OpenRouter rephrase.
 * Model may only phrase; medical content stays inside retrieved card ids.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARD_CANDIDATES = [
  path.resolve(__dirname, 'careCards.who.json'),
  path.resolve(__dirname, '../../packages/core/src/careCards.who.json'),
];
const CARDS_PATH = CARD_CANDIDATES.find((p) => fs.existsSync(p));
if (!CARDS_PATH) throw new Error('WHO care cards JSON missing');
const WHO_CARE_CARDS = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));

function scoreCard(card, ctx) {
  let score = 0;
  if (card.levels.includes(ctx.level)) score += 4;
  const q = ctx.query.toLowerCase();
  for (const tag of card.tags) {
    if (q.includes(tag)) score += 3;
  }
  for (const reason of ctx.reasons ?? []) {
    const r = String(reason).toLowerCase();
    if (card.tags.some((t) => r.includes(t) || t.includes(r))) score += 5;
  }
  if (ctx.level === 'RED' && card.urgency === 'urgent') score += 6;
  if (ctx.level === 'GREEN' && card.urgency === 'urgent') score -= 3;
  return score;
}

function retrieveCareCards(ctx, limit = 3) {
  const forced = [];
  if (ctx.level === 'RED') {
    const bleeding = (ctx.reasons ?? []).some((r) => String(r).includes('bleed'));
    const red = WHO_CARE_CARDS.find((c) => c.id === (bleeding ? 'who_red_bleeding' : 'who_red_go_now'));
    if (red) forced.push(red);
  }
  const ranked = [...WHO_CARE_CARDS]
    .map((c) => ({ c, s: scoreCard(c, ctx) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
  const out = [...forced];
  for (const c of ranked) {
    if (out.some((x) => x.id === c.id)) continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  if (!out.length) {
    const fallback = WHO_CARE_CARDS.find((c) => c.id === 'who_unknown_check');
    if (fallback) out.push(fallback);
  }
  return out;
}

function answerCareQuestion(ctx) {
  const cards = retrieveCareCards(ctx);
  const primary = cards[0];
  const extra = cards.slice(1);
  const title = ctx.lang === 'sw' ? primary.titleSw : primary.titleEn;
  let body = ctx.lang === 'sw' ? primary.bodySw : primary.bodyEn;
  if (extra.length) {
    const bits = extra.map((c) => (ctx.lang === 'sw' ? c.titleSw : c.titleEn));
    body += ctx.lang === 'sw' ? `\n\nPia: ${bits.join(' · ')}.` : `\n\nAlso: ${bits.join(' · ')}.`;
  }
  const urgency = cards.some((c) => c.urgency === 'urgent')
    ? 'urgent'
    : cards.some((c) => c.urgency === 'watch')
      ? 'watch'
      : 'calm';
  return {
    cardIds: cards.map((c) => c.id),
    title,
    body,
    urgency,
    handoff: cards.some((c) => c.handoff) || ctx.level === 'RED',
    disclaimer:
      ctx.lang === 'sw'
        ? 'Ushauri wa maamuzi tu — si utambuzi. Chanzo: kadi za WHO.'
        : 'Decision support only — not a diagnosis. Source: WHO partner cards.',
    sourceNote: primary.source,
    cards,
  };
}

function enforceCareGuardrails(answer, ctx) {
  const next = { ...answer };
  if (ctx.level === 'RED') {
    next.urgency = 'urgent';
    next.handoff = true;
    if (!next.cardIds.includes('who_red_go_now') && !next.cardIds.includes('who_red_bleeding')) {
      next.cardIds = ['who_red_go_now', ...next.cardIds];
    }
    const go = ctx.lang === 'sw' ? 'Nenda kituo sasa.' : 'Go to a facility now.';
    if (!next.body.toLowerCase().includes('facility') && !next.body.toLowerCase().includes('kituo')) {
      next.body = `${go} ${next.body}`;
    }
  }
  if (ctx.level === 'UNKNOWN' && next.urgency === 'calm') next.urgency = 'watch';
  if (!next.cardIds.includes('who_yellow_warning_cluster')) {
    next.body = next.body.replace(/\byou have pre-?eclampsia\b/gi, 'warning signs need clinic review');
  }
  return next;
}

function localAnswer(body) {
  const ctx = {
    level:
      body.level === 'GREEN' || body.level === 'YELLOW' || body.level === 'RED' || body.level === 'UNKNOWN'
        ? body.level
        : 'UNKNOWN',
    reasons: Array.isArray(body.reasons) ? body.reasons.map(String) : [],
    query: typeof body.query === 'string' ? body.query.trim().slice(0, 500) : '',
    lang: body.lang === 'sw' ? 'sw' : 'en',
  };
  return enforceCareGuardrails(answerCareQuestion(ctx), ctx);
}

/** @param {{ apiKey: string, baseUrl: string, model: string, body: object }} opts */
export async function planCareChat(opts) {
  const local = localAnswer(opts.body || {});
  if (!opts.apiKey) {
    return { ...local, source: 'cards', error: 'not_configured' };
  }

  const cardBlock = (local.cards || [])
    .map(
      (c) =>
        `- ${c.id}: ${opts.body?.lang === 'sw' ? c.titleSw : c.titleEn}\n  ${
          opts.body?.lang === 'sw' ? c.bodySw : c.bodyEn
        }`,
    )
    .join('\n');

  const system = `You are Neema, a maternal guardian coach. You ONLY rephrase the approved care cards below.
Rules:
- Decision support, never diagnose (do not say she HAS preeclampsia).
- Use only facts from the cards. Soften wording for voice if needed.
- If level is RED, you MUST tell her to go to a facility now and contact CHP.
- UNKNOWN is never "you are fine".
- Reply as compact JSON: {"title":"...","body":"...","cardIds":["..."]}
- cardIds must be a subset of the provided card ids.
Language: ${opts.body?.lang === 'sw' ? 'Swahili' : 'English'}.`;

  const user = `Triage level: ${opts.body?.level || 'UNKNOWN'}
Reasons: ${(opts.body?.reasons || []).join(', ') || 'none'}
Mother asked: ${opts.body?.query || '(how are we / what should I do)'}

Approved cards:
${cardBlock}`;

  try {
    const res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://neema-web.fly.dev',
        'X-Title': 'Neema care chat',
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return { ...local, source: 'cards_fallback' };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ...local, source: 'cards_fallback' };
    const parsed = JSON.parse(match[0]);
    const allowed = new Set((local.cards || []).map((c) => c.id));
    const cardIds = Array.isArray(parsed.cardIds)
      ? parsed.cardIds.map(String).filter((id) => allowed.has(id))
      : local.cardIds;
    const ctx = {
      level: opts.body?.level || 'UNKNOWN',
      reasons: opts.body?.reasons || [],
      query: opts.body?.query || '',
      lang: opts.body?.lang === 'sw' ? 'sw' : 'en',
    };
    const merged = enforceCareGuardrails(
      {
        cardIds: cardIds.length ? cardIds : local.cardIds,
        title: typeof parsed.title === 'string' ? parsed.title.slice(0, 120) : local.title,
        body: typeof parsed.body === 'string' ? parsed.body.slice(0, 900) : local.body,
        urgency: local.urgency,
        handoff: local.handoff,
        disclaimer: local.disclaimer,
        sourceNote: local.sourceNote,
        cards: local.cards,
      },
      ctx,
    );
    return { ...merged, source: 'llm+cards' };
  } catch {
    return { ...local, source: 'cards_fallback' };
  }
}
