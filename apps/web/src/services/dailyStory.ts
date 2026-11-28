/**
 * Slides for "today", built from the guides already in the app and from what she saved.
 * No new medical advice. The personal baseline is the model we actually have:
 * it learns her usual heart rate and can only ask for a closer look, never call her fine.
 */

import { RECOVERY_TODAY_SIGNS, WEEKLY_INSIGHTS, insightForWeek, recoveryStageFor, type WeeklyInsight } from '@neema/core';
import type { CarePath, JourneyPhase } from './carePath';

export type StoryArt = 'neema' | 'baby' | 'band' | 'mood' | 'portrait' | 'newborn';
export type StoryTone = 'calm' | 'watch' | 'learn' | 'talk';
export type StoryIcon =
  | 'heart'
  | 'temp'
  | 'feel'
  | 'bell'
  | 'moon'
  | 'alert'
  | 'band'
  | 'spark'
  | 'chat'
  | 'mic'
  | 'user'
  | 'check'
  | 'pressure';

export interface StoryChip {
  id: string;
  label: string;
  icon: StoryIcon;
  /** Spoken back when she taps the chip. Taken from copy already in the guide. */
  note: string;
}

export interface StorySlide {
  id: string;
  kicker: string;
  title: string;
  /** Full text handed to the chat. The screen leads with chips, the watch line and one action. */
  body: string;
  /** Short line under the title, usually the week or the day. */
  lead: string;
  next: string;
  art: StoryArt;
  tone: StoryTone;
  chips: StoryChip[];
  /** One thing to do, already stated in the source guide. */
  action: string;
  /** When to reach a person. Omitted when this slide has no watch line. */
  watch?: string;
  week?: number;
  ageDays?: number;
  /** Pregnancy and recovery cards are drafts until a clinician signs them. */
  draft?: boolean;
}

export interface StoryInput {
  lang: 'en' | 'sw';
  phase: JourneyPhase;
  path: CarePath;
  name: string;
  weeks: number | null;
  days: number;
  daysSinceBirth: number | null;
  medications: string[];
  conditions: string[];
  /** 0–1 from the heart-rate baseline. Null when it could not be read. */
  baselineProgress: number | null;
}

function tx(lang: 'en' | 'sw', en: string, sw: string): string {
  return lang === 'sw' ? sw : en;
}

function feel(card: WeeklyInsight, lang: 'en' | 'sw'): string {
  return lang === 'sw' ? card.feelSw : card.feelEn;
}

function baby(card: WeeklyInsight, lang: 'en' | 'sw'): string {
  const size = lang === 'sw' ? card.sizeSw : card.sizeEn;
  const line = lang === 'sw' ? card.babySw : card.babyEn;
  return `${size}. ${line}`;
}

function cap(s: string): string {
  const t = s.trim().replace(/\.$/, '');
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Split a plain guide sentence into short tappable labels. No new facts. */
function labelsFrom(text: string, max = 4): string[] {
  const cut = text
    .replace(/\s+are common\.?$/i, '')
    .replace(/\s+ni kawaida\.?$/i, '')
    .replace(/\.$/, '');
  const parts = cut
    .split(/,|\band\b|\bna\b/i)
    .map(cap)
    .filter((p) => p.length > 2 && p.length < 72);
  return parts.slice(0, max);
}

function iconFor(label: string): StoryIcon {
  const s = label.toLowerCase();
  if (/bleed|damu|spot|tone|urine|kojoa|pad/.test(s)) return 'alert';
  if (/heart|moyo|mapigo|breast|titi|matiti/.test(s)) return 'heart';
  if (/temp|joto|fever|homa|warm|moto/.test(s)) return 'temp';
  if (/sleep|usingizi|tired|uchovu|rest|pumzika/.test(s)) return 'moon';
  if (/pressure|shinikizo|head|kichwa/.test(s)) return 'pressure';
  if (/voice|sauti|speak|sema|kiswahili/.test(s)) return 'mic';
  if (/band|bendi/.test(s)) return 'band';
  if (/people|chp|person|mtu|familia/.test(s)) return 'user';
  if (/mood|hisia|feel|hisi|tear|kulia|anxious|wasiwasi/.test(s)) return 'feel';
  return 'spark';
}

function chips(prefix: string, labels: string[], noteFor: (label: string) => string): StoryChip[] {
  return labels.map((label, i) => ({
    id: `${prefix}-${i}`,
    label,
    icon: iconFor(label),
    note: noteFor(label),
  }));
}

const DANGER = /bleed|damu|faint|zirai|fit|degedege|fever|homa|harm|dhuru|cannot keep|kushindwa kubakiza|spotting|matone|chest|kifua|vision|ukungu|racing|mbio/i;

/** One deck. The last slide always offers Neema, carrying these words into the chat. */
export function buildDailyStory(input: StoryInput): StorySlide[] {
  const { lang, phase, path, name } = input;
  const slides: StorySlide[] = [];

  if (phase === 'after' && input.daysSinceBirth !== null) {
    const stage = recoveryStageFor(input.daysSinceBirth);
    const early = input.daysSinceBirth < 3;
    const todayWatch = RECOVERY_TODAY_SIGNS[0]![lang];
    const intro = early
      ? tx(
          lang,
          'The first three days after birth are often the hardest on the body. Bleeding, after-pains and broken sleep can all be part of it.',
          'Siku tatu za kwanza baada ya kujifungua mara nyingi huwa ngumu kwa mwili. Kutokwa na damu, maumivu na usingizi wa vipande vinaweza kuwa vya kawaida.',
        )
      : stage.intro[lang];
    const todayAction = tx(
      lang,
      'A feeling that is getting worse is worth a person, not a wait.',
      'Hisia inayozidi inahitaji mtu, si kusubiri.',
    );
    const normals = stage.normal.slice(0, 4).map((n) => n[lang]);
    slides.push({
      id: 'today',
      kicker: tx(lang, 'Today', 'Leo'),
      title: tx(lang, `Day ${input.daysSinceBirth} of healing, ${name}`, `Siku ${input.daysSinceBirth} ya kupona, ${name}`),
      lead: stage.range[lang],
      body: `${intro} ${todayAction}`,
      art: 'newborn',
      tone: 'calm',
      ageDays: input.daysSinceBirth,
      draft: stage.status !== 'reviewed',
      chips: chips('today', normals.length ? normals : labelsFrom(intro), (label) =>
        DANGER.test(label) ? todayWatch : label,
      ),
      watch: todayWatch,
      action: todayAction,
      next: tx(lang, 'Okay', 'Sawa'),
    });
    const healLine = stage.normal[0]?.[lang] ?? stage.intro[lang];
    slides.push({
      id: 'heal',
      kicker: tx(lang, 'Healing', 'Kupona'),
      title: stage.title[lang],
      lead: stage.range[lang],
      body: healLine,
      art: 'neema',
      tone: 'calm',
      ageDays: input.daysSinceBirth,
      draft: stage.status !== 'reviewed',
      chips: chips('heal', normals, (label) => (DANGER.test(label) ? todayWatch : label)),
      watch: todayWatch,
      action: todayAction,
      next: tx(lang, 'Next', 'Endelea'),
    });
    const moodBody = tx(
      lang,
      'Neema notices low mood from what you report: several hard days, very little sleep, or little interest in things you used to enjoy. She does not give it a name. If it lasts, or if you think of harm, she asks you to reach a person today.',
      'Neema huona huzuni kutokana na unachoripoti: siku ngumu kadhaa, usingizi mdogo sana, au kutopendezwa na mambo uliyoyapenda. Hatoi jina. Ikizidi, au ukifikiria kujidhuru, anakuomba ufikie mtu leo.',
    );
    const moodWatch = tx(
      lang,
      'Thoughts of harm: reach a person today. Her message says only that you need someone to talk to.',
      'Mawazo ya kujidhuru: fikia mtu leo. Ujumbe wake unasema tu kwamba unahitaji mtu wa kuongea naye.',
    );
    const moodAction = tx(
      lang,
      'If it lasts, reach a person today. This is support, not a diagnosis.',
      'Ikizidi, fikia mtu leo. Huu ni msaada, si utambuzi.',
    );
    slides.push({
      id: 'mood',
      kicker: tx(lang, 'How you feel', 'Jinsi unavyohisi'),
      title: tx(lang, 'A hard day is not a failing', 'Siku ngumu si kushindwa'),
      lead: tx(lang, 'She does not give a feeling a name.', 'Hatoi jina kwa hisia.'),
      body: moodBody,
      art: 'mood',
      tone: 'watch',
      chips: chips(
        'mood',
        [
          tx(lang, 'Several hard days', 'Siku ngumu kadhaa'),
          tx(lang, 'Very little sleep', 'Usingizi mdogo sana'),
          tx(lang, 'Little interest', 'Kutopendezwa'),
          tx(lang, 'Thoughts of harm', 'Mawazo ya kujidhuru'),
        ],
        (label) => (DANGER.test(label) || /harm|dhuru|interest|pendez/.test(label) && /harm|dhuru/.test(label) ? moodWatch : moodBody),
      ),
      watch: moodWatch,
      action: moodAction,
      next: tx(lang, 'Next', 'Endelea'),
    });
    // Fix the mood chip note: only the harm chip should use moodWatch. The regex above is messy.
    const moodSlide = slides[slides.length - 1]!;
    moodSlide.chips = moodSlide.chips.map((c) => ({
      ...c,
      note: /harm|dhuru/i.test(c.label) ? moodWatch : tx(lang, 'She notices this from what you report. She does not give it a name.', 'Anaona hili kutokana na unachoripoti. Hatoi jina.'),
    }));
  } else {
    const week = input.weeks ?? 4;
    const card: WeeklyInsight = insightForWeek(week) ?? WEEKLY_INSIGHTS[0]!;
    const where =
      phase === 'before'
        ? tx(lang, `Week ${week}, day ${input.days}. You have just been told, and that is enough for today.`, `Wiki ${week}, siku ${input.days}. Umeambiwa tu, na hiyo inatosha leo.`)
        : tx(lang, `Week ${week}, day ${input.days} of your pregnancy.`, `Wiki ${week}, siku ${input.days} ya mimba yako.`);
    const feelText = feel(card, lang);
    const watchText = lang === 'sw' ? card.watchSw : card.watchEn;
    const actionText = lang === 'sw' ? card.doSw : card.doEn;
    const commonNote = tx(
      lang,
      'The guide lists this as something that can be common this week. It is not a diagnosis.',
      'Mwongozo unataja hii kama kitu ambacho kinaweza kuwa kawaida wiki hii. Si utambuzi.',
    );
    slides.push({
      id: 'today',
      kicker: tx(lang, 'Today', 'Leo'),
      title: tx(lang, `How you might feel, ${name}`, `Unavyoweza kuhisi, ${name}`),
      lead: where,
      body: `${where} ${feelText}`,
      art: 'neema',
      tone: 'calm',
      week,
      draft: card.status !== 'reviewed',
      chips: chips('feel', labelsFrom(feelText, 5), (label) => (DANGER.test(label) ? watchText : commonNote)),
      watch: watchText,
      action: actionText,
      next: tx(lang, 'Okay', 'Sawa'),
    });
    const babyText = baby(card, lang);
    const babyBits = (lang === 'sw' ? card.babySw : card.babyEn)
      .split('. ')
      .map((s) => s.replace(/\.$/, '').trim())
      .filter((s) => s.length > 2)
      .slice(0, 2);
    slides.push({
      id: 'baby',
      kicker: tx(lang, 'Your baby', 'Mtoto wako'),
      title: tx(lang, 'What is growing', 'Kinachokua'),
      lead: lang === 'sw' ? card.sizeSw : card.sizeEn,
      body: babyText,
      art: 'baby',
      tone: 'learn',
      week,
      draft: card.status !== 'reviewed',
      chips: chips('baby', babyBits, (label) => label),
      watch: watchText,
      action: actionText,
      next: tx(lang, 'Next', 'Endelea'),
    });
  }

  if (path === 'known') {
    const meds = input.medications.length ? input.medications.join(', ') : '';
    const cond = input.conditions.length ? input.conditions.join(', ') : '';
    const knownBody = tx(
      lang,
      `${meds ? `You take ${meds}. ` : ''}${cond ? `You also noted ${cond}. ` : ''}A new feeling, such as dizziness, can come from the medicine and it can come from the pregnancy. Neema will not skip it, and will not decide it is only the medicine. Tell your CHP both: the feeling, and what you take.`,
      `${meds ? `Unatumia ${meds}. ` : ''}${cond ? `Pia ulitaja ${cond}. ` : ''}Hisia mpya, kama kizunguzungu, inaweza kutoka kwa dawa na inaweza kutoka kwa mimba. Neema haitaipuuza, na haitaamua ni dawa pekee. Mwambie CHP wako vyote viwili: hisia, na unachotumia.`,
    );
    const knownLabels = [
      ...input.medications.slice(0, 2),
      ...input.conditions.slice(0, 2),
      tx(lang, 'A new feeling', 'Hisia mpya'),
    ].slice(0, 4);
    slides.push({
      id: 'known',
      kicker: tx(lang, 'Care you already have', 'Huduma uliyonayo'),
      title: meds ? tx(lang, 'Medicine for today', 'Dawa ya leo') : tx(lang, 'What you already told us', 'Ulichotuambia tayari'),
      lead: tx(lang, 'She will not decide a new feeling is only the medicine.', 'Haitaamua hisia mpya ni dawa pekee.'),
      body: knownBody,
      art: 'portrait',
      tone: 'watch',
      chips: chips('known', knownLabels, () => knownBody),
      watch: tx(
        lang,
        'Tell your CHP both: the feeling, and what you take.',
        'Mwambie CHP wako vyote viwili: hisia, na unachotumia.',
      ),
      action: tx(
        lang,
        'Tell your CHP both: the feeling, and what you take.',
        'Mwambie CHP wako vyote viwili: hisia, na unachotumia.',
      ),
      next: tx(lang, 'Next', 'Endelea'),
    });
  } else if (path === 'watch') {
    const watchBody = tx(
      lang,
      'Something in your readings or how you feel needs a look. That does not rename your pregnancy. Neema watches for patterns, such as a headache together with a high blood pressure, and asks you to reach your CHP. She does not tell you the name of an illness.',
      'Kuna kitu kwenye vipimo au jinsi unavyohisi kinahitaji kuangaliwa. Hilo halibadilishi jina la mimba yako. Neema huangalia mifumo, kama kichwa kuuma pamoja na shinikizo la juu, na kukuomba ufikie CHP wako. Hakuambii jina la ugonjwa.',
    );
    slides.push({
      id: 'watch',
      kicker: tx(lang, 'Something to check', 'Jambo la kuangalia'),
      title: tx(lang, 'This moment, not a label', 'Wakati huu, si jina'),
      lead: tx(lang, 'A change does not rename this pregnancy.', 'Mabadiliko hayabadilishi jina la mimba hii.'),
      body: watchBody,
      art: 'band',
      tone: 'watch',
      chips: chips(
        'watch',
        [
          tx(lang, 'A reading changed', 'Kipimo kimebadilika'),
          tx(lang, 'Headache with high BP', 'Kichwa na shinikizo'),
          tx(lang, 'Not a label', 'Si jina'),
        ],
        () => watchBody,
      ),
      watch: tx(lang, 'Reach your CHP. She does not name an illness.', 'Fikia CHP wako. Hatoi jina la ugonjwa.'),
      action: tx(lang, 'Reach your CHP today.', 'Fikia CHP wako leo.'),
      next: tx(lang, 'Next', 'Endelea'),
    });
  }

  const learned = input.baselineProgress !== null && input.baselineProgress >= 1;
  const learnBody = learned
    ? tx(
        lang,
        'Your heart beats more slowly when you are asleep. That is expected, and Neema does not treat sleep as an emergency. Being unconscious is different: you cannot be woken. If someone cannot wake you, they should get help. Neema asks how you feel every day, and sooner when a reading sits far from your usual.',
        'Moyo hupiga polepole ukiwa umelala. Hilo linatarajiwa, na Neema haichukulii usingizi kama dharura. Kupoteza fahamu ni tofauti: huwezi kuamshwa. Mtu asipoweza kukuamsha, atafute msaada. Neema huuliza jinsi unavyohisi kila siku, na mapema kipimo kinapokuwa mbali na kawaida yako.',
      )
    : tx(
        lang,
        'Neema learns your usual heart rate from quiet minutes, about three days of them. Until that is ready, one number is not called normal and is not called dangerous on its own. A slower heart while you sleep is still expected, and is not an emergency by itself.',
        'Neema hujifunza mapigo yako ya kawaida kutoka dakika za utulivu, karibu siku tatu. Kabla ya hapo, namba moja haiitwi kawaida na haiitwi hatari peke yake. Moyo unaopiga polepole ukiwa umelala bado unatarajiwa, na si dharura peke yake.',
      );
  const learnWatch = tx(
    lang,
    'If someone cannot wake you, they should get help. Sleep itself is not an emergency.',
    'Mtu asipoweza kukuamsha, atafute msaada. Usingizi wenyewe si dharura.',
  );
  slides.push({
    id: 'learn',
    kicker: tx(lang, 'What Neema is learning', 'Neema anajifunza nini'),
    title: learned
      ? tx(lang, 'She knows your usual heart rate', 'Anajua mapigo yako ya kawaida')
      : tx(lang, 'She is still learning your usual', 'Bado anajifunza kawaida yako'),
    lead: learned
      ? tx(lang, 'A slower heart in sleep is expected.', 'Moyo wa polepole ukiwa umelala unatarajiwa.')
      : tx(lang, 'About three quiet days. One number is not enough.', 'Karibu siku tatu za utulivu. Namba moja haitoshi.'),
    body: learnBody,
    art: 'band',
    tone: 'learn',
    chips: chips(
      'learn',
      learned
        ? [
            tx(lang, 'Slower while asleep', 'Polepole ukiwa umelala'),
            tx(lang, 'Sleep is not an emergency', 'Usingizi si dharura'),
            tx(lang, 'Cannot be woken', 'Hawezi kuamshwa'),
          ]
        : [
            tx(lang, 'Quiet minutes', 'Dakika za utulivu'),
            tx(lang, 'About three days', 'Karibu siku tatu'),
            tx(lang, 'One number is not enough', 'Namba moja haitoshi'),
          ],
      (label) => (/woken|amshwa|emergency|dharura/i.test(label) ? learnWatch : learnBody),
    ),
    watch: learnWatch,
    action: tx(
      lang,
      'She asks how you feel every day, and sooner when a reading sits far from your usual.',
      'Anauliza jinsi unavyohisi kila siku, na mapema kipimo kinapokuwa mbali na kawaida yako.',
    ),
    next: tx(lang, 'Next', 'Endelea'),
  });

  slides.push({
    id: 'more',
    kicker: tx(lang, 'If you want more', 'Ukitaka zaidi'),
    title: tx(lang, 'Ask Neema about today', 'Muulize Neema kuhusu leo'),
    lead: tx(lang, 'These cards stay in the conversation.', 'Kadi hizi zinabaki kwenye mazungumzo.'),
    body: tx(
      lang,
      'The chat opens with these cards still in the conversation, so you do not have to explain them again. You can also start a fresh question.',
      'Mazungumzo yanafunguka na kadi hizi bado ndani, ili usilazimike kuzieleza tena. Unaweza pia kuanza swali jipya.',
    ),
    art: 'portrait',
    tone: 'talk',
    chips: chips(
      'more',
      [
        tx(lang, 'Keep these cards', 'Weka kadi hizi'),
        tx(lang, 'Ask in your words', 'Uliza kwa maneno yako'),
        tx(lang, 'Voice or text', 'Sauti au maandishi'),
      ],
      () =>
        tx(
          lang,
          'The chat opens with these cards still in it. You can also start a fresh question.',
          'Mazungumzo yanafunguka na kadi hizi bado ndani. Unaweza pia kuanza swali jipya.',
        ),
    ),
    action: tx(lang, 'Talk with Neema about today.', 'Ongea na Neema kuhusu leo.'),
    next: tx(lang, 'Talk to Neema', 'Ongea na Neema'),
  });

  return slides;
}

/** Plain text handed to CareChat so the cards are not lost. */
export function storyContext(slides: StorySlide[]): string {
  return slides
    .filter((s) => s.id !== 'more')
    .map((s) => {
      const extra = [s.watch, s.action].filter(Boolean).join(' ');
      return extra ? `${s.title}. ${s.body} ${extra}` : `${s.title}. ${s.body}`;
    })
    .join('\n\n');
}
