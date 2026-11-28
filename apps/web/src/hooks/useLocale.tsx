/**
 * First-class EN / SW copy for mother-facing UI.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'en' | 'sw';

const KEY = 'neema.lang.v1';

type Dict = Record<string, { en: string; sw: string }>;

const COPY: Dict = {
  brand_sub: {
    en: 'With you through the night',
    sw: 'Pamoja nawe usiku',
  },
  youre_okay: {
    en: 'You’re okay',
    sw: 'Uko salama',
  },
  check_bp: {
    en: 'Check your blood pressure',
    sw: 'Pima shinikizo la damu',
  },
  call_chp: {
    en: 'Call your CHP',
    sw: 'Piga simu CHP yako',
  },
  open_sms: {
    en: 'Open message to CHP',
    sw: 'Fungua ujumbe kwa CHP',
  },
  waiting_signal: {
    en: 'Waiting for your band…',
    sw: 'Inasubiri bendi yako…',
  },
  all_quiet: {
    en: 'All quiet. Rest when you can.',
    sw: 'Tulivu. Pumzika unapoweza.',
  },
  start_watch: {
    en: 'Try a practice band',
    sw: 'Jaribu bendi ya mazoezi',
  },
  connect_band: {
    en: 'Connect your band',
    sw: 'Unganisha bendi',
  },
  band_watching: {
    en: 'Band is watching with you',
    sw: 'Bendi inakulinda',
  },
  band_away: {
    en: 'Band not connected',
    sw: 'Bendi haijaunganishwa',
  },
  band_weak: {
    en: 'Band signal is weak',
    sw: 'Ishara ya bendi ni dhaifu',
  },
  saved_here: {
    en: 'Saved on this phone — works offline',
    sw: 'Imehifadhiwa kwenye simu — inafanya bila mtandao',
  },
  how_feel: {
    en: 'How do you feel?',
    sw: 'Unajisikiaje?',
  },
  add_bp: {
    en: 'Add blood pressure',
    sw: 'Ongeza shinikizo',
  },
  recheck_now: {
    en: 'Recheck blood pressure now',
    sw: 'Pima tena shinikizo sasa',
  },
  sit_rest: {
    en: 'Sit, rest a minute, then measure again.',
    sw: 'Kaa, pumzika dakika, kisha pima tena.',
  },
  nurse_why: {
    en: 'Show this at the clinic so the nurse sees your recent story in one glance.',
    sw: 'Onyesha kliniki ili muuguzi aone hadithi yako kwa haraka.',
  },
  more: { en: 'More', sw: 'Zaidi' },
  home: { en: 'Home', sw: 'Nyumbani' },
  signs: { en: 'Signs', sw: 'Dalili' },
  passport: { en: 'Passport', sw: 'Pasipoti' },
  language: { en: 'Language', sw: 'Lugha' },
  try_again: { en: 'Try again', sw: 'Jaribu tena' },
  go_home: { en: 'Go home', sw: 'Rudi nyumbani' },
  loading: { en: 'One moment…', sw: 'Subiri kidogo…' },
  something_wrong: {
    en: 'Something went wrong',
    sw: 'Kuna tatizo',
  },
  breathe: {
    en: 'Breathe slowly. Help is one step away.',
    sw: 'Pumua polepole. Msaada uko karibu.',
  },
  wait_reply: {
    en: 'After you send, stay near your phone and wait for a reply.',
    sw: 'Baada ya kutuma, kaa karibu na simu na subiri jibu.',
  },
  greet_morning: { en: 'Good morning', sw: 'Habari za asubuhi' },
  greet_afternoon: { en: 'Good afternoon', sw: 'Habari za mchana' },
  greet_evening: { en: 'Good evening', sw: 'Habari za jioni' },
  greet_night: { en: 'Hello', sw: 'Habari' },
  greet_sub: {
    en: 'Neema is here with you, day and night.',
    sw: 'Neema yuko nawe, mchana na usiku.',
  },
  today: { en: 'Today', sw: 'Leo' },
  heart: { en: 'Heart rate', sw: 'Mapigo ya moyo' },
  pressure: { en: 'Blood pressure', sw: 'Shinikizo' },
  temp: { en: 'Skin temp', sw: 'Joto la ngozi' },
  band: { en: 'Band', sw: 'Bendi' },
  add: { en: 'Add', sw: 'Ongeza' },
  add_title: { en: 'What would you like to add?', sw: 'Ungependa kuongeza nini?' },
  add_bp_sub: { en: 'From your arm cuff', sw: 'Kutoka kwa kipimo cha mkono' },
  feel_sub: { en: 'Tap what fits right now', sw: 'Gusa yanayokufaa sasa' },
  nurse_title: { en: 'For the nurse', sw: 'Kwa muuguzi' },
  nurse_sub: { en: 'Show this code at the clinic', sw: 'Onyesha msimbo huu kliniki' },
  not_yet_today: { en: 'Not yet today', sw: 'Bado leo' },
  band_practice: {
    en: 'Practice mode (no real band yet)',
    sw: 'Hali ya mazoezi (bendi halisi bado)',
  },
  alerts: { en: 'Open your alert', sw: 'Fungua tahadhari yako' },
  your_passport: { en: 'Open your passport', sw: 'Fungua pasipoti yako' },
  nothing_now: {
    en: 'Nothing needs your attention right now.',
    sw: 'Hakuna kinachohitaji hatua sasa.',
  },
  close: { en: 'Close', sw: 'Funga' },
  dismiss: { en: 'Not now', sw: 'Si sasa' },
  next: { en: 'Next', sw: 'Endelea' },
  continue: { en: 'Continue', sw: 'Endelea' },
  skip: { en: 'Skip', sw: 'Ruka' },
  checkin_title: { en: 'Daily check-in', sw: 'Angalia leo' },
  checkin_sub: {
    en: 'Energy and mood — context only',
    sw: 'Nguvu na hali — muktadha tu',
  },
  chase_title: { en: 'Chase list', sw: 'Orodha ya ufuatiliaji' },
  chase_open: {
    en: 'Open care loops need a person to confirm arrival',
    sw: 'Vitanzi vilivyo wazi vinahitaji mtu athibitishe kuwasili',
  },
  chase_cta: { en: 'Open chase list', sw: 'Fungua ufuatiliaji' },
  epds_title: { en: 'Mood screen (EPDS)', sw: 'Ukaguzi wa hali (EPDS)' },
  epds_sub: {
    en: 'Private on this phone — never a triage colour',
    sw: 'Faragha kwenye simu — si rangi ya tahadhari',
  },
  birth_plan_row: { en: 'Birth preparedness', sw: 'Maandalizi ya kuzaliwa' },
  todo_nav: { en: 'Today', sw: 'Leo' },
  todo_all_done: { en: 'Everything for today is done', sw: 'Mambo yote ya leo yamekamilika' },
  todo_nudge_title: { en: 'Your care list', sw: 'Orodha yako ya leo' },
  todo_nudge_open: { en: 'Open today’s list', sw: 'Fungua orodha ya leo' },
  todo_left: { en: 'left to do', sw: 'bado kufanywa' },
  talk_nav: { en: 'Talk', sw: 'Ongea' },
};

interface LocaleState {
  lang: Lang;
  t: (key: keyof typeof COPY) => string;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LocaleContext = createContext<LocaleState | null>(null);

function loadLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'sw' || v === 'en' ? v : 'en';
  } catch {
    return 'en';
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(KEY, next);
  }, []);

  const value = useMemo<LocaleState>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === 'en' ? 'sw' : 'en'),
      t: (key) => COPY[key]?.[lang] ?? String(key),
    }),
    [lang, setLang],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
