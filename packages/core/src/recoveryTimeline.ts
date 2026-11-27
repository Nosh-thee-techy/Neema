/**
 * "Your Recovery: What to Expect" — eight weeks after birth, in six stages.
 *
 * Written in our own words from NHS "after the birth" guidance, the WHO 2022 postnatal
 * care guideline and NHS inform. Every stage separates:
 *   - normal      what may be normal (never includes a danger sign)
 *   - today       contact your CHP or clinic TODAY (prompt clinical review)
 *   - emergency   go to a facility NOW / call 999
 *
 * STATUS: DRAFT until a nurse or midwife approves it, and Swahili needs native review.
 * These are content stages, not clinical deadlines: every recovery is different.
 */

import type { MessageReviewStatus as ReviewStatus } from './messages/catalog.js';

export interface Bi {
  en: string;
  sw: string;
}

export interface RecoveryTopic {
  heading: Bi;
  text: Bi;
}

export interface RecoveryStage {
  id: string;
  fromDay: number;
  /** Inclusive; the last stage keeps showing after 8 weeks. */
  toDay: number;
  title: Bi;
  range: Bi;
  intro: Bi;
  topics: RecoveryTopic[];
  normal: Bi[];
  /** Extra "contact today" signs for this stage (shown before the shared list). */
  todayExtra: Bi[];
  /** Extra caesarean-specific note, if any. */
  caesareanNote?: Bi;
  sources: Array<{ name: string; url: string }>;
  status: ReviewStatus;
}

const b = (en: string, sw: string): Bi => ({ en, sw });

/** Signs that mean: go to a health facility now or call 999. Same in every stage. */
export const RECOVERY_EMERGENCY_SIGNS: Bi[] = [
  b('Bleeding that soaks a pad in an hour or less, or clots bigger than a 20-shilling coin',
    'Damu inayolowesha pedi ndani ya saa moja au chini, au mabonge makubwa kuliko sarafu ya shilingi 20'),
  b('Fainting, or feeling very dizzy with a racing heart', 'Kuzirai, au kizunguzungu kikali na moyo kwenda mbio'),
  b('Chest pain, or struggling to breathe', 'Maumivu ya kifua, au kushindwa kupumua'),
  b('A fit (convulsion)', 'Degedege (kifafa)'),
  b('A severe headache that will not go away, blurred vision, or pain under the ribs', 'Kichwa kuuma sana bila kupoa, kuona ukungu, au maumivu chini ya mbavu'),
  b('Severe pain in the tummy', 'Maumivu makali ya tumbo'),
  b('Thoughts of harming yourself or your baby', 'Mawazo ya kujidhuru au kumdhuru mtoto wako'),
];

/** Signs that need a health worker today (prompt review, not "wait and see"). */
export const RECOVERY_TODAY_SIGNS: Bi[] = [
  b('Fever, chills or shivering', 'Homa, baridi au kutetemeka'),
  b('Bad-smelling discharge from the vagina', 'Uchafu wenye harufu mbaya kutoka ukeni'),
  b('Bleeding that gets heavier again, or turns bright red again after getting lighter', 'Damu inayoongezeka tena, au kuwa nyekundu tena baada ya kupungua'),
  b('Stitches or a caesarean wound that is red, hot, swollen, leaking or opening', 'Mshono au kidonda cha upasuaji kilicho chekundu, cha moto, kilichovimba, kinachotoa usaha au kufunguka'),
  b('Pain, redness or swelling in one leg', 'Maumivu, wekundu au uvimbe kwenye mguu mmoja'),
  b('A breast that is red, hot, hard and painful', 'Titi jekundu, la moto, gumu na linalouma'),
  b('Pain or burning when passing urine, or not able to pass urine', 'Maumivu au kuungua wakati wa kukojoa, au kushindwa kukojoa'),
];

const NHS_EARLY = { name: 'NHS: early days after the birth', url: 'https://www.nhs.uk/pregnancy/labour-and-birth/after-the-birth/early-days/' };
const NHS_INFORM = { name: 'NHS inform: you and your body after birth', url: 'https://www.nhsinform.scot/ready-steady-baby/early-parenthood/your-wellbeing-after-the-birth/you-and-your-body-after-birth' };
const WHO_PNC = { name: 'WHO 2022 postnatal care recommendations', url: 'https://www.who.int/news/item/30-03-2022-who-urges-quality-care-for-women-and-newborns-in-critical-first-weeks-after-childbirth' };

export const RECOVERY_STAGES: RecoveryStage[] = [
  {
    id: 'first_24h',
    fromDay: 0,
    toDay: 1,
    title: b('The first 24 hours', 'Saa 24 za kwanza'),
    range: b('Day of birth and the day after', 'Siku ya kujifungua na siku inayofuata'),
    intro: b(
      'Your body has done something huge. Health workers should check your bleeding, blood pressure, temperature and pulse often in these first hours. If you gave birth in a facility, staying at least 24 hours is recommended.',
      'Mwili wako umefanya kazi kubwa. Wahudumu wa afya wanapaswa kukagua damu, shinikizo la damu, joto na mapigo mara kwa mara katika saa hizi za kwanza. Ukijifungua kituoni, inashauriwa kukaa angalau saa 24.',
    ),
    topics: [
      { heading: b('Bleeding', 'Damu'), text: b('Bleeding (lochia) is heaviest now: bright red, like a heavy period. Use thick pads and change them often.', 'Damu (lochia) ni nyingi zaidi sasa: nyekundu, kama hedhi nzito. Tumia pedi nene na uzibadilishe mara kwa mara.') },
      { heading: b('Afterpains', 'Maumivu baada ya kujifungua'), text: b('Cramps like period pains happen as your womb shrinks. They are often stronger while breastfeeding and after a second or later baby.', 'Mikazo kama ya hedhi hutokea mji wa mimba ukisinyaa. Mara nyingi huwa mikali zaidi unaponyonyesha na kwa mtoto wa pili au zaidi.') },
      { heading: b('First feeds', 'Kunyonyesha kwa mara ya kwanza'), text: b('Put baby skin-to-skin and to the breast early. The first thick yellow milk (colostrum) is small in amount but is all your baby needs now.', 'Mweke mtoto ngozi kwa ngozi na umnyonyeshe mapema. Maziwa ya kwanza mazito ya manjano ni machache lakini ndiyo yote mtoto anahitaji sasa.') },
    ],
    normal: [
      b('Bright red bleeding like a heavy period, with small clots', 'Damu nyekundu kama hedhi nzito, yenye mabonge madogo'),
      b('Cramping afterpains, stronger when feeding', 'Maumivu ya mikazo, makali zaidi unaponyonyesha'),
      b('Soreness between the legs, or around a caesarean wound', 'Maumivu kati ya miguu, au karibu na kidonda cha upasuaji'),
      b('Shaking, feeling very tired, hungry or thirsty', 'Kutetemeka, uchovu mwingi, njaa au kiu'),
      b('Stinging when you pass urine', 'Kuwashwa unapokojoa'),
    ],
    todayExtra: [],
    caesareanNote: b('After a caesarean you will be helped to move gently and the wound will be checked. Ask for pain relief so you can move and feed.', 'Baada ya upasuaji utasaidiwa kutembea taratibu na kidonda kitakaguliwa. Omba dawa ya maumivu ili uweze kutembea na kunyonyesha.'),
    sources: [WHO_PNC, NHS_INFORM],
    status: 'draft',
  },
  {
    id: 'days_2_7',
    fromDay: 2,
    toDay: 7,
    title: b('Days 2 to 7', 'Siku 2 hadi 7'),
    range: b('The first week', 'Wiki ya kwanza'),
    intro: b(
      'Big changes happen this week: your milk comes in, bleeding starts to settle and your hormones shift. A postnatal check around day 3 is recommended.',
      'Mabadiliko makubwa hutokea wiki hii: maziwa yanaanza kuja, damu inaanza kupungua na homoni zinabadilika. Ukaguzi wa baada ya kujifungua karibu siku ya 3 unashauriwa.',
    ),
    topics: [
      { heading: b('Bleeding', 'Damu'), text: b('Bleeding slowly becomes lighter and darker, brownish or pinkish red.', 'Damu inapungua taratibu na kuwa nyeusi kidogo, kahawia au nyekundu iliyofifia.') },
      { heading: b('Breasts', 'Matiti'), text: b('Around day 3 to 5 your breasts may feel full, heavy, warm and tender as milk comes in. Feeding often helps.', 'Karibu siku ya 3 hadi 5 matiti yanaweza kujaa, kuwa mazito, ya moto na kuuma maziwa yakija. Kunyonyesha mara kwa mara husaidia.') },
      { heading: b('Feelings', 'Hisia'), text: b('Feeling tearful, anxious or up and down in the first week is common ("baby blues"). It usually passes within two weeks.', 'Kulia ovyo, wasiwasi au hisia kubadilika wiki ya kwanza ni kawaida. Kwa kawaida hupita ndani ya wiki mbili.') },
      { heading: b('Sleep', 'Usingizi'), text: b('Broken sleep and exhaustion are expected. Rest when baby sleeps and accept help with housework.', 'Usingizi wa vipande na uchovu ni kawaida. Pumzika mtoto akilala na ukubali msaada wa kazi za nyumbani.') },
    ],
    normal: [
      b('Bleeding that is getting lighter and darker', 'Damu inayopungua na kuwa nyeusi kidogo'),
      b('Full, tender breasts when milk comes in', 'Matiti yaliyojaa na kuuma maziwa yakija'),
      b('Feeling weepy or anxious on some days', 'Kujihisi kulia au wasiwasi siku fulani'),
      b('Soreness from stitches or the wound that is slowly improving', 'Maumivu ya mshono au kidonda yanayopungua taratibu'),
      b('Very tired, sweating at night, constipation', 'Uchovu mwingi, jasho usiku, kufunga choo'),
    ],
    todayExtra: [b('Feeling unable to cope, or not able to sleep even when you have the chance', 'Kuhisi huwezi kustahimili, au kushindwa kulala hata ukipata nafasi')],
    caesareanNote: b('After a caesarean: keep the wound clean and dry, and do not lift anything heavier than your baby.', 'Baada ya upasuaji: weka kidonda safi na kikavu, na usibebe kitu kizito kuliko mtoto wako.'),
    sources: [NHS_EARLY, WHO_PNC],
    status: 'draft',
  },
  {
    id: 'week_2',
    fromDay: 8,
    toDay: 14,
    title: b('Week 2', 'Wiki ya 2'),
    range: b('Days 8 to 14', 'Siku 8 hadi 14'),
    intro: b(
      'Many mothers start to feel a little stronger. A postnatal check between day 7 and day 14 is recommended for you and your baby.',
      'Mama wengi huanza kujihisi wenye nguvu kidogo. Ukaguzi kati ya siku ya 7 na 14 unashauriwa kwako na mtoto.',
    ),
    topics: [
      { heading: b('Bleeding', 'Damu'), text: b('Bleeding is usually lighter now, pinkish, brown or yellowish.', 'Damu kwa kawaida ni kidogo sasa, ya waridi, kahawia au manjano.') },
      { heading: b('Healing', 'Kupona'), text: b('Stitches and wounds should hurt less each day. Pain that is getting worse is not part of normal healing.', 'Mshono na vidonda vinapaswa kuuma kidogo kila siku. Maumivu yanayozidi si sehemu ya kupona kwa kawaida.') },
      { heading: b('Feelings', 'Hisia'), text: b('Baby blues should be easing by now. If you still feel low or anxious most days, tell your CHP or nurse. Help works.', 'Huzuni ya baada ya kujifungua inapaswa kupungua sasa. Ukiendelea kujihisi vibaya siku nyingi, mwambie CHP au muuguzi. Msaada unasaidia.') },
      { heading: b('Energy', 'Nguvu'), text: b('Energy is still low. Eat regular meals, drink water and keep taking the tablets your clinic gave you.', 'Nguvu bado ni kidogo. Kula milo ya kawaida, kunywa maji na endelea kumeza vidonge ulivyopewa kliniki.') },
    ],
    normal: [
      b('Lighter, pinkish-brown or yellowish bleeding', 'Damu kidogo ya waridi-kahawia au manjano'),
      b('Less pain from stitches or the wound', 'Maumivu kidogo ya mshono au kidonda'),
      b('Still tired, with broken sleep', 'Bado uchovu, usingizi wa vipande'),
      b('A little urine leaking when you cough or laugh', 'Mkojo kidogo kuvuja ukikohoa au ukicheka'),
    ],
    todayExtra: [b('Pain, bleeding or low mood that is getting worse instead of better', 'Maumivu, damu au huzuni inayozidi badala ya kupungua')],
    sources: [NHS_EARLY, WHO_PNC],
    status: 'draft',
  },
  {
    id: 'weeks_3_4',
    fromDay: 15,
    toDay: 28,
    title: b('Weeks 3 and 4', 'Wiki ya 3 na 4'),
    range: b('Days 15 to 28', 'Siku 15 hadi 28'),
    intro: b(
      'Your body keeps healing on the inside even when you feel better. Keep going to follow-up visits.',
      'Mwili wako unaendelea kupona ndani hata ukijihisi vizuri. Endelea kuhudhuria ziara za ufuatiliaji.',
    ),
    topics: [
      { heading: b('Bleeding', 'Damu'), text: b('Discharge is often yellowish-white now and may stop and start.', 'Uchafu mara nyingi ni wa manjano-nyeupe sasa na unaweza kusimama na kurudi.') },
      { heading: b('Feeding', 'Kunyonyesha'), text: b('Sore or cracked nipples usually mean the latch needs checking. Ask your nurse or CHP to watch a feed.', 'Chuchu zinazouma au kupasuka kwa kawaida humaanisha mtoto anahitaji kushika vizuri. Omba muuguzi au CHP aangalie unaponyonyesha.') },
      { heading: b('Mood', 'Hisia'), text: b('Low mood after birth can start at any time in the first year, not only in the first days. It is common and treatable.', 'Huzuni baada ya kujifungua inaweza kuanza wakati wowote mwaka wa kwanza, si siku za mwanzo tu. Ni kawaida na inatibika.') },
      { heading: b('Family planning', 'Uzazi wa mpango'), text: b('You can get pregnant again from about 3 weeks after birth, even before your period returns and while breastfeeding. Ask your clinic about family planning.', 'Unaweza kupata mimba tena kuanzia karibu wiki 3 baada ya kujifungua, hata kabla ya hedhi kurudi na ukinyonyesha. Uliza kliniki kuhusu uzazi wa mpango.') },
    ],
    normal: [
      b('Yellowish-white discharge that comes and goes', 'Uchafu wa manjano-nyeupe unaokuja na kwenda'),
      b('Tiredness from night feeds', 'Uchovu kutokana na kunyonyesha usiku'),
      b('Breasts feeling softer once feeding settles', 'Matiti kulainika kunyonyesha kukitulia'),
      b('Some days feeling emotional', 'Siku fulani kujihisi na hisia nyingi'),
    ],
    todayExtra: [b('Feeling low, hopeless or very anxious for more than 2 weeks', 'Kujihisi huzuni, kukata tamaa au wasiwasi mwingi kwa zaidi ya wiki 2')],
    sources: [NHS_EARLY, NHS_INFORM],
    status: 'draft',
  },
  {
    id: 'weeks_5_6',
    fromDay: 29,
    toDay: 42,
    title: b('Weeks 5 and 6', 'Wiki ya 5 na 6'),
    range: b('Days 29 to 42', 'Siku 29 hadi 42'),
    intro: b(
      'The six-week check is an important visit for you, not only for your baby. Bring your questions.',
      'Ukaguzi wa wiki sita ni ziara muhimu kwako, si kwa mtoto tu. Leta maswali yako.',
    ),
    topics: [
      { heading: b('Bleeding', 'Damu'), text: b('Bleeding usually stops by 6 to 8 weeks, but it can last longer.', 'Damu kwa kawaida huisha kufikia wiki 6 hadi 8, lakini inaweza kuchukua muda zaidi.') },
      { heading: b('Activity and exercise', 'Shughuli na mazoezi'), text: b('Walking and pelvic floor (squeezing) exercises are good. Ask at your six-week check before heavy work or hard exercise, especially after a caesarean.', 'Kutembea na mazoezi ya kubana misuli ya nyonga ni mazuri. Uliza kwenye ukaguzi wa wiki sita kabla ya kazi nzito au mazoezi makali, hasa baada ya upasuaji.') },
      { heading: b('Sex and intimacy', 'Tendo la ndoa'), text: b('Wait until you feel ready and comfortable. Talk about family planning first, as you can get pregnant before your period returns.', 'Subiri hadi ujisikie tayari na vizuri. Zungumzia uzazi wa mpango kwanza, kwa sababu unaweza kupata mimba kabla ya hedhi kurudi.') },
      { heading: b('Mood check', 'Kipimo cha hisia'), text: b('A short mood check (EPDS) around now helps spot low mood early.', 'Kipimo kifupi cha hisia (EPDS) wakati huu husaidia kugundua huzuni mapema.') },
    ],
    normal: [
      b('Bleeding has stopped or is very light', 'Damu imeisha au ni kidogo sana'),
      b('Feeling stronger, with good and bad days', 'Kujihisi na nguvu zaidi, siku nzuri na mbaya'),
      b('Still adjusting to sleep with a baby', 'Bado kuzoea usingizi ukiwa na mtoto'),
    ],
    todayExtra: [
      b('Feeling low, hopeless or very anxious for more than 2 weeks', 'Kujihisi huzuni, kukata tamaa au wasiwasi mwingi kwa zaidi ya wiki 2'),
      b('Leaking urine or stool that is not getting better (tell them at your six-week check)', 'Mkojo au choo kuvuja bila kupungua (waambie kwenye ukaguzi wa wiki sita)'),
    ],
    caesareanNote: b('After a caesarean, full recovery often takes longer. Avoid heavy lifting until your clinic says it is safe.', 'Baada ya upasuaji, kupona kabisa mara nyingi huchukua muda zaidi. Epuka kubeba vitu vizito hadi kliniki iseme ni salama.'),
    sources: [NHS_EARLY, WHO_PNC],
    status: 'draft',
  },
  {
    id: 'weeks_7_8',
    fromDay: 43,
    toDay: 10_000,
    title: b('Weeks 7 and 8 and beyond', 'Wiki ya 7 na 8 na kuendelea'),
    range: b('From day 43', 'Kuanzia siku ya 43'),
    intro: b(
      'Recovery continues for months, in body and mind. Neema keeps watching your readings and your mood.',
      'Kupona kunaendelea kwa miezi, mwilini na akilini. Neema anaendelea kuangalia vipimo vyako na hisia zako.',
    ),
    topics: [
      { heading: b('Mood', 'Hisia'), text: b('Keep checking in on how you feel. Low mood or anxiety can still begin now and can be treated.', 'Endelea kuangalia unavyojisikia. Huzuni au wasiwasi bado unaweza kuanza sasa na unatibika.') },
      { heading: b('Sleep and energy', 'Usingizi na nguvu'), text: b('Sleep often improves slowly. Ask family to share night and day tasks where possible.', 'Usingizi mara nyingi huimarika taratibu. Omba familia isaidie kazi za usiku na mchana inapowezekana.') },
      { heading: b('Breastfeeding', 'Kunyonyesha'), text: b('Breast milk alone is recommended for the first 6 months. If you return to work, you can express milk; ask your employer about a lactation room and breaks.', 'Maziwa ya mama pekee yanashauriwa miezi 6 ya kwanza. Ukirudi kazini, unaweza kukamua maziwa; uliza mwajiri kuhusu chumba cha kunyonyeshea na mapumziko.') },
      { heading: b('Longer-term follow-up', 'Ufuatiliaji wa muda mrefu'), text: b('If you had high blood pressure in pregnancy, keep the BP checks your clinic asks for, even if you feel well.', 'Kama ulikuwa na shinikizo la juu wakati wa mimba, endelea kupima shinikizo kama kliniki ilivyoagiza, hata ukijihisi vizuri.') },
    ],
    normal: [
      b('Periods returning (sooner if you are not breastfeeding)', 'Hedhi kurudi (mapema zaidi kama hunyonyeshi)'),
      b('Energy slowly coming back', 'Nguvu kurudi taratibu'),
      b('Some tired or emotional days', 'Siku fulani za uchovu au hisia nyingi'),
    ],
    todayExtra: [b('Feeling low, hopeless or very anxious for more than 2 weeks', 'Kujihisi huzuni, kukata tamaa au wasiwasi mwingi kwa zaidi ya wiki 2')],
    sources: [NHS_EARLY, NHS_INFORM],
    status: 'draft',
  },
];

/** The stage for a number of days since birth (0 = birth day). */
export function recoveryStageFor(daysSinceBirth: number): RecoveryStage {
  return RECOVERY_STAGES.find((s) => daysSinceBirth >= s.fromDay && daysSinceBirth <= s.toDay) ?? RECOVERY_STAGES[RECOVERY_STAGES.length - 1]!;
}

export function recoveryContentReviewed(): boolean {
  return RECOVERY_STAGES.every((s) => s.status === 'reviewed');
}

/** Newborn guidance for "Your Baby's First Weeks" (secondary, draft). */
export const NEWBORN_TIPS: RecoveryTopic[] = [
  { heading: b('Feeding', 'Kunyonyesha'), text: b('Breastfeed whenever baby shows hunger, day and night, often 8 or more times in 24 hours. Breast milk alone is recommended for 6 months.', 'Nyonyesha kila mtoto anapoonyesha njaa, mchana na usiku, mara nyingi mara 8 au zaidi kwa saa 24. Maziwa ya mama pekee yanashauriwa kwa miezi 6.') },
  { heading: b('Safe sleep', 'Usingizi salama'), text: b('Lay baby on their back to sleep, in a clear space with no pillows or loose blankets, close to you.', 'Mlaze mtoto chali, mahali pasipo na mito au blanketi zilizolegea, karibu nawe.') },
  { heading: b('Warmth and cord', 'Joto na kitovu'), text: b('Keep baby warm, with skin-to-skin when you can. Keep the cord clean and dry.', 'Mweke mtoto kwenye joto, ngozi kwa ngozi unapoweza. Weka kitovu safi na kikavu.') },
];

/** Newborn danger signs (WHO postnatal assessment list): go to a facility now. */
export const NEWBORN_DANGER_SIGNS: Bi[] = [
  b('Not feeding well or not able to suck', 'Hanyonyi vizuri au hawezi kunyonya'),
  b('Fits (convulsions)', 'Degedege'),
  b('Fast breathing, or the chest pulling in when breathing', 'Kupumua haraka, au kifua kuingia ndani anapopumua'),
  b('Not moving, or moving only when touched', 'Hasongi, au husonga tu akiguswa'),
  b('Feels hot (fever) or feels cold', 'Ana joto jingi (homa) au ni baridi'),
  b('Yellow skin in the first day, or yellow palms and soles', 'Ngozi ya manjano siku ya kwanza, au viganja na nyayo za manjano'),
];
