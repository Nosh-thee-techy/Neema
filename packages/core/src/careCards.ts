/**
 * WHO-aligned care cards for Neema coaching.
 * Partner corpus until a hospital supplies standing orders.
 * Decision support only — not a diagnosis. Cite card ids in every answer.
 *
 * Sources (public guidelines; thresholds in triage.config.json stay placeholders
 * until clinician review):
 * - WHO recommendations for prevention and treatment of pre-eclampsia and eclampsia
 * - WHO antenatal care / maternal danger-sign framing
 * - Local message catalog already uses the same “rest / recheck / go now” pattern
 */

import type { TriageLevel } from './types.js';
import whoCardsJson from './careCards.who.json';

export type CareUrgency = 'calm' | 'watch' | 'urgent';

export interface CareCard {
  id: string;
  /** Match triage reason codes and free-text asks. */
  tags: string[];
  levels: TriageLevel[];
  urgency: CareUrgency;
  titleEn: string;
  titleSw: string;
  bodyEn: string;
  bodySw: string;
  /** If true, UI should push alert / SMS path. */
  handoff: boolean;
  source: string;
}

/** Standing WHO-style partner pack (versioned JSON). */
export const WHO_CARE_CARDS: CareCard[] = whoCardsJson as CareCard[];

export interface CareGuideContext {
  level: TriageLevel;
  reasons?: string[];
  query: string;
  lang: 'en' | 'sw';
}

export interface CareGuideAnswer {
  cardIds: string[];
  title: string;
  body: string;
  urgency: CareUrgency;
  handoff: boolean;
  disclaimer: string;
  sourceNote: string;
}

function scoreCard(card: CareCard, ctx: CareGuideContext): number {
  let score = 0;
  if (card.levels.includes(ctx.level)) score += 4;
  const q = ctx.query.toLowerCase();
  for (const tag of card.tags) {
    if (q.includes(tag)) score += 3;
  }
  for (const reason of ctx.reasons ?? []) {
    const r = reason.toLowerCase();
    if (card.tags.some((t) => r.includes(t) || t.includes(r))) score += 5;
    if (card.id.includes(r.replace(/_/g, ''))) score += 2;
  }
  // Prefer urgent cards when RED.
  if (ctx.level === 'RED' && card.urgency === 'urgent') score += 6;
  if (ctx.level === 'GREEN' && card.urgency === 'urgent') score -= 3;
  return score;
}

/** Pick top WHO cards for this mother state + question. */
export function retrieveCareCards(ctx: CareGuideContext, limit = 3): CareCard[] {
  const forced: CareCard[] = [];
  if (ctx.level === 'RED') {
    const bleeding = (ctx.reasons ?? []).some((r) => r.includes('bleed'));
    const red = WHO_CARE_CARDS.find((c) => c.id === (bleeding ? 'who_red_bleeding' : 'who_red_go_now'));
    if (red) forced.push(red);
  }
  const ranked = [...WHO_CARE_CARDS]
    .map((c) => ({ c, s: scoreCard(c, ctx) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);

  const out: CareCard[] = [...forced];
  for (const c of ranked) {
    if (out.some((x) => x.id === c.id)) continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  if (out.length === 0) {
    const fallback = WHO_CARE_CARDS.find((c) => c.id === 'who_unknown_check');
    if (fallback) out.push(fallback);
  }
  return out;
}

/** Offline guardrailed answer — no model required. */
export function answerCareQuestion(ctx: CareGuideContext): CareGuideAnswer {
  const cards = retrieveCareCards(ctx);
  const primary = cards[0]!;
  const extra = cards.slice(1);
  const title = ctx.lang === 'sw' ? primary.titleSw : primary.titleEn;
  let body = ctx.lang === 'sw' ? primary.bodySw : primary.bodyEn;
  if (extra.length) {
    const bits = extra.map((c) => (ctx.lang === 'sw' ? c.titleSw : c.titleEn));
    body +=
      ctx.lang === 'sw'
        ? `\n\nPia: ${bits.join(' · ')}.`
        : `\n\nAlso: ${bits.join(' · ')}.`;
  }
  const urgency = cards.some((c) => c.urgency === 'urgent')
    ? 'urgent'
    : cards.some((c) => c.urgency === 'watch')
      ? 'watch'
      : 'calm';
  const handoff = cards.some((c) => c.handoff) || ctx.level === 'RED';
  return {
    cardIds: cards.map((c) => c.id),
    title,
    body,
    urgency,
    handoff,
    disclaimer:
      ctx.lang === 'sw'
        ? 'Ushauri wa maamuzi tu — si utambuzi. Chanzo: kadi za WHO / mwenzi.'
        : 'Decision support only — not a diagnosis. Source: WHO partner cards.',
    sourceNote: primary.source,
  };
}

/** Hard post-filter if a model rephrases — keep RED urgent + handoff. */
export function enforceCareGuardrails(
  answer: CareGuideAnswer,
  ctx: CareGuideContext,
): CareGuideAnswer {
  let next = { ...answer };
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
  if (ctx.level === 'UNKNOWN' && next.urgency === 'calm') {
    next.urgency = 'watch';
  }
  // Strip disease claims unless card already frames them carefully.
  if (!next.cardIds.includes('who_yellow_warning_cluster')) {
    next.body = next.body.replace(/\byou have pre-?eclampsia\b/gi, 'warning signs need clinic review');
  }
  return next;
}
