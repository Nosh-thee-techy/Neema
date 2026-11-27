/**
 * "This week" pregnancy insights, one card per stage of pregnancy.
 *
 * Adapted (rewritten in plain words, not copied) from the NHS week-by-week pregnancy
 * guide, which NHS publishes for re-use under its terms / Open Government Licence.
 * UK-only advice (UK benefits, UK vaccine schedule, winter vitamin D) is left out;
 * medicines and vaccines point to "your clinic" instead, in line with WHO ANC
 * recommendations and the Kenya MoH Mother & Child Health Handbook.
 *
 * STATUS: every card is a DRAFT until a nurse or midwife signs it off, and every
 * Swahili line needs native-speaker review. Field readiness lists these.
 */

import type { MessageReviewStatus as ReviewStatus } from './messages/catalog.js';

export interface WeeklyInsight {
  id: string;
  fromWeek: number;
  toWeek: number;
  /** Approximate size, from the source. */
  sizeEn: string;
  sizeSw: string;
  babyEn: string;
  babySw: string;
  feelEn: string;
  feelSw: string;
  doEn: string;
  doSw: string;
  /** When to contact the CHP / clinic straight away. */
  watchEn: string;
  watchSw: string;
  sourceName: string;
  sourceUrl: string;
  status: ReviewStatus;
}

const NHS = 'NHS week-by-week pregnancy guide (adapted)';
const base = 'https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy';

export const WEEKLY_INSIGHTS: WeeklyInsight[] = [
  {
    id: 'w04_07',
    fromWeek: 4,
    toWeek: 7,
    sizeEn: 'About 6 mm, the size of a pea',
    sizeSw: 'Karibu milimita 6, kama punje ya njegere',
    babyEn: 'Tiny arms and legs are starting as small buds. The heart, brain and liver are forming.',
    babySw: 'Mikono na miguu midogo inaanza kuota. Moyo, ubongo na ini vinaanza kuumbika.',
    feelEn: 'Morning sickness, tiredness, sore breasts, passing urine more often and a strong sense of smell are common.',
    feelSw: 'Kichefuchefu cha asubuhi, uchovu, matiti kuuma, kukojoa mara kwa mara na kunusa kwa nguvu ni kawaida.',
    doEn: 'Rest when you can. Eat small meals often and drink water. Start clinic visits (ANC) early, before 12 weeks.',
    doSw: 'Pumzika unapoweza. Kula milo midogo mara nyingi na kunywa maji. Anza kliniki (ANC) mapema, kabla ya wiki 12.',
    watchEn: 'Any bleeding, or if you cannot keep food or water down: contact your CHP or clinic.',
    watchSw: 'Damu yoyote, au ukishindwa kubakiza chakula au maji: wasiliana na CHP au kliniki.',
    sourceName: NHS,
    sourceUrl: `${base}/1st-trimester/week-6/`,
    status: 'draft',
  },
  {
    id: 'w08_11',
    fromWeek: 8,
    toWeek: 11,
    sizeEn: 'About 3 cm',
    sizeSw: 'Karibu sentimita 3',
    babyEn: 'The face is taking shape and the baby makes small jerky movements. The heart beats very fast.',
    babySw: 'Uso unaumbika na mtoto anafanya miondoko midogo ya ghafla. Moyo unapiga kwa kasi sana.',
    feelEn: 'Tiredness, nausea, heartburn, bloating, headaches and mood swings are common. Many feel better after 12 weeks.',
    feelSw: 'Uchovu, kichefuchefu, kiungulia, tumbo kujaa gesi, kichwa kuuma na hisia kubadilika ni kawaida. Wengi hupata nafuu baada ya wiki 12.',
    doEn: 'Eat slowly, in small meals, and walk a little after eating. Take the iron and folic acid tablets your clinic gives you.',
    doSw: 'Kula polepole, milo midogo, na tembea kidogo baada ya kula. Meza vidonge vya madini ya chuma na foliki unavyopewa kliniki.',
    watchEn: 'Any spotting or bleeding: contact your CHP or clinic.',
    watchSw: 'Matone au damu yoyote: wasiliana na CHP au kliniki.',
    sourceName: NHS,
    sourceUrl: `${base}/1st-trimester/week-10/`,
    status: 'draft',
  },
  {
    id: 'w12_15',
    fromWeek: 12,
    toWeek: 15,
    sizeEn: 'About 8.5 cm',
    sizeSw: 'Karibu sentimita 8.5',
    babyEn: 'The baby is kicking, but you probably cannot feel it yet. A health worker may hear the heartbeat.',
    babySw: 'Mtoto anapiga mateke, lakini huenda bado huhisi. Mhudumu wa afya anaweza kusikia mapigo ya moyo.',
    feelEn: 'Sickness and tiredness often ease and appetite returns. Bleeding gums, heartburn and leg cramps can happen.',
    feelSw: 'Kichefuchefu na uchovu mara nyingi hupungua na hamu ya kula hurudi. Fizi kutoa damu, kiungulia na mikakamao ya miguu vinaweza kutokea.',
    doEn: 'Choose healthy snacks; you do not need to eat for two. Start pelvic floor (squeezing) exercises.',
    doSw: 'Chagua vitafunio vyenye afya; huhitaji kula kwa watu wawili. Anza mazoezi ya kubana misuli ya nyonga.',
    watchEn: 'Any bleeding, or if you feel you are not coping: talk to your CHP or clinic.',
    watchSw: 'Damu yoyote, au ukihisi huwezi kustahimili: ongea na CHP au kliniki.',
    sourceName: NHS,
    sourceUrl: `${base}/2nd-trimester/week-14/`,
    status: 'draft',
  },
  {
    id: 'w16_19',
    fromWeek: 16,
    toWeek: 19,
    sizeEn: 'About 14 cm',
    sizeSw: 'Karibu sentimita 14',
    babyEn: 'The baby can hear, swallow and suck. You may start to feel movements, like bubbles or fluttering.',
    babySw: 'Mtoto anaweza kusikia, kumeza na kunyonya. Unaweza kuanza kuhisi akisonga, kama mapovu au kupepea.',
    feelEn: 'You may feel dizzy if you stand up quickly. A dark line on the belly and stretch marks are normal.',
    feelSw: 'Unaweza kuhisi kizunguzungu ukisimama haraka. Mstari mweusi tumboni na michirizi ni kawaida.',
    doEn: 'Stand up slowly. Keep your clinic visits; a scan around 18–20 weeks may be offered.',
    doSw: 'Simama polepole. Hudhuria kliniki; huenda ukapewa kipimo cha picha (scan) karibu wiki 18–20.',
    watchEn: 'Any vaginal bleeding: get medical help.',
    watchSw: 'Damu yoyote ukeni: tafuta msaada wa matibabu.',
    sourceName: NHS,
    sourceUrl: `${base}/2nd-trimester/week-18/`,
    status: 'draft',
  },
  {
    id: 'w20_23',
    fromWeek: 20,
    toWeek: 23,
    sizeEn: 'About 28 cm, head to toe',
    sizeSw: 'Karibu sentimita 28, kichwa hadi miguu',
    babyEn: 'The lungs are growing and the baby practises breathing. Taste buds are forming.',
    babySw: 'Mapafu yanakua na mtoto anajifunza kupumua. Vionjo vya ladha vinaumbika.',
    feelEn: 'Backache, heartburn, leg cramps, swollen feet and stretch marks are common.',
    feelSw: 'Maumivu ya mgongo, kiungulia, mikakamao ya miguu, miguu kuvimba kidogo na michirizi ni kawaida.',
    doEn: 'Stay active: short walks most days. Ask your clinic which vaccines are due for you.',
    doSw: 'Kuwa mchangamfu: matembezi mafupi siku nyingi. Uliza kliniki chanjo unazostahili kupata.',
    watchEn: 'Severe pain or any bleeding: get help straight away.',
    watchSw: 'Maumivu makali au damu yoyote: tafuta msaada mara moja.',
    sourceName: NHS,
    sourceUrl: `${base}/2nd-trimester/week-22/`,
    status: 'draft',
  },
  {
    id: 'w24_27',
    fromWeek: 24,
    toWeek: 27,
    sizeEn: 'About 36 cm, the length of a cucumber',
    sizeSw: 'Karibu sentimita 36, urefu wa tango',
    babyEn: 'The eyes open for the first time. There is a lot of movement inside the bump.',
    babySw: 'Macho yanafunguka kwa mara ya kwanza. Mtoto anasonga sana tumboni.',
    feelEn: 'Leg cramps at night, forgetfulness, backache and feeling clumsy are common.',
    feelSw: 'Mikakamao ya miguu usiku, kusahau, maumivu ya mgongo na kujihisi mzito ni kawaida.',
    doEn: 'For cramps, gently pull your toes up towards you. Start thinking about your birth plan.',
    doSw: 'Kwa mikakamao, vuta vidole vya miguu kuelekea kwako taratibu. Anza kufikiria mpango wako wa kujifungua.',
    watchEn: "If the baby's movements slow down or stop: contact your CHP or clinic straight away.",
    watchSw: 'Mtoto akipunguza kusonga au akiacha: wasiliana na CHP au kliniki mara moja.',
    sourceName: NHS,
    sourceUrl: `${base}/2nd-trimester/week-26/`,
    status: 'draft',
  },
  {
    id: 'w28_31',
    fromWeek: 28,
    toWeek: 31,
    sizeEn: 'About 39 cm',
    sizeSw: 'Karibu sentimita 39',
    babyEn: 'The baby is fully formed and now grows and builds fat. Often most active when you try to sleep.',
    babySw: 'Mtoto ameumbika kikamilifu na sasa anakua na kuongeza mafuta. Mara nyingi husonga sana unapojaribu kulala.',
    feelEn: 'Breathlessness, back pain, waking at night to pass urine and heartburn are common.',
    feelSw: 'Kupumua kwa shida kidogo, maumivu ya mgongo, kuamka usiku kukojoa na kiungulia ni kawaida.',
    doEn: 'Sleep on your side from now on, with pillows for support. Get to know your baby’s usual movements.',
    doSw: 'Kuanzia sasa lala upande, ukitumia mito. Fahamu jinsi mtoto wako husonga kwa kawaida.',
    watchEn: 'Movements change or stop, any bleeding, or a fall: contact your CHP or clinic.',
    watchSw: 'Miondoko ikibadilika au ikiacha, damu yoyote, au ukianguka: wasiliana na CHP au kliniki.',
    sourceName: NHS,
    sourceUrl: `${base}/3rd-trimester/week-29/`,
    status: 'draft',
  },
  {
    id: 'w32_35',
    fromWeek: 32,
    toWeek: 35,
    sizeEn: 'About 44 cm, the size of a pineapple',
    sizeSw: 'Karibu sentimita 44, ukubwa wa nanasi',
    babyEn: 'The brain is fully developed and bones are hardening. The skull stays soft to make birth easier.',
    babySw: 'Ubongo umekamilika na mifupa inakuwa migumu. Fuvu hubaki laini ili kurahisisha kujifungua.',
    feelEn: 'Heaviness low in the belly and painless practice tightenings that last under a minute are common.',
    feelSw: 'Uzito chini ya tumbo na mikazo ya mazoezi isiyouma inayodumu chini ya dakika moja ni kawaida.',
    doEn: 'Pack a bag for the facility. Save your CHP, clinic and transport numbers in your phone and on paper.',
    doSw: 'Andaa begi la kwenda kituo cha afya. Hifadhi namba za CHP, kliniki na usafiri kwenye simu na karatasi.',
    watchEn: 'Tightenings that become painful or regular, or any bleeding: contact your clinic.',
    watchSw: 'Mikazo ikianza kuuma au kuja kwa mpangilio, au damu yoyote: wasiliana na kliniki.',
    sourceName: NHS,
    sourceUrl: `${base}/3rd-trimester/week-33/`,
    status: 'draft',
  },
  {
    id: 'w36_38',
    fromWeek: 36,
    toWeek: 38,
    sizeEn: 'About 49 cm',
    sizeSw: 'Karibu sentimita 49',
    babyEn: 'The baby is close to full term. Most babies are now head down and may move lower into the pelvis.',
    babySw: 'Mtoto anakaribia kukomaa. Watoto wengi sasa wamegeuka kichwa chini na wanaweza kushuka kwenye nyonga.',
    feelEn: 'Breathing may get easier as the baby drops. More discharge and an urge to prepare the home are common.',
    feelSw: 'Kupumua kunaweza kuwa rahisi mtoto akishuka. Uchafu mwingi ukeni na hamu ya kuandaa nyumba ni kawaida.',
    doEn: 'Learn the signs of labour: regular tightenings, a sticky show, back pain, or your waters breaking.',
    doSw: 'Jifunze dalili za uchungu: mikazo ya mara kwa mara, ute mzito, maumivu ya mgongo, au maji kupasuka.',
    watchEn: 'Any bleeding, or signs that labour has started: contact your clinic and get ready to go.',
    watchSw: 'Damu yoyote, au dalili za uchungu kuanza: wasiliana na kliniki na ujiandae kwenda.',
    sourceName: NHS,
    sourceUrl: `${base}/3rd-trimester/week-37/`,
    status: 'draft',
  },
  {
    id: 'w39_42',
    fromWeek: 39,
    toWeek: 42,
    sizeEn: 'About 51 cm',
    sizeSw: 'Karibu sentimita 51',
    babyEn: 'The baby is squashed in the womb but should keep moving in its usual pattern.',
    babySw: 'Mtoto amebanwa tumboni lakini anapaswa kuendelea kusonga kama kawaida yake.',
    feelEn: 'Practice tightenings, lower backache and period-like feelings can be early signs of labour.',
    feelSw: 'Mikazo ya mazoezi, maumivu ya kiuno na hisia kama za hedhi zinaweza kuwa dalili za mwanzo za uchungu.',
    doEn: 'Rest at night and keep gently active in the day. Do not use home methods to start labour.',
    doSw: 'Pumzika usiku na fanya shughuli nyepesi mchana. Usitumie njia za nyumbani kuanzisha uchungu.',
    watchEn: 'Go to the facility if contractions last a minute and come every 5 minutes, your waters break, there is bleeding, or the baby moves less.',
    watchSw: 'Nenda kituo cha afya mikazo ikidumu dakika moja na kuja kila dakika 5, maji yakipasuka, ukitoka damu, au mtoto akisonga kidogo.',
    sourceName: NHS,
    sourceUrl: `${base}/3rd-trimester/week-40/`,
    status: 'draft',
  },
];

/** The card for a completed week of pregnancy; early weeks use the first card. */
export function insightForWeek(week: number): WeeklyInsight | null {
  if (!Number.isFinite(week) || week < 0) return null;
  if (week < WEEKLY_INSIGHTS[0]!.fromWeek) return WEEKLY_INSIGHTS[0]!;
  return WEEKLY_INSIGHTS.find((c) => week >= c.fromWeek && week <= c.toWeek) ?? null;
}

/** True once every card has been reviewed by a clinician (and Swahili checked). */
export function weeklyInsightsReviewed(cards: readonly WeeklyInsight[] = WEEKLY_INSIGHTS): boolean {
  return cards.every((c) => c.status === 'reviewed');
}
