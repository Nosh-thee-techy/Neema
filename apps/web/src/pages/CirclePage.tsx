/**
 * Anonymous mothers' circle. Cartoon names only. Notes she writes stay on this phone.
 * The three opening notes are from Neema, so the room is not empty, and they are not other people.
 */

import { useState } from 'react';
import { useLocale } from '../hooks/useLocale';
import { addMyPost, loadCircleSelf, loadMyPosts, starterNotes, type CirclePost } from '../services/circle';
import '../styles/circle.css';

function Bird({ n }: { n: number }) {
  const hue = ['#c45c4a', '#d0893a', '#3d7a6a', '#3a5f8a', '#8a4b6a', '#6a5a3a', '#4a6a4a', '#5a4a6a'][n % 8];
  return (
    <svg className="circle-bird" viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#f6ead8" />
      <ellipse cx="24" cy="26" rx="12" ry="10" fill={hue} />
      <circle cx="30" cy="18" r="7" fill={hue} />
      <circle cx="32" cy="17" r="1.3" fill="#2a2118" />
      <path d="M36 18 l7 2 l-7 2 z" fill="#e2b15a" />
    </svg>
  );
}

export function CirclePage() {
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const [self] = useState(() => loadCircleSelf());
  const [mine, setMine] = useState<CirclePost[]>(() => loadMyPosts());
  const [text, setText] = useState('');
  const notes = [...mine, ...starterNotes()];

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMine(addMyPost(trimmed, self));
    setText('');
  }

  return (
    <main className="screen circle">
      <p className="circle__kicker">{tx('Only a cartoon name', 'Jina la katuni pekee')}</p>
      <h1 className="screen-title">{tx("Mothers' circle", 'Duara la mama')}</h1>
      <p className="screen-sub">
        {tx(
          'A place to say how you feel, without your name. Your real name is never shown. Notes you write stay on this phone. The three notes below are from Neema, to start the room. They are not other mothers online.',
          'Mahali pa kusema unavyohisi, bila jina lako. Jina lako halisi halionekani. Unachoandika kinabaki kwenye simu hii. Maelezo matatu hapa chini ni ya Neema, kuanza chumba. Si mama wengine walioko mtandaoni.',
        )}
      </p>

      <section className="circle-me">
        <Bird n={self.avatar} />
        <div>
          <strong>{sw ? self.nameSw : self.nameEn}</strong>
          <span>{tx('This is you, in the circle', 'Huyu ni wewe, kwenye duara')}</span>
        </div>
      </section>

      <ul className="circle-list">
        {notes.map((note) => (
          <li key={note.id} className="circle-note" data-mine={note.mine}>
            <Bird n={note.avatar} />
            <div>
              <strong>{sw ? note.authorSw : note.authorEn}</strong>
              {!note.mine ? <em>{tx('A note from Neema', 'Maelezo kutoka kwa Neema')}</em> : null}
              <p>{note.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <form
        className="circle-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor="circle-text">
          {tx('Your note', 'Maelezo yako')}
        </label>
        <textarea
          id="circle-text"
          rows={3}
          maxLength={500}
          value={text}
          placeholder={tx('How are you feeling? Your name stays hidden.', 'Unajisikiaje? Jina lako linabaki siri.')}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          {tx('Share in the circle', 'Shiriki kwenye duara')}
        </button>
      </form>
    </main>
  );
}
