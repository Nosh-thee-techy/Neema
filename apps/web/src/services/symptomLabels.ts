import type { SymptomCode } from '@neema/core';

/** Plain labels for every symptom code (History list, check-in summary). */
export const SYMPTOM_LABELS: Record<SymptomCode, { en: string; sw: string }> = {
  headache: { en: 'Headache', sw: 'Kichwa kuuma' },
  blurred_vision: { en: 'Blurred vision', sw: 'Kuona ukungu' },
  upper_abdominal_pain: { en: 'Upper belly pain', sw: 'Maumivu juu ya tumbo' },
  heavy_bleeding: { en: 'Heavy bleeding', sw: 'Kutokwa damu nyingi' },
  fever_chills: { en: 'Fever / chills', sw: 'Homa / baridi' },
  baby_moving_less: { en: 'Baby moving less', sw: 'Mtoto anasonga kidogo' },
  swelling_face_hands: { en: 'Swelling face/hands', sw: 'Uvimbe uso/mikono' },
  low_mood: { en: 'Low mood', sw: 'Huzuni' },
  dizzy_faint: { en: 'Fainting / very dizzy', sw: 'Kuzirai / kizunguzungu kikali' },
  chest_pain_breathless: { en: 'Chest pain / hard to breathe', sw: 'Maumivu ya kifua / shida kupumua' },
  fits: { en: 'Fits', sw: 'Degedege' },
  severe_abdominal_pain: { en: 'Severe tummy pain', sw: 'Maumivu makali ya tumbo' },
  thoughts_of_harm: { en: 'Thoughts of harm', sw: 'Mawazo ya kudhuru' },
  foul_discharge: { en: 'Bad-smelling discharge', sw: 'Uchafu wenye harufu mbaya' },
  wound_problem: { en: 'Wound or stitches problem', sw: 'Tatizo la kidonda au mshono' },
  leg_pain_swelling: { en: 'Painful, swollen leg', sw: 'Mguu unaouma na kuvimba' },
  breast_red_painful: { en: 'Red, painful breast', sw: 'Titi jekundu linalouma' },
  urine_problem: { en: 'Problem passing urine', sw: 'Tatizo la kukojoa' },
  bleeding_heavier: { en: 'Bleeding heavier again', sw: 'Damu kuongezeka tena' },
  other: { en: 'Other', sw: 'Nyingine' },
};
