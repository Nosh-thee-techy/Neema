import { useEffect, useState } from 'react';
import { db } from '../storage/db';

/**
 * A night view from what she told Neema and what the band recorded.
 * Hours and a resting heart. No dream stages — the band does not measure those.
 */

interface NightRead {
  nightHr: number | null;
  dayHr: number | null;
  tempC: number | null;
  spark: number[];
}

const EMPTY: NightRead = { nightHr: null, dayHr: null, tempC: null, spark: [] };

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function windows(now: number): { nightFrom: number; nightTo: number; dayFrom: number; dayTo: number } {
  const morning = new Date(now);
  morning.setHours(9, 0, 0, 0);
  const nightTo = now < morning.getTime() ? now : morning.getTime();
  const nightFromDate = new Date(nightTo);
  if (now >= morning.getTime()) nightFromDate.setDate(nightFromDate.getDate() - 1);
  else nightFromDate.setDate(nightFromDate.getDate() - 1);
  nightFromDate.setHours(21, 0, 0, 0);
  const dayEnd = new Date(nightFromDate);
  dayEnd.setHours(17, 0, 0, 0);
  const dayStart = new Date(nightFromDate);
  dayStart.setHours(10, 0, 0, 0);
  return {
    nightFrom: nightFromDate.getTime(),
    nightTo,
    dayFrom: dayStart.getTime(),
    dayTo: dayEnd.getTime(),
  };
}

function insight(sw: boolean, hours: number | null, read: NightRead): string {
  if (hours === null && read.nightHr === null) {
    return sw
      ? 'Bado hakuna usiku uliohifadhiwa. Mwambie Neema ulipumzika kwa muda gani, au vaa bendi ukilala.'
      : 'No night saved yet. Tell Neema how long you rested, or wear the band while you sleep.';
  }
  const parts: string[] = [];
  if (hours !== null) {
    const hoursLine = sw ? `Ulipumzika kama masaa ${hours}.` : `You rested about ${hours} hours.`;
    const short = hours < 5
      ? sw
        ? ' Hii ni usiku mfupi. Kipindi kimoja kirefu cha pumziko kinafaa zaidi ya alama kamili.'
        : ' That is a short night. One longer stretch of rest matters more than a perfect score.'
      : '';
    parts.push(hoursLine + short);
  }
  if (read.nightHr !== null && read.dayHr !== null && read.nightHr + 4 < read.dayHr) {
    parts.push(
      sw
        ? `Ulipolala, mapigo yalikaa karibu ${read.nightHr}, chini ya mchana uliokuwa ${read.dayHr}.`
        : `While you slept your heart sat near ${read.nightHr}, quieter than your day at ${read.dayHr}.`,
    );
  } else if (read.nightHr !== null) {
    parts.push(
      sw
        ? `Ulipolala, mapigo yalikaa karibu ${read.nightHr}.`
        : `While you slept your heart sat near ${read.nightHr}.`,
    );
  } else if (hours !== null) {
    parts.push(
      sw
        ? 'Bendi haikurekodi usiku huu, kwa hiyo masaa ni yale uliyoiambia Neema.'
        : 'The band did not record this night, so the hours are only what you told Neema.',
    );
  }
  if (read.tempC !== null) {
    parts.push(sw ? `Joto la ngozi lilikuwa karibu ${read.tempC.toFixed(1)}°.` : `Skin temperature was about ${read.tempC.toFixed(1)}°.`);
  }
  return parts.join(' ');
}

function sparkPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(4, max - min);
  return values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 8) - 4;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function SleepNight({
  sw,
  hours,
  week,
  onPick,
}: {
  sw: boolean;
  hours: number | null;
  week: Array<{ label: string; hours: number | null }>;
  onPick: (hours: number) => void;
}) {
  const [read, setRead] = useState<NightRead>(EMPTY);

  useEffect(() => {
    const { nightFrom, nightTo, dayFrom, dayTo } = windows(Date.now());
    let cancel = false;
    void Promise.all([
      db.vitalsMinutes.where('tsMs').between(nightFrom, nightTo, true, true).toArray(),
      db.vitalsMinutes.where('tsMs').between(dayFrom, dayTo, true, true).toArray(),
    ])
      .then(([night, day]) => {
        if (cancel) return;
        const nightHr = night.flatMap((row) => (row.validFraction >= 0.4 && row.hrMean !== null ? [row.hrMean] : []));
        const dayHr = day.flatMap((row) => (row.validFraction >= 0.4 && row.hrMean !== null ? [row.hrMean] : []));
        const temps = night.flatMap((row) => (row.validFraction >= 0.4 && row.tempMeanC !== null ? [row.tempMeanC] : []));
        const step = Math.max(1, Math.ceil(nightHr.length / 48));
        const spark = nightHr.filter((_, i) => i % step === 0);
        const nightMed = median(nightHr);
        const dayMed = median(dayHr);
        const tempMed = median(temps);
        setRead({
          nightHr: nightMed === null ? null : Math.round(nightMed),
          dayHr: dayMed === null ? null : Math.round(dayMed),
          tempC: tempMed,
          spark,
        });
      })
      .catch(() => {
        if (!cancel) setRead(EMPTY);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const fill = hours === null ? 0 : Math.max(0, Math.min(1, hours / 8));
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const line = sparkPath(read.spark, 280, 64);
  const filledDays = week.filter((day) => day.hours !== null);
  const showWeek = filledDays.length >= 2;

  return (
    <section className="sleep-night" aria-label={sw ? 'Usiku uliopita' : 'Last night'}>
      <p className="sleep-night__kicker">{sw ? 'Usiku uliopita' : 'Last night'}</p>
      <div className="sleep-night__hero">
        <svg className="sleep-ring" viewBox="0 0 140 140" role="img" aria-label={hours === null ? (sw ? 'Hakuna masaa bado' : 'No hours yet') : sw ? `masaa ${hours}` : `${hours} hours`}>
          <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="10" />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#e7c27a"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circ * fill} ${circ}`}
            transform="rotate(-90 70 70)"
          />
          <text x="70" y="66" textAnchor="middle" fill="#f4efe6" fontSize="28" fontFamily="inherit">
            {hours === null ? '—' : hours}
          </text>
          <text x="70" y="86" textAnchor="middle" fill="#d9d0c3" fontSize="11">
            {sw ? 'masaa' : 'hours'}
          </text>
        </svg>
        <div>
          <p className="sleep-night__label">{sw ? 'Muda wa kulala' : 'Time asleep'}</p>
          <p className="sleep-night__guide">
            {sw ? 'Pete inaonyesha masaa yako kati ya masaa 8 ya pumziko. Si alama ya kliniki, na si hatua za ndoto.' : 'The ring shows your hours against about 8 hours of rest. It is not a clinical score, and it is not dream stages.'}
          </p>
        </div>
      </div>

      <div className="sleep-night__stats">
        <div>
          <span>{sw ? 'Muda' : 'Time asleep'}</span>
          <strong>{hours === null ? '—' : sw ? `masaa ${hours}` : `${hours} h`}</strong>
        </div>
        <div>
          <span>{sw ? 'Moyo ukipumzika' : 'Heart at rest'}</span>
          <strong>{read.nightHr === null ? '—' : `${read.nightHr}`}</strong>
        </div>
        <div>
          <span>{sw ? 'Ngozi' : 'Skin'}</span>
          <strong>{read.tempC === null ? '—' : `${read.tempC.toFixed(1)}°`}</strong>
        </div>
      </div>

      {line ? (
        <svg className="sleep-spark" viewBox="0 0 280 64" role="img" aria-label={sw ? 'Mapigo ya moyo usiku' : 'Heart rate through the night'}>
          <path d={line} fill="none" stroke="#e7c27a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : (
        <p className="sleep-night__quiet">{sw ? 'Hakuna mstari wa moyo usiku huu. Vaa bendi ukilala ili uonekane.' : 'No heart line for this night. Wear the band while you sleep and it will appear.'}</p>
      )}

      <p className="sleep-night__insight">{insight(sw, hours, read)}</p>

      {showWeek ? (
        <div className="sleep-week" style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }} aria-hidden="true">
          {week.map((day, i) => (
            <div key={`${day.label}-${i}`} className="sleep-week__col">
              <span style={{ height: `${Math.max(8, ((day.hours ?? 0) / 8) * 100)}%` }} data-empty={day.hours === null} />
              <small>{day.label}</small>
            </div>
          ))}
        </div>
      ) : null}

      <div className="sleep-night__picks">
        <p>{hours === null ? (sw ? 'Ulilala masaa mangapi?' : 'How long did you rest?') : sw ? 'Muda tofauti' : 'A different length'}</p>
        <div>
          {[4, 6, 8].map((pick) => (
            <button key={pick} type="button" className="sleep-night__pick" onClick={() => onPick(pick)}>
              {sw ? `masaa ${pick}` : `${pick} h`}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
