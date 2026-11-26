import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isPlaceholderPhone, normalizePhone, type Contact } from '@neema/core';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { deleteContact, listContacts, saveContact } from '../services/contacts';
import { firstRecipients } from '../services/alerts';
import { LoadingScreen } from '../ui/LoadingScreen';
import { IconPlus } from '../ui/icons';
import { useLocale } from '../hooks/useLocale';

const ROLE_LABEL: Record<Contact['role'], { en: string; sw: string }> = {
  chp: { en: 'CHP', sw: 'CHP' },
  family: { en: 'Family', sw: 'Familia' },
  supervisor: { en: 'CHP supervisor', sw: 'Msimamizi' },
};

type Filter = 'all' | Contact['role'];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/**
 * The people Neema texts when something is wrong: CHP first, then family, then the supervisor.
 * With ?setup=1 it is the setup step after the PIN, asking for the CHP and a family number.
 */
export function ContactsPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const setup = params.get('setup') === '1';
  const { lang } = useLocale();
  const sw = lang === 'sw';

  const [items, setItems] = useState<Contact[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(setup);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Contact['role']>('chp');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const placeholders = items.filter((c) => isPlaceholderPhone(c.phone));
  const usable = items.filter((c) => !isPlaceholderPhone(c.phone));
  const hasRealChp = usable.some((c) => c.role === 'chp');
  const hasRealFamily = usable.some((c) => c.role === 'family');
  // The people who get the first SMS on RED, highlighted in the list.
  const firstIds = useMemo(() => new Set(firstRecipients('RED', usable).map((c) => c.id)), [usable]);
  const firstId = firstRecipients('RED', usable)[0]?.id;
  const shown = items.filter((c) => filter === 'all' || c.role === filter);
  const count = (r: Contact['role']) => items.filter((c) => c.role === r).length;

  async function refresh() {
    const list = await listContacts();
    setItems(list);
    setBusy(false);
    const realChp = list.some((c) => c.role === 'chp' && !isPlaceholderPhone(c.phone));
    setRole(realChp ? 'family' : 'chp');
    if (list.length === 0) setAdding(true);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function add() {
    setError(null);
    if (!name.trim()) {
      setError(sw ? 'Andika jina.' : 'Enter a name.');
      return;
    }
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError(sw ? 'Namba si sahihi. Mfano: 0712 345 678' : 'That number is not valid. Example: 0712 345 678');
      return;
    }
    if (isPlaceholderPhone(normalized)) {
      setError(sw ? 'Hii inaonekana namba ya mfano. Weka namba halisi.' : 'That looks like a sample number. Enter a real one.');
      return;
    }
    if (items.some((c) => c.phone === normalized)) {
      setError(sw ? 'Namba hii tayari imehifadhiwa.' : 'That number is already saved.');
      return;
    }
    setBusy(true);
    await saveContact({
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: normalized,
      role,
      escalationOrder: Math.max(0, ...items.map((c) => c.escalationOrder)) + 1,
    });
    setName('');
    setPhone('');
    await refresh();
  }

  async function remove(ids: string[]) {
    setBusy(true);
    for (const id of ids) await deleteContact(id);
    // Keep escalation order contiguous: 1, 2, 3…
    const rest = (await listContacts()).sort((a, b) => a.escalationOrder - b.escalationOrder);
    for (const [i, c] of rest.entries()) {
      if (c.escalationOrder !== i + 1) await saveContact({ ...c, escalationOrder: i + 1 });
    }
    await refresh();
  }

  return (
    <main className="screen">
      {busy ? <LoadingScreen /> : null}
      <BrandMark />

      <div className="page-head">
        <h1 className="screen-title">
          {setup ? (sw ? 'Neema imtumie nani SMS?' : 'Who should Neema text?') : sw ? 'Watu wako' : 'Your people'}
        </h1>
        {!adding ? (
          <Button variant="primary" className="btn-add" onClick={() => setAdding(true)}>
            <IconPlus />
            {sw ? 'Ongeza' : 'Add'}
          </Button>
        ) : null}
      </div>
      <p className="screen-sub" style={{ marginTop: '0.5rem' }}>
        {sw
          ? 'Hali ikiwa mbaya, Neema inaandaa SMS kwa CHP wako kwanza, kisha familia, kisha msimamizi wa CHP.'
          : 'When something is wrong, Neema prepares an SMS for your CHP first, then family, then the CHP supervisor.'}
      </p>

      <div className="summary-row">
        <div className="summary-tile">
          <b>{items.length}</b>
          <span>{sw ? 'Watu' : 'People'}</span>
        </div>
        <div className="summary-tile" data-tone={hasRealChp ? 'ok' : 'warn'}>
          <b>{usable.length}</b>
          <span>{sw ? 'Tayari' : 'Ready'}</span>
        </div>
        <div className="summary-tile" data-tone={placeholders.length ? 'warn' : undefined}>
          <b>{placeholders.length}</b>
          <span>{sw ? 'Za mfano' : 'Sample'}</span>
        </div>
      </div>

      {placeholders.length > 0 ? (
        <div className="panel contact-warning" role="alert" style={{ marginBottom: '1rem' }}>
          <strong>{sw ? 'Namba za mfano' : 'Sample numbers'}</strong>
          <p className="soft-note" style={{ margin: '0.35rem 0 0.65rem' }}>
            {sw
              ? 'Namba hizi si halisi, kwa hiyo Neema haitazitumia. Ziondoe na uweke namba halisi.'
              : 'These numbers are not real, so Neema will not use them. Remove them and add real ones.'}
          </p>
          <Button variant="secondary" onClick={() => void remove(placeholders.map((c) => c.id))}>
            {sw ? 'Ondoa namba za mfano' : 'Remove sample numbers'}
          </Button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="filter-row" role="group" aria-label={sw ? 'Chuja' : 'Filter'}>
          {(['all', 'chp', 'family', 'supervisor'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? (sw ? 'Wote' : 'All') : ROLE_LABEL[f][lang]}
              <small>{f === 'all' ? items.length : count(f)}</small>
            </button>
          ))}
        </div>
      ) : null}

      <div className="people" data-testid="contact-list">
        <div className="people__head" aria-hidden>
          <span />
          <span>{sw ? 'Jina' : 'Name'}</span>
          <span>{sw ? 'Jukumu' : 'Role'}</span>
          <span>{sw ? 'Simu' : 'Phone'}</span>
          <span>{sw ? 'Hali' : 'Status'}</span>
          <span />
        </div>
        {shown.length === 0 ? (
          <p className="people__empty">{items.length === 0 ? (sw ? 'Bado hakuna mtu.' : 'No one yet.') : sw ? 'Hakuna katika kundi hili.' : 'No one in this group.'}</p>
        ) : null}
        {shown.map((c) => {
          const fake = isPlaceholderPhone(c.phone);
          const first = c.id === firstId;
          return (
            <div key={c.id} className="people__row" data-role={c.role} data-first={first}>
              <span className="people__avatar" aria-hidden>
                {initials(c.name)}
              </span>
              <span className="people__name">
                {c.name}
                <small>
                  #{c.escalationOrder}
                  {first ? (sw ? ' · anapokea kwanza' : ' · alerted first') : firstIds.has(c.id) ? (sw ? ' · SMS ya kwanza' : ' · first SMS') : ''}
                </small>
              </span>
              <span className="people__meta">
                <span className="tag" data-tone="role">
                  {ROLE_LABEL[c.role][lang]}
                </span>
                <span className="people__phone">{c.phone}</span>
                <span className="tag" data-tone={fake ? 'bad' : 'ok'}>
                  {fake ? (sw ? 'Si halisi' : 'Not real') : sw ? 'Tayari' : 'Ready'}
                </span>
              </span>
              <span className="people__action">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={sw ? `Ondoa ${c.name}` : `Remove ${c.name}`}
                  onClick={() => void remove([c.id])}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    <path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3" />
                  </svg>
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="panel add-panel">
          <strong>
            {role === 'chp' && !hasRealChp ? (sw ? 'Ongeza CHP wako' : 'Add your CHP') : sw ? 'Ongeza mtu' : 'Add someone'}
          </strong>
          <div className="field" style={{ marginTop: '0.6rem' }}>
            <label htmlFor="cname">{sw ? 'Jina' : 'Name'}</label>
            <input id="cname" value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cphone">{sw ? 'Namba ya simu' : 'Phone number'}</label>
            <input
              id="cphone"
              type="tel"
              inputMode="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <span className="field__label" id="crole-label">
              {sw ? 'Ni nani kwako' : 'Who they are'}
            </span>
            <div className="add-panel__roles" role="group" aria-labelledby="crole-label">
              {(['chp', 'family', 'supervisor'] as const).map((r) => (
                <button key={r} type="button" data-role={r} aria-pressed={role === r} onClick={() => setRole(r)}>
                  {ROLE_LABEL[r][lang]}
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="btn-row" style={{ marginTop: '0.5rem' }}>
            {items.length > 0 && !setup ? (
              <Button variant="secondary" onClick={() => setAdding(false)}>
                {sw ? 'Funga' : 'Close'}
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => void add()}>
              {sw ? 'Hifadhi' : 'Save'}
            </Button>
          </div>
        </div>
      ) : null}

      {setup ? (
        <div style={{ marginTop: '1rem' }}>
          {!hasRealFamily && hasRealChp ? (
            <p className="soft-note" style={{ textAlign: 'center' }}>
              {sw
                ? 'Ongeza mtu wa familia pia: mara nyingi wao ndio huamua usiku.'
                : 'Add a family member too: they often decide at night.'}
            </p>
          ) : null}
          <Button
            variant="primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={!hasRealChp}
            onClick={() => nav('/home')}
          >
            {sw ? 'Endelea' : 'Continue'}
          </Button>
          <Button variant="ghost" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => nav('/home')}>
            {sw ? 'Baadaye' : 'Later'}
          </Button>
        </div>
      ) : null}
    </main>
  );
}
