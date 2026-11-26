/**
 * Client for guardian care chat — offline WHO cards, optional /api/care-chat rephrase.
 */

import {
  answerCareQuestion,
  enforceCareGuardrails,
  type CareGuideAnswer,
  type TriageLevel,
} from '@neema/core';

export type CareChatRequest = {
  query: string;
  lang: 'en' | 'sw';
  level: TriageLevel;
  reasons?: string[];
};

export type CareChatResponse = CareGuideAnswer & {
  source?: string;
};

/** Ask Neema: always works offline; LLM rephrase when configured. */
export async function askCareGuide(req: CareChatRequest): Promise<CareChatResponse> {
  const ctx = {
    level: req.level,
    reasons: req.reasons,
    query: req.query,
    lang: req.lang,
  };
  const local = enforceCareGuardrails(answerCareQuestion(ctx), ctx);

  try {
    const res = await fetch('/api/care-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) return { ...local, source: 'cards' };
    const data = (await res.json()) as CareChatResponse;
    if (!data?.body || !Array.isArray(data.cardIds)) return { ...local, source: 'cards' };
    return enforceCareGuardrails(
      {
        cardIds: data.cardIds,
        title: data.title || local.title,
        body: data.body,
        urgency: data.urgency || local.urgency,
        handoff: Boolean(data.handoff) || local.handoff,
        disclaimer: data.disclaimer || local.disclaimer,
        sourceNote: data.sourceNote || local.sourceNote,
      },
      ctx,
    );
  } catch {
    return { ...local, source: 'cards' };
  }
}
