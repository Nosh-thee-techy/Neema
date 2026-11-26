import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isPlaceholderPhone, normalizePhone, type Contact } from '@neema/core';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { deleteContact, listContacts, saveContact } from '../services/contacts';
import { LoadingScreen } from '../ui/LoadingScreen';
import { useLocale } from '../hooks/useLocale';

const ROLE_LABEL: Record<Contact['role'], { en: string; sw: string }> = {
  chp: { en: 'CHP', sw: 'CHP' },
  family: { en: 'Family', sw: 'Familia' },
  supervisor: { en: 'CHP supervisor', sw: 'Msimamizi wa CHP' },
};

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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Contact['role']>('chp');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const placeholders = items.filter((c) => isPlaceholderPhone(c.phone));
  const hasRealChp = items.some((c) => c.role === 'chp' && !isPlaceholderPhone(c.phone));
  const hasRealFamily = items.some((c) => c.role === 'family' && !isPlaceholderPhone(c.phone));

  async function refresh() {
    const list = await listContacts();
    setItems(list);
    setBusy(false);
    // Suggest the next missing role.
    const realChp = list.some((c) => c.role === 'chp' && !isPlaceholderPhone(c.phone));
    setRole(realChp ? 'family' : 'chp');
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
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {setup ? (sw ? 'Neema imtumie nani SMS?' : 'Who should Neema text?') : sw ? 'Watu wako' : 'Your people'}
      </h1>
      <p className="screen-sub">
        {sw
          ? 'Hali ikiwa mbaya, Neema inaandaa SMS kwa CHP wako kwanza, kisha familia, kisha msimamizi wa CHP.'
          : 'When something is wrong, Neema prepares an SMS for your CHP first, then family, then the CHP supervisor.'}
      </p>

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

      <div className="panel" style={{ marginBottom: '1rem' }} data-testid="contact-list">
        {items.length === 0 ? <p className="soft-note">{sw ? 'Bado hakuna mtu.' : 'No one yet.'}</p> : null}
        {items.map((c) => (
          <div key={c.id} className="row-divided" style={{ justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <strong>
                {c.escalationOrder}. {c.name}
              </strong>
              <div className="soft-note">
                {ROLE_LABEL[c.role][lang]} · {c.phone}
                {isPlaceholderPhone(c.phone) ? (sw ? ' · si halisi' : ' · not real') : ''}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ minHeight: 40, padding: '0.4rem 0.8rem' }}
              aria-label={sw ? `Ondoa ${c.name}` : `Remove ${c.name}`}
              onClick={() => void remove([c.id])}
            >
              {sw ? 'Ondoa' : 'Remove'}
            </button>
          </div>
        ))}
      </div>

      <div className="panel">
        <strong>
          {role === 'chp' && !hasRealChp
            ? sw
              ? 'Ongeza CHP wako'
              : 'Add your CHP'
            : sw
              ? 'Ongeza mtu'
              : 'Add someone'}
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
          <label htmlFor="crole">{sw ? 'Ni nani kwako' : 'Who they are'}</label>
          <select id="crole" value={role} onChange={(e) => setRole(e.target.value as Contact['role'])}>
            <option value="chp">{ROLE_LABEL.chp[lang]}</option>
            <option value="family">{ROLE_LABEL.family[lang]}</option>
            <option value="supervisor">{ROLE_LABEL.supervisor[lang]}</option>
          </select>
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button variant="primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => void add()}>
          {sw ? 'Hifadhi' : 'Save'}
        </Button>
      </div>

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
