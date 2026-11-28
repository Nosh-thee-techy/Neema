/**
 * Multi-chapter signed conversations for Neema (CareLoop pattern).
 * Clips are How2Sign research ASL — not KSL, not clinical messaging.
 * Tap answers are local; guide replies are scripted on-device (offline).
 */

export type SignAnswer = { id: string; labelEn: string; labelSw: string };

export type GuideReply = {
  textEn: string;
  textSw: string;
  danger: boolean;
  handoff?: 'continue' | 'alert_sms' | 'facility' | 'home' | 'end';
};

export type SignChapter = {
  id: string;
  titleEn: string;
  titleSw: string;
  blurbEn: string;
  blurbSw: string;
  order: string[];
};

const okay: SignAnswer = { id: 'better', labelEn: "I'm okay", labelSw: 'Niko sawa' };
const same: SignAnswer = { id: 'same', labelEn: 'About the same', labelSw: 'Karibu vile vile' };
const pain: SignAnswer = { id: 'worse', labelEn: "I'm in extreme pain", labelSw: 'Nina maumivu makali' };
const help: SignAnswer = { id: 'need help', labelEn: 'I need help', labelSw: 'Nahitaji msaada' };
const thanks: SignAnswer = { id: 'thank you', labelEn: 'Thank you', labelSw: 'Asante' };
const hello: SignAnswer = { id: 'hello', labelEn: 'Hello', labelSw: 'Habari' };
const here: SignAnswer = { id: "i'm here", labelEn: "Hi, I'm here", labelSw: 'Niko hapa' };
const notYet: SignAnswer = { id: 'not_yet', labelEn: 'Not yet', labelSw: 'Bado' };
const goodbye: SignAnswer = { id: 'goodbye', labelEn: 'Goodbye', labelSw: 'Kwaheri' };
const welcome: SignAnswer = { id: "you're welcome", labelEn: "You're welcome", labelSw: 'Karibu' };
const yes: SignAnswer = { id: 'yes', labelEn: 'Yes', labelSw: 'Ndiyo' };
const no: SignAnswer = { id: 'no', labelEn: 'No', labelSw: 'Hapana' };
const tellMore: SignAnswer = { id: 'tell_more', labelEn: 'Tell me more', labelSw: 'Niambie zaidi' };
const ready: SignAnswer = { id: 'ready', labelEn: "I'm ready", labelSw: 'Niko tayari' };
const rest: SignAnswer = { id: 'rest', labelEn: 'I need to rest', labelSw: 'Nahitaji kupumzika' };
const tired: SignAnswer = { id: 'tired', labelEn: "I'm tired", labelSw: 'Nimechoka' };

/**
 * Demo reel. Each clip is a How2Sign sign. The words under the figure are
 * what the mother needs to see. The hands do not have to match those words.
 */
export type SignShowcaseLine = {
  id: string;
  saysEn: string;
  saysSw: string;
  chipEn: string;
  chipSw: string;
  /** Help lines: go now, bleeding, SOS. */
  urgent?: boolean;
};

export const SIGN_SHOWCASE: SignShowcaseLine[] = [
  { id: 'FzQPg4aqNYc_0-1', saysEn: 'Hi', saysSw: 'Habari', chipEn: 'Hi', chipSw: 'Habari' },
  {
    id: '1xKU91ggLeI_2-5',
    saysEn: 'Are you feeling okay?',
    saysSw: 'Unajisikiaje?',
    chipEn: 'Feeling okay?',
    chipSw: 'Unajisikiaje?',
  },
  {
    id: '06jk1stVwMI_2-5',
    saysEn: 'You are okay',
    saysSw: 'Uko salama',
    chipEn: 'You are okay',
    chipSw: 'Uko salama',
  },
  {
    id: 'g1HXoDkax5A_20-3',
    saysEn: 'I need help now',
    saysSw: 'Nahitaji msaada sasa',
    chipEn: 'I need help',
    chipSw: 'Nahitaji msaada',
    urgent: true,
  },
  {
    id: 'cQBrXCcfDyc_22-5',
    saysEn: 'Go to a facility now',
    saysSw: 'Nenda kituo sasa',
    chipEn: 'Go now',
    chipSw: 'Nenda sasa',
    urgent: true,
  },
  {
    id: '5dodEz2r56M_16-8',
    saysEn: 'Help is on the way',
    saysSw: 'Msaada unakuja',
    chipEn: 'Help is coming',
    chipSw: 'Msaada unakuja',
    urgent: true,
  },
];

/** Default order = full night guide (used when no chapter is picked). */
export const SIGN_ORDER: string[] = [
  'FzQPg4aqNYc_0-1',
  '1xKU91ggLeI_2-5',
  '--8pSDeC-fg_7-5',
  '06jk1stVwMI_2-5',
  'CE23zzfUBDw_7-5',
  'FzUdcaxw_vs_10-2',
  'g1HXoDkax5A_20-3',
  'G06Irzcwxiw_19-1',
  'cQBrXCcfDyc_22-5',
  'Cu1rDgWOZ9w_15-8',
  'G06Irzcwxiw_25-1',
  '5dodEz2r56M_16-8',
  '-0N0jbyBW6g_11-5',
  '-F6vN4bOBWs_16-8',
];

/** Conversation chapters researched from How2Sign short lines + Neema care flow. */
export const SIGN_CHAPTERS: SignChapter[] = [
  {
    id: 'welcome',
    titleEn: 'Welcome',
    titleSw: 'Karibu',
    blurbEn: 'Hello and check-in — how are you tonight?',
    blurbSw: 'Salamu na ukaguzi — unajisikiaje usiku?',
    order: [
      'FzQPg4aqNYc_0-1', // Hi!
      '--8pSDeC-fg_0-5', // Hi.
      '1xKU91ggLeI_2-5', // How are you?
      '--8pSDeC-fg_7-5', // How do you feel about yourself?
      '06jk1stVwMI_2-5', // Are you comfortable?
      '5dodEz2r56M_16-8', // Take care.
    ],
  },
  {
    id: 'feeling',
    titleEn: 'Feeling / pain',
    titleSw: 'Hali / maumivu',
    blurbEn: 'Comfort, problems, and when it hurts.',
    blurbSw: 'Faraja, matatizo, na maumivu.',
    order: [
      '1xKU91ggLeI_2-5',
      '06jk1stVwMI_2-5',
      'CE23zzfUBDw_7-5', // Have you seen any problems…
      'FzUdcaxw_vs_10-2', // Why?
      'g1HXoDkax5A_20-3', // It's extremely painful.
      'cQBrXCcfDyc_22-5', // Are you ready?
      'Cu1rDgWOZ9w_15-8', // See you in the next step.
    ],
  },
  {
    id: 'encourage',
    titleEn: 'Encouragement',
    titleSw: 'Tiari',
    blurbEn: 'Getting through a hard stretch — soft, not clinical.',
    blurbSw: 'Kupitia muda mgumu — laini, si kliniki.',
    order: [
      'FzQPg4aqNYc_2-1', // We're back.
      'G06Irzcwxiw_19-1', // To get through all that.
      'G095RWKQ39g_17-1', // …a little bit strenuous.
      'G06Irzcwxiw_21-1', // You enjoy the moment…
      'FzUdcaxw_vs_17-2', // Make it fun.
      'G06Irzcwxiw_25-1', // You're having a good time…
      'FzUdcaxw_vs_16-2', // Before you know it…
      '-0N0jbyBW6g_11-5', // Thank you.
    ],
  },
  {
    id: 'closing',
    titleEn: 'Closing',
    titleSw: 'Kufunga',
    blurbEn: 'Ready, next step, thank you, goodbye.',
    blurbSw: 'Tayari, hatua ijayo, asante, kwaheri.',
    order: [
      'cQBrXCcfDyc_22-5',
      'Cu1rDgWOZ9w_15-8',
      '5dodEz2r56M_16-8',
      '-0N0jbyBW6g_11-5',
      '-F6vN4bOBWs_16-8', // Dr. Felicia here, goodbye.
    ],
  },
  {
    id: 'full_night',
    titleEn: 'Full night guide',
    titleSw: 'Mwongozo wa usiku',
    blurbEn: 'Longer path: welcome → feelings → next steps.',
    blurbSw: 'Njia ndefu: karibu → hisia → hatua.',
    order: [
      'FzQPg4aqNYc_0-1',
      '1xKU91ggLeI_2-5',
      '--8pSDeC-fg_7-5',
      '06jk1stVwMI_2-5',
      'CE23zzfUBDw_7-5',
      'FzUdcaxw_vs_10-2',
      'g1HXoDkax5A_20-3',
      'G06Irzcwxiw_19-1',
      'cQBrXCcfDyc_22-5',
      'Cu1rDgWOZ9w_15-8',
      'G06Irzcwxiw_25-1',
      '5dodEz2r56M_16-8',
      '-0N0jbyBW6g_11-5',
      '-F6vN4bOBWs_16-8',
    ],
  },
];

/** Tap choices for each signed line (clip id). */
export const SIGN_REPLIES: Record<string, SignAnswer[]> = {
  'FzQPg4aqNYc_0-1': [hello, here],
  '--8pSDeC-fg_0-5': [hello, here],
  '--8pSDeC-fg_1-5': [hello, thanks],
  '1xKU91ggLeI_2-5': [okay, same, pain, tired],
  '--8pSDeC-fg_7-5': [okay, help, pain, rest],
  '06jk1stVwMI_2-5': [okay, pain, help, rest],
  'CE23zzfUBDw_7-5': [yes, no, tellMore, help],
  'FzUdcaxw_vs_10-2': [pain, help, tired, okay],
  'g1HXoDkax5A_20-3': [help, pain, okay],
  'cQBrXCcfDyc_22-5': [ready, notYet, help],
  'Cu1rDgWOZ9w_15-8': [thanks, help, ready],
  '5dodEz2r56M_16-8': [thanks, goodbye],
  '-0N0jbyBW6g_11-5': [welcome, thanks],
  '-F6vN4bOBWs_16-8': [goodbye, thanks],
  'FzQPg4aqNYc_2-1': [hello, thanks, tellMore],
  'G06Irzcwxiw_19-1': [tired, okay, help, rest],
  'G095RWKQ39g_17-1': [tired, rest, okay, help],
  'G06Irzcwxiw_21-1': [thanks, okay, tellMore],
  'FzUdcaxw_vs_17-2': [thanks, okay, ready],
  'G06Irzcwxiw_25-1': [thanks, okay, goodbye],
  'FzUdcaxw_vs_16-2': [thanks, okay, ready],
};

export const GUIDE_BY_ANSWER: Record<string, GuideReply> = {
  hello: {
    textEn: 'Hello mama. I am a guide on this phone — not a doctor. We go one signed line at a time.',
    textSw: 'Habari mama. Mimi ni mwongozo kwenye simu — si daktari. Tunakwenda mstari mmoja wa ishara.',
    danger: false,
    handoff: 'continue',
  },
  "i'm here": {
    textEn: 'I am with you. Tap an answer under the signing figure. The camera stays off.',
    textSw: 'Niko nawe. Gusa jibu chini ya mtu anayefanya ishara. Kamera inazimwa.',
    danger: false,
    handoff: 'continue',
  },
  better: {
    textEn: 'Good. Stay near your phone. If anything feels worse, tap “I need help”.',
    textSw: 'Vizuri. Kaa karibu na simu. Ukijisikia vibaya zaidi, gusa “Nahitaji msaada”.',
    danger: false,
    handoff: 'continue',
  },
  same: {
    textEn: 'Understood. Keep watching with Neema. Recheck blood pressure if she asks.',
    textSw: 'Nimeelewa. Endelea na Neema. Pima shinikizo tena akikuomba.',
    danger: false,
    handoff: 'continue',
  },
  worse: {
    textEn: 'Do not wait. Open the message to your CHP and go to a health facility now.',
    textSw: 'Uisubiri. Fungua ujumbe kwa CHP yako na uende kituo cha afya sasa.',
    danger: true,
    handoff: 'facility',
  },
  'need help': {
    textEn: 'Help is one step away. Open the SMS to your CHP, then go to a facility.',
    textSw: 'Msaada uko karibu. Fungua SMS kwa CHP, kisha nenda kituo.',
    danger: true,
    handoff: 'alert_sms',
  },
  not_yet: {
    textEn: 'That is okay. We can continue when you are ready — or ask for help anytime.',
    textSw: 'Sawa. Tutaendelea ukiwa tayari — au unaweza kuomba msaada wakati wowote.',
    danger: false,
    handoff: 'continue',
  },
  'thank you': {
    textEn: 'You are welcome. Neema stays on this phone with you.',
    textSw: 'Karibu. Neema anabaki kwenye simu hii nawe.',
    danger: false,
    handoff: 'continue',
  },
  "you're welcome": {
    textEn: 'Thank you for answering. Take care of yourself.',
    textSw: 'Asante kwa kujibu. Jitunze.',
    danger: false,
    handoff: 'continue',
  },
  goodbye: {
    textEn: 'Take care. You can return to Home or keep following Neema’s steps.',
    textSw: 'Jitunze. Unaweza kurudi Nyumbani au kuendelea na hatua za Neema.',
    danger: false,
    handoff: 'end',
  },
  yes: {
    textEn: 'Thank you for telling me. If it is getting worse, ask for help now.',
    textSw: 'Asante kwa kuniambia. Ikiwa inazidi, omba msaada sasa.',
    danger: false,
    handoff: 'continue',
  },
  no: {
    textEn: 'Alright. We will keep going gently. Tap if something changes.',
    textSw: 'Sawa. Tutaendelea kwa upole. Gusa kitu kikibadilika.',
    danger: false,
    handoff: 'continue',
  },
  tell_more: {
    textEn: 'I will keep signing. You can also open How do you feel? on Home for symptoms.',
    textSw: 'Nitaendelea kufanya ishara. Unaweza pia kufungua Unajisikiaje? nyumbani.',
    danger: false,
    handoff: 'continue',
  },
  ready: {
    textEn: 'Good. Follow Neema’s next step — SMS, blood pressure, or the facility if she asks.',
    textSw: 'Vizuri. Fuata hatua ya Neema — SMS, shinikizo, au kituo akikuomba.',
    danger: false,
    handoff: 'continue',
  },
  rest: {
    textEn: 'Rest if you can. Keep the phone near. Call for help if pain or bleeding gets worse.',
    textSw: 'Pumzika unapoweza. Weka simu karibu. Omba msaada maumivu au damu ikiongezeka.',
    danger: false,
    handoff: 'continue',
  },
  tired: {
    textEn: 'Being tired is hard. Soft rest is okay — but sudden worse pain means seek care.',
    textSw: 'Kuchoka ni ngumu. Kupumzika sawa — lakini maumivu ya ghafla yanahitaji msaada.',
    danger: false,
    handoff: 'continue',
  },
};

export function answersForClip(clipId: string): SignAnswer[] {
  return SIGN_REPLIES[clipId] ?? [okay, help, thanks];
}

export function guideForAnswer(answerId: string): GuideReply {
  return (
    GUIDE_BY_ANSWER[answerId] ?? {
      textEn: 'I heard you. If you feel worse, go to the nearest clinic.',
      textSw: 'Nimekusikia. Ukijisikia vibaya zaidi, nenda kliniki iliyo karibu.',
      danger: false,
      handoff: 'continue',
    }
  );
}

export function chapterById(id: string): SignChapter {
  return SIGN_CHAPTERS.find((c) => c.id === id) ?? SIGN_CHAPTERS[0]!;
}

/** Every clip id that may appear in a signed conversation (LLM allowlist). */
export const ALLOWLISTED_CLIP_IDS: readonly string[] = Array.from(
  new Set([
    ...SIGN_ORDER,
    ...SIGN_CHAPTERS.flatMap((c) => c.order),
    ...Object.keys(SIGN_REPLIES),
  ]),
);

/** Short catalog for server-side gloss→clip planning (id + sentence hint). */
export const CLIP_CATALOG: readonly { id: string; hint: string }[] = [
  { id: 'FzQPg4aqNYc_0-1', hint: 'Hi!' },
  { id: '--8pSDeC-fg_0-5', hint: 'Hi.' },
  { id: '1xKU91ggLeI_2-5', hint: 'How are you?' },
  { id: '--8pSDeC-fg_7-5', hint: 'How do you feel about yourself?' },
  { id: '06jk1stVwMI_2-5', hint: 'Are you comfortable?' },
  { id: 'CE23zzfUBDw_7-5', hint: 'Have you seen any problems with that?' },
  { id: 'FzUdcaxw_vs_10-2', hint: 'Why?' },
  { id: 'g1HXoDkax5A_20-3', hint: "It's extremely painful." },
  { id: 'cQBrXCcfDyc_22-5', hint: 'Are you ready?' },
  { id: 'Cu1rDgWOZ9w_15-8', hint: 'See you in the next step.' },
  { id: '5dodEz2r56M_16-8', hint: 'Take care.' },
  { id: '-0N0jbyBW6g_11-5', hint: 'Thank you.' },
  { id: '-F6vN4bOBWs_16-8', hint: 'Dr. Felicia here, goodbye.' },
  { id: 'FzQPg4aqNYc_2-1', hint: "We're back." },
  { id: 'G06Irzcwxiw_19-1', hint: 'To get through all that.' },
  { id: 'G095RWKQ39g_17-1', hint: 'So after a night of doing that, that can be a little bit strenuous.' },
  { id: 'G06Irzcwxiw_21-1', hint: "You enjoy the moment of what you're doing." },
  { id: 'FzUdcaxw_vs_17-2', hint: 'Make it fun.' },
  { id: 'G06Irzcwxiw_25-1', hint: "You're having a good time along the way." },
  { id: 'FzUdcaxw_vs_16-2', hint: 'Before you know it, your chores are all going to be done.' },
  { id: '--8pSDeC-fg_1-5', hint: 'My name is Dr. Art Bowler.' },
];

export function filterAllowlistedClipIds(ids: unknown): string[] {
  const allow = new Set(ALLOWLISTED_CLIP_IDS);
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (!allow.has(id)) continue;
    if (out.includes(id)) continue;
    out.push(id);
  }
  return out;
}
