/**
 * Client helper for POST /api/sign-plan (OpenRouter allowlisted clip picker).
 */

export type SignPlanResult = {
  order: string[];
  source?: string;
  label?: string;
  error?: string;
};

export async function fetchSignPlan(input: {
  prompt?: string;
  chapterId?: string;
  maxClips?: number;
}): Promise<SignPlanResult> {
  const res = await fetch('/api/sign-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as SignPlanResult;
  if (!res.ok) {
    return {
      order: Array.isArray(body.order) ? body.order : [],
      error: body.error || 'Sign planning failed.',
      source: 'error',
    };
  }
  return {
    order: Array.isArray(body.order) ? body.order : [],
    source: body.source,
    label: body.label,
  };
}
