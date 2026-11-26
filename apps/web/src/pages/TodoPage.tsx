/**
 * Today's care list — dedicated timeline page matching the Today task UI.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import { useTodayTasks } from '../hooks/useTodayTasks';
import { IconCheck } from '../ui/icons';

function weekDays(lang: 'en' | 'sw', selected: Date) {
  const start = new Date(selected);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 3);
  const fmtDay = new Intl.DateTimeFormat(lang === 'sw' ? 'sw-KE' : 'en-KE', { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      key: d.toISOString().slice(0, 10),
      dayNum: d.getDate(),
      weekday: fmtDay.format(d).replace(/\.$/, ''),
      selected: d.toDateString() === selected.toDateString(),
    };
  });
}

/** Timeline checklist for today's maternal care actions. */
export function TodoPage() {
  const nav = useNavigate();
  const { t, lang } = useLocale();
  const { tasks, remaining, name } = useTodayTasks();
  const [anchor] = useState(() => new Date());
  const days = useMemo(() => weekDays(lang, anchor), [lang, anchor]);

  const dateLine = anchor.toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const open = tasks.filter((task) => task.done !== true);
  const done = tasks.filter((task) => task.done === true);
  const timeline = [...open, ...done];

  return (
    <main className="screen screen--wide todo-page">
      <div className="todo-page__head">
        <div>
          <p className="todo-page__date">{dateLine}</p>
          <h1 className="todo-page__title">{t('today')}</h1>
        </div>
        <button
          type="button"
          className="todo-page__avatar"
          aria-label={t('your_passport')}
          onClick={() => nav('/passport')}
        >
          {name.charAt(0).toUpperCase()}
        </button>
      </div>

      <div className="todo-week" role="listbox" aria-label={t('today')}>
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            className="todo-week__day"
            role="option"
            aria-selected={day.selected}
            data-selected={day.selected}
            disabled={!day.selected}
          >
            <span className="todo-week__num">{day.dayNum}</span>
            <span className="todo-week__label">{day.weekday}</span>
            {day.selected ? <span className="todo-week__dot" aria-hidden /> : null}
          </button>
        ))}
      </div>

      <p className="todo-page__sub">
        {remaining === 0
          ? t('todo_all_done')
          : lang === 'sw'
            ? `${remaining} bado leo`
            : `${remaining} left today`}
      </p>

      <ol className="todo-timeline">
        {timeline.map((task) => {
          const isDone = task.done === true;
          return (
            <li
              key={task.key}
              className="todo-timeline__item"
              data-active={!isDone}
              data-done={isDone}
              data-tone={task.tone}
            >
              <div className="todo-timeline__rail" aria-hidden>
                <span className="todo-timeline__node" data-filled="true" />
              </div>

              {!isDone ? (
                <button type="button" className="todo-card todo-card--active" onClick={() => nav(task.to)}>
                  <div className="todo-card__wave" aria-hidden />
                  <div className="todo-card__top">
                    <div>
                      <strong className="todo-card__title">{task.title}</strong>
                      <p className="todo-card__meta">{task.meta}</p>
                    </div>
                    <time className="todo-card__time">{task.timeLabel}</time>
                  </div>
                  <div className="todo-card__foot">
                    <span className="todo-card__faces" aria-hidden>
                      <img src="/brand/neema-companion.jpg" alt="" width={28} height={28} />
                      <span>{name.charAt(0).toUpperCase()}</span>
                      <span>C</span>
                    </span>
                    <span className="todo-card__check" aria-hidden>
                      <IconCheck />
                    </span>
                  </div>
                </button>
              ) : (
                <button type="button" className="todo-row todo-row--done" onClick={() => nav(task.to)}>
                  <span className="todo-row__body">
                    <strong>{task.title}</strong>
                    <span>{task.meta}</span>
                  </span>
                  <span className="todo-row__tick" aria-label={lang === 'sw' ? 'Imekamilika' : 'Done'}>
                    <IconCheck />
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
