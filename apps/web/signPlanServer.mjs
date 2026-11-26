/**
 * Shared OpenRouter allowlisted clip planner for Node (production server.mjs).
 * Research ASL only — never invents clip ids.
 */

export const FALLBACK_ORDER = [
  'FzQPg4aqNYc_0-1',
  '1xKU91ggLeI_2-5',
  '--8pSDeC-fg_7-5',
  '06jk1stVwMI_2-5',
  'CE23zzfUBDw_7-5',
  'FzUdcaxw_vs_10-2',
  'g1HXoDkax5A_20-3',
  'cQBrXCcfDyc_22-5',
  'Cu1rDgWOZ9w_15-8',
  '5dodEz2r56M_16-8',
  '-0N0jbyBW6g_11-5',
  '-F6vN4bOBWs_16-8',
];

const CATALOG = [
  ['FzQPg4aqNYc_0-1', 'Hi!'],
  ['--8pSDeC-fg_0-5', 'Hi.'],
  ['1xKU91ggLeI_2-5', 'How are you?'],
  ['--8pSDeC-fg_7-5', 'How do you feel about yourself?'],
  ['06jk1stVwMI_2-5', 'Are you comfortable?'],
  ['CE23zzfUBDw_7-5', 'Have you seen any problems with that?'],
  ['FzUdcaxw_vs_10-2', 'Why?'],
  ['g1HXoDkax5A_20-3', "It's extremely painful."],
  ['cQBrXCcfDyc_22-5', 'Are you ready?'],
  ['Cu1rDgWOZ9w_15-8', 'See you in the next step.'],
  ['5dodEz2r56M_16-8', 'Take care.'],
  ['-0N0jbyBW6g_11-5', 'Thank you.'],
  ['-F6vN4bOBWs_16-8', 'Dr. Felicia here, goodbye.'],
  ['FzQPg4aqNYc_2-1', "We're back."],
  ['G06Irzcwxiw_19-1', 'To get through all that.'],
  ['G095RWKQ39g_17-1', 'So after a night of doing that, that can be a little bit strenuous.'],
  ['G06Irzcwxiw_21-1', "You enjoy the moment of what you're doing."],
  ['FzUdcaxw_vs_17-2', 'Make it fun.'],
  ['G06Irzcwxiw_25-1', "You're having a good time along the way."],
  ['FzUdcaxw_vs_16-2', 'Before you know it, your chores are all going to be done.'],
  ['--8pSDeC-fg_1-5', 'My name is Dr. Art Bowler.'],
];

const ALLOW = new Set(CATALOG.map(([id]) => id));

export function filterAllowlisted(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (!ALLOW.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

export async function planSignOrder({
  apiKey,
  baseUrl,
  model,
  prompt,
  chapterId,
  maxClips,
}) {
  const limit = Math.min(14, Math.max(3, Number(maxClips) || 8));
  if (!apiKey) {
    return { order: FALLBACK_ORDER.slice(0, limit), source: 'fallback', error: 'not_configured' };
  }
  const catalog = CATALOG.map(([id, hint]) => `${id} :: ${hint}`).join('\n');
  const system = [
    'You pick How2Sign research ASL clip ids for a maternal care guide demo.',
    'Return ONLY a JSON object: {"order":["id",...]} using ids from the catalog.',
    'Do not invent ids. Do not claim Kenyan Sign Language. Do not give medical advice.',
    `Pick ${limit} clips max that fit a gentle check-in conversation.`,
  ].join(' ');
  const user = [
    prompt ? `User intent: ${prompt}` : 'User intent: welcoming night check-in',
    chapterId ? `Chapter hint: ${chapterId}` : '',
    'Catalog:',
    catalog,
  ]
    .filter(Boolean)
    .join('\n');

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://neema-web.fly.dev',
      'X-Title': 'Neema',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!upstream.ok) {
    return { order: FALLBACK_ORDER.slice(0, limit), source: 'fallback', error: 'upstream' };
  }
  const data = await upstream.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  const match = String(content).match(/\{[\s\S]*\}/);
  let parsed = null;
  try {
    parsed = JSON.parse(match?.[0] ?? content);
  } catch {
    parsed = null;
  }
  const order = filterAllowlisted(parsed?.order).slice(0, limit);
  if (!order.length) {
    return {
      order: FALLBACK_ORDER.slice(0, limit),
      source: 'fallback',
      label: 'ASL RESEARCH planner fallback — not KSL.',
    };
  }
  return {
    order,
    source: 'openrouter',
    label: 'ASL RESEARCH clip plan — not KSL, not clinical messaging.',
  };
}
