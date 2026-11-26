/**
 * Today's care checklist — shared by Home (remaining count) and Todo page.
 */

import { useEffect, useMemo, useState } from 'react';
import { useGuardian } from './useGuardian';
import { useLocale, type Lang } from './useLocale';
import { useToday } from './useToday';
import { latestCheckInToday } from '../services/checkIn';
import { latestEpds } from '../services/epdsStore';
import { listChase } from '../services/followUp';
import { EMPTY_BIRTH_PLAN, loadProfile } from '../services/passport';

export type TodayTaskKey =
  | 'chase'
  | 'bp'
  | 'feel'
  | 'checkin'
  | 'epds'
  | 'birth'
  | 'band'
  | 'nurse';

export interface TodayTask {
  key: TodayTaskKey;
  title: string;
  meta: string;
  to: string;
  /** undefined = not a checkable item */
  done?: boolean;
  tone?: 'alert' | 'calm';
  /** Suggested clock for timeline (local). */
  timeLabel: string;
}

function clock(tsMs: number, lang: Lang): string {
  return new Date(tsMs).toLocaleTimeString(lang === 'sw' ? 'sw-KE' : 'en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function slotLabel(hour: number, minute: number, lang: Lang): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return clock(d.getTime(), lang);
}

/** Open care tasks for today + remaining count. */
export function useTodayTasks() {
  const g = useGuardian();
  const { t, lang } = useLocale();
  const level = g.triage?.level ?? 'UNKNOWN';
  const today = useToday(`${level}:${g.recheck.status}`);

  const [openLoops, setOpenLoops] = useState(0);
  const [checkInDone, setCheckInDone] = useState(false);
  const [epdsMeta, setEpdsMeta] = useState<string | null>(null);
  const [birthReady, setBirthReady] = useState<number | null>(null);

  useEffect(() => {
    void listChase().then((open) => setOpenLoops(open.length));
    void latestCheckInToday().then((c) => setCheckInDone(Boolean(c)));
    void latestEpds().then((row) => {
      setEpdsMeta(row ? clock(row.tsMs, lang) : null);
    });
    void loadProfile()
      .then((p) => {
        const plan = { ...EMPTY_BIRTH_PLAN, ...p?.birthPlan };
        const done = [plan.skilledAttendant, plan.bloodDonor, plan.savings, plan.companion, plan.transport].filter(
          Boolean,
        ).length;
        setBirthReady(done);
      })
      .catch(() => setBirthReady(null));
  }, [level, g.activeAlertId, lang]);

  const todayWord = t('today');
  const signal = g.sample?.signalQuality ?? 0;
  let bandMeta = t('band_away');
  if (g.connected && g.bandMode === 'simulator') bandMeta = t('band_practice');
  else if (g.connected && !g.sample) bandMeta = t('waiting_signal');
  else if (g.connected && signal < 50) bandMeta = t('band_weak');
  else if (g.connected) bandMeta = t('band_watching');

  const tasks = useMemo<TodayTask[]>(() => {
    const rows: TodayTask[] = [
      {
        key: 'bp',
        title: t('pressure'),
        meta:
          today.bpToday && today.lastBp
            ? `${todayWord}, ${clock(today.lastBp.tsMs, lang)} · ${today.lastBp.systolic}/${today.lastBp.diastolic}`
            : t('not_yet_today'),
        to: '/bp',
        done: today.bpToday,
        timeLabel: today.lastBp ? clock(today.lastBp.tsMs, lang) : slotLabel(9, 0, lang),
        tone: today.bpToday ? 'calm' : undefined,
      },
      {
        key: 'feel',
        title: t('how_feel'),
        meta:
          today.symptomsToday && today.lastSymptomTsMs !== null
            ? `${todayWord}, ${clock(today.lastSymptomTsMs, lang)}`
            : t('not_yet_today'),
        to: '/symptoms',
        done: today.symptomsToday,
        timeLabel: today.lastSymptomTsMs ? clock(today.lastSymptomTsMs, lang) : slotLabel(11, 0, lang),
      },
      {
        key: 'checkin',
        title: t('checkin_title'),
        meta: checkInDone ? todayWord : t('not_yet_today'),
        to: '/check-in',
        done: checkInDone,
        timeLabel: slotLabel(14, 0, lang),
      },
      {
        key: 'epds',
        title: t('epds_title'),
        meta: epdsMeta
          ? lang === 'sw'
            ? `Mwisho ${epdsMeta}`
            : `Last ${epdsMeta}`
          : t('epds_sub'),
        to: '/epds',
        done: Boolean(epdsMeta),
        timeLabel: epdsMeta ?? slotLabel(16, 0, lang),
      },
      {
        key: 'birth',
        title: t('birth_plan_row'),
        meta:
          birthReady === null
            ? t('not_yet_today')
            : lang === 'sw'
              ? `${birthReady}/5 tayari`
              : `${birthReady}/5 ready`,
        to: '/passport',
        done: birthReady === 5,
        timeLabel: slotLabel(18, 0, lang),
      },
      {
        key: 'band',
        title: t('band'),
        meta: bandMeta,
        to: '/vitals',
        done: g.connected,
        timeLabel: slotLabel(8, 0, lang),
      },
      {
        key: 'nurse',
        title: t('nurse_title'),
        meta: t('nurse_sub'),
        to: '/summary',
        timeLabel: slotLabel(19, 0, lang),
      },
    ];

    if (openLoops > 0) {
      rows.unshift({
        key: 'chase',
        title: t('chase_title'),
        meta: t('chase_open'),
        to: '/chase',
        done: false,
        tone: 'alert',
        timeLabel: slotLabel(7, 30, lang),
      });
    }

    return rows;
  }, [
    t,
    lang,
    todayWord,
    today.bpToday,
    today.lastBp,
    today.symptomsToday,
    today.lastSymptomTsMs,
    checkInDone,
    epdsMeta,
    birthReady,
    bandMeta,
    g.connected,
    openLoops,
  ]);

  const checkable = tasks.filter((task) => typeof task.done === 'boolean');
  const remaining = checkable.filter((task) => !task.done).length;
  const doneCount = checkable.filter((task) => task.done).length;

  return {
    tasks,
    remaining,
    doneCount,
    totalCheckable: checkable.length,
    name: today.name ?? 'Mama',
    openLoops,
  };
}
