import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import { useGuardian } from '../hooks/useGuardian';
import { IconChat, IconHome, IconList, IconMoon, IconUser } from './icons';

function Item({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
      <span className="nav-ico">{icon}</span>
      {label}
    </NavLink>
  );
}

/**
 * Main navigation, no floating buttons. During pregnancy: four tabs. After birth:
 * Home becomes "Recovery" and a "Sleep & mood" tab is added.
 */
export function BottomNav() {
  const { lang } = useLocale();
  const { stage, demoStep } = useGuardian();
  const sw = lang === 'sw';
  const after = stage === 'postpartum' && !demoStep;
  return (
    <nav className={after ? 'bottom-nav bottom-nav--5' : 'bottom-nav bottom-nav--4'} aria-label={sw ? 'Menyu kuu' : 'Main'}>
      <Item to="/home" label={after ? (sw ? 'Kupona' : 'Recovery') : sw ? 'Nyumbani' : 'Home'} icon={<IconHome />} />
      {after ? <Item to="/wellbeing" label={sw ? 'Usingizi' : 'Sleep & mood'} icon={<IconMoon />} /> : null}
      <Item to="/care" label={sw ? 'Ongea' : 'CareChat'} icon={<IconChat />} />
      <Item to="/history" label={sw ? 'Historia' : 'History'} icon={<IconList />} />
      <Item to="/profile" label={sw ? 'Wasifu' : 'Profile'} icon={<IconUser />} />
    </nav>
  );
}
