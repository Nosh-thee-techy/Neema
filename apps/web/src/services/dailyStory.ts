/**
 * Slides for "today", built from the guides already in the app and from what she saved.
 * No new medical advice. The personal baseline is the model we actually have:
 * it learns her usual heart rate and can only ask for a closer look, never call her fine.
 */

import { WEEKLY_INSIGHTS, insightForWeek, recoveryStageFor, type WeeklyInsight } from '@neema/core';
import type { CarePath, JourneyPhase } from './carePath';

export interface StorySlide {
  id: string;
  kicker: string;
  title: string;
  body: string;
  next: string;
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

/** One deck. The last slide always offers Neema, carrying these words into the chat. */
export function buildDailyStory(input: StoryInput): StorySlide[] {
  const { lang, phase, path, name } = input;
  const slides: StorySlide[] = [];

  if (phase === 'after' && input.daysSinceBirth !== null) {
    const stage = recoveryStageFor(input.daysSinceBirth);
    const early = input.daysSinceBirth < 3;
    slides.push({
      id: 'today',
      kicker: tx(lang, 'Today', 'Leo'),
      title: tx(lang, `Day ${input.daysSinceBirth} of healing, ${name}`, `Siku ${input.daysSinceBirth} ya kupona, ${name}`),
      body: early
        ? tx(
            lang,
            'The first three days after birth are often the hardest on the body. Bleeding, after-pains and broken sleep can all be part of it. A feeling that is getting worse is worth a person, not a wait.',
            'Siku tatu za kwanza baada ya kujifungua mara nyingi huwa ngumu kwa mwili. Kutokwa na damu, maumivu na usingizi wa vipande vinaweza kuwa vya kawaida. Hisia inayozidi inahitaji mtu, si kusubiri.',
          )
        : stage.intro[lang],
      next: tx(lang, 'Okay', 'Sawa'),
    });
    slides.push({
      id: 'heal',
      kicker: tx(lang, 'Healing', 'Kupona'),
      title: stage.title[lang],
      body: stage.normal[0]?.[lang] ?? stage.intro[lang],
      next: tx(lang, 'Next', 'Endelea'),
    });
    slides.push({
      id: 'mood',
      kicker: tx(lang, 'How you feel', 'Jinsi unavyohisi'),
      title: tx(lang, 'A hard day is not a failing', 'Siku ngumu si kushindwa'),
      body: tx(
        lang,
        'Neema notices low mood from what you report: several hard days, very little sleep, or little interest in things you used to enjoy. She does not give it a name. If it lasts, or if you think of harm, she asks you to reach a person today.',
        'Neema huona huzuni kutokana na unachoripoti: siku ngumu kadhaa, usingizi mdogo sana, au kutopendezwa na mambo uliyoyapenda. Hatoi jina. Ikizidi, au ukifikiria kujidhuru, anakuomba ufikie mtu leo.',
      ),
      next: tx(lang, 'Next', 'Endelea'),
    });
  } else {
    const week = input.weeks ?? 4;
    const card: WeeklyInsight = insightForWeek(week) ?? WEEKLY_INSIGHTS[0]!;
    const where =
      phase === 'before'
        ? tx(lang, `Week ${week}, day ${input.days}. You have just been told, and that is enough for today.`, `Wiki ${week}, siku ${input.days}. Umeambiwa tu, na hiyo inatosha leo.`)
        : tx(lang, `Week ${week}, day ${input.days} of your pregnancy.`, `Wiki ${week}, siku ${input.days} ya mimba yako.`);
    slides.push({
      id: 'today',
      kicker: tx(lang, 'Today', 'Leo'),
      title: tx(lang, `How you might feel, ${name}`, `Unavyoweza kuhisi, ${name}`),
      body: `${where} ${feel(card, lang)}`,
      next: tx(lang, 'Okay', 'Sawa'),
    });
    slides.push({
      id: 'baby',
      kicker: tx(lang, 'Your baby', 'Mtoto wako'),
      title: tx(lang, 'What is growing', 'Kinachokua'),
      body: baby(card, lang),
      next: tx(lang, 'Next', 'Endelea'),
    });
  }

  if (path === 'known') {
    const meds = input.medications.length ? input.medications.join(', ') : '';
    const cond = input.conditions.length ? input.conditions.join(', ') : '';
    slides.push({
      id: 'known',
      kicker: tx(lang, 'Care you already have', 'Huduma uliyonayo'),
      title: meds
        ? tx(lang, 'Medicine for today', 'Dawa ya leo')
        : tx(lang, 'What you already told us', 'Ulichotuambia tayari'),
      body: tx(
        lang,
        `${meds ? `You take ${meds}. ` : ''}${cond ? `You also noted ${cond}. ` : ''}A new feeling, such as dizziness, can come from the medicine and it can come from the pregnancy. Neema will not skip it, and will not decide it is only the medicine. Tell your CHP both: the feeling, and what you take.`,
        `${meds ? `Unatumia ${meds}. ` : ''}${cond ? `Pia ulitaja ${cond}. ` : ''}Hisia mpya, kama kizunguzungu, inaweza kutoka kwa dawa na inaweza kutoka kwa mimba. Neema haitaipuuza, na haitaamua ni dawa pekee. Mwambie CHP wako vyote viwili: hisia, na unachotumia.`,
      ),
      next: tx(lang, 'Next', 'Endelea'),
    });
  } else if (path === 'watch') {
    slides.push({
      id: 'watch',
      kicker: tx(lang, 'Something to check', 'Jambo la kuangalia'),
      title: tx(lang, 'This moment, not a label', 'Wakati huu, si jina'),
      body: tx(
        lang,
        'Something in your readings or how you feel needs a look. That does not rename your pregnancy. Neema watches for patterns, such as a headache together with a high blood pressure, and asks you to reach your CHP. She does not tell you the name of an illness.',
        'Kuna kitu kwenye vipimo au jinsi unavyohisi kinahitaji kuangaliwa. Hilo halibadilishi jina la mimba yako. Neema huangalia mifumo, kama kichwa kuuma pamoja na shinikizo la juu, na kukuomba ufikie CHP wako. Hakuambii jina la ugonjwa.',
      ),
      next: tx(lang, 'Next', 'Endelea'),
    });
  }

  const learned = input.baselineProgress !== null && input.baselineProgress >= 1;
  slides.push({
    id: 'learn',
    kicker: tx(lang, 'What Neema is learning', 'Neema anajifunza nini'),
    title: learned
      ? tx(lang, 'She knows your usual heart rate', 'Anajua mapigo yako ya kawaida')
      : tx(lang, 'She is still learning your usual', 'Bado anajifunza kawaida yako'),
    body: learned
      ? tx(
          lang,
          'Your heart beats more slowly when you are asleep. That is expected, and Neema does not treat sleep as an emergency. Being unconscious is different: you cannot be woken. If someone cannot wake you, they should get help. Neema asks how you feel every day, and sooner when a reading sits far from your usual.',
          'Moyo hupiga polepole ukiwa umelala. Hilo linatarajiwa, na Neema haichukulii usingizi kama dharura. Kupoteza fahamu ni tofauti: huwezi kuamshwa. Mtu asipoweza kukuamsha, atafute msaada. Neema huuliza jinsi unavyohisi kila siku, na mapema kipimo kinapokuwa mbali na kawaida yako.',
        )
      : tx(
          lang,
          'Neema learns your usual heart rate from quiet minutes, about three days of them. Until that is ready, one number is not called normal and is not called dangerous on its own. A slower heart while you sleep is still expected, and is not an emergency by itself.',
          'Neema hujifunza mapigo yako ya kawaida kutoka dakika za utulivu, karibu siku tatu. Kabla ya hapo, namba moja haiitwi kawaida na haiitwi hatari peke yake. Moyo unaopiga polepole ukiwa umelala bado unatarajiwa, na si dharura peke yake.',
        ),
    next: tx(lang, 'Next', 'Endelea'),
  });

  slides.push({
    id: 'more',
    kicker: tx(lang, 'If you want more', 'Ukitaka zaidi'),
    title: tx(lang, 'Ask Neema about today', 'Muulize Neema kuhusu leo'),
    body: tx(
      lang,
      'The chat opens with these cards still in the conversation, so you do not have to explain them again. You can also start a fresh question.',
      'Mazungumzo yanafunguka na kadi hizi bado ndani, ili usilazimike kuzieleza tena. Unaweza pia kuanza swali jipya.',
    ),
    next: tx(lang, 'Talk to Neema', 'Ongea na Neema'),
  });

  return slides;
}

/** Plain text handed to CareChat so the cards are not lost. */
export function storyContext(slides: StorySlide[]): string {
  return slides
    .filter((s) => s.id !== 'more')
    .map((s) => `${s.title}. ${s.body}`)
    .join('\n\n');
}
