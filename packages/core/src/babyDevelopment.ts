/**
 * "Your baby's development": what many babies do in the first months after birth.
 * Written in our own words from CDC "Learn the Signs. Act Early." (2-month milestones)
 * and NHS / health-service newborn guidance. Every baby develops at their own pace:
 * these are guides, not tests. "Talk to the clinic" lists come from CDC act-early signs.
 *
 * STATUS: DRAFT until a nurse / child-health clinician approves it; Swahili needs review.
 */

import type { MessageReviewStatus as ReviewStatus } from './messages/catalog.js';
import type { Bi } from './recoveryTimeline.js';

export interface BabyStage {
  id: string;
  fromDay: number;
  toDay: number;
  title: Bi;
  /** One-line headline for the Today card. */
  headline: Bi;
  /** What many babies do now. */
  doing: Bi[];
  /** How to help / play. */
  tips: Bi[];
  /** Mention to the clinic (not an emergency). */
  askClinic: Bi[];
  sources: Array<{ name: string; url: string }>;
  status: ReviewStatus;
}

const b = (en: string, sw: string): Bi => ({ en, sw });
const CDC = { name: 'CDC: milestones by 2 months', url: 'https://cdc.gov/act-early/milestones/2-months.html' };
const NHS = { name: 'NHS: early days after the birth', url: 'https://www.nhs.uk/pregnancy/labour-and-birth/after-the-birth/early-days/' };

export const BABY_STAGES: BabyStage[] = [
  {
    id: 'week_1',
    fromDay: 0,
    toDay: 7,
    title: b('First week', 'Wiki ya kwanza'),
    headline: b('Your baby is getting used to the world outside the womb.', 'Mtoto wako anazoea dunia nje ya tumbo.'),
    doing: [
      b('Sleeps most of the day and night, waking often to feed', 'Hulala sehemu kubwa ya mchana na usiku, akiamka mara nyingi kunyonya'),
      b('Sees best at close range, about the distance to your face when feeding', 'Huona vizuri karibu, umbali wa uso wako unaponyonyesha'),
      b('Startles at loud sounds and has jerky movements', 'Hushtuka kwa sauti kubwa na husonga kwa mshtuko'),
      b('Many babies lose a little weight in the first days, then start to regain it', 'Watoto wengi hupungua uzito kidogo siku za kwanza, kisha huanza kuongezeka'),
    ],
    tips: [b('Hold baby skin-to-skin and talk softly; your voice and face are what baby knows best', 'Mshike mtoto ngozi kwa ngozi na uongee taratibu; sauti na uso wako ndivyo anavyojua zaidi')],
    askClinic: [b('Not waking to feed, or very few wet nappies', 'Haamki kunyonya, au nepi chache sana zenye mkojo')],
    sources: [NHS],
    status: 'draft',
  },
  {
    id: 'weeks_2_3',
    fromDay: 8,
    toDay: 21,
    title: b('Weeks 2 and 3', 'Wiki ya 2 na 3'),
    headline: b('Many babies are back to their birth weight by about two weeks.', 'Watoto wengi hurudi kwenye uzito wa kuzaliwa karibu wiki mbili.'),
    doing: [
      b('Looks at faces and follows them a little', 'Huangalia nyuso na kuzifuata kidogo'),
      b('Calms when picked up or spoken to', 'Hutulia akibebwa au akiongeleshwa'),
      b('Feeds often; growth spurts can make some days extra hungry', 'Hunyonya mara nyingi; siku nyingine ana njaa zaidi akikua haraka'),
    ],
    tips: [b('Short tummy time while awake and watched helps neck strength', 'Muda mfupi akiwa amelala tumbo, akiwa macho na unamwangalia, huimarisha shingo')],
    askClinic: [b('Not regaining weight, or feeding seems hard', 'Haongezeki uzito, au kunyonya kunaonekana kugumu')],
    sources: [NHS, CDC],
    status: 'draft',
  },
  {
    id: 'weeks_4_6',
    fromDay: 22,
    toDay: 42,
    title: b('Weeks 4 to 6', 'Wiki ya 4 hadi 6'),
    headline: b('Watch for a first real smile, often around 5 to 7 weeks.', 'Tarajia tabasamu la kwanza, mara nyingi karibu wiki 5 hadi 7.'),
    doing: [
      b('Starts to smile back at you', 'Huanza kukutabasamu'),
      b('Makes sounds other than crying', 'Hutoa sauti nyingine zaidi ya kulia'),
      b('Turns towards voices and sounds', 'Hugeuka kuelekea sauti'),
    ],
    tips: [b('Smile, sing and talk to your baby; take turns when baby makes sounds', 'Tabasamu, imba na mwongeleshe mtoto; jibu anapotoa sauti')],
    askClinic: [b('Does not react to loud sounds', 'Hashtuki kwa sauti kubwa')],
    sources: [CDC],
    status: 'draft',
  },
  {
    id: 'months_2_3',
    fromDay: 43,
    toDay: 120,
    title: b('About 2 months', 'Karibu miezi 2'),
    headline: b('Your baby is becoming more social and stronger.', 'Mtoto wako anakuwa mchangamfu zaidi na mwenye nguvu.'),
    doing: [
      b('Smiles when you talk to or smile at them', 'Hutabasamu ukimwongelesha au ukimtabasamu'),
      b('Holds head up while on their tummy', 'Huinua kichwa akiwa amelala tumbo'),
      b('Watches you as you move; looks at a toy for a few seconds', 'Hukuangalia ukisonga; huangalia mwanasesere kwa sekunde chache'),
      b('Coos and makes gurgling sounds', 'Hutoa sauti za kuguna na kufurahia'),
    ],
    tips: [b('Keep up tummy time and talking; the 6-, 10- and 14-week vaccine visits are good times to ask questions', 'Endelea na muda wa kulala tumbo na kuongea; ziara za chanjo za wiki 6, 10 na 14 ni nafasi nzuri ya kuuliza')],
    askClinic: [
      b('Does not smile at people', 'Hatabasamu kwa watu'),
      b('Does not watch things as they move', 'Haangalii vitu vinavyosonga'),
      b('Cannot hold head up when pushing up on the tummy', 'Hawezi kuinua kichwa akiwa amelala tumbo'),
      b('Does not bring hands to mouth', 'Haleti mikono mdomoni'),
    ],
    sources: [CDC],
    status: 'draft',
  },
];

export function babyStageFor(ageDays: number): BabyStage {
  return BABY_STAGES.find((s) => ageDays >= s.fromDay && ageDays <= s.toDay) ?? BABY_STAGES[BABY_STAGES.length - 1]!;
}

export function babyContentReviewed(): boolean {
  return BABY_STAGES.every((s) => s.status === 'reviewed');
}
