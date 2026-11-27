import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import { useGuardian } from '../hooks/useGuardian';
import { IconChat, IconHome, IconList, IconMoon, IconSpark } from './icons';

function Item({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
      <span className="nav-ico">{icon}</span>
      {label}
    </NavLink>
  );
}

/**
 * Main navigation: Today, Insights, CareChat, History (+ Sleep & mood after birth).
 * Settings and the profile open from the avatar on Today.
 */
export function BottomNav() {
  const { lang } = useLocale();
  const { stage, demoStep } = useGuardian();
  const sw = lang === 'sw';
  const after = stage === 'postpartum' && !demoStep;
  return (
    <nav className={after ? 'bottom-nav bottom-nav--5' : 'bottom-nav bottom-nav--4'} aria-label={sw ? 'Menyu kuu' : 'Main'}>
      <Item to="/home" label={sw ? 'Leo' : 'Today'} icon={<IconHome />} />
      <Item to="/insights" label={sw ? 'Maelezo' : 'Insights'} icon={<IconSpark />} />
      <Item to="/care" label={sw ? 'Ongea' : 'CareChat'} icon={<IconChat />} />
      <Item to="/history" label={sw ? 'Historia' : 'History'} icon={<IconList />} />
      {after ? <Item to="/wellbeing" label={sw ? 'Usingizi' : 'Sleep & mood'} icon={<IconMoon />} /> : null}
    </nav>
  );
}
