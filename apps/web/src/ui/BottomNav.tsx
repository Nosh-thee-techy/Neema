import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import { IconChat, IconHome, IconList, IconUser } from './icons';

function Item({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
      <span className="nav-ico">{icon}</span>
      {label}
    </NavLink>
  );
}

/** Main navigation: four tabs, no floating buttons. */
export function BottomNav() {
  const { lang } = useLocale();
  const sw = lang === 'sw';
  return (
    <nav className="bottom-nav bottom-nav--4" aria-label={sw ? 'Menyu kuu' : 'Main'}>
      <Item to="/home" label={sw ? 'Nyumbani' : 'Home'} icon={<IconHome />} />
      <Item to="/care" label={sw ? 'Ongea' : 'CareChat'} icon={<IconChat />} />
      <Item to="/history" label={sw ? 'Historia' : 'History'} icon={<IconList />} />
      <Item to="/profile" label={sw ? 'Wasifu' : 'Profile'} icon={<IconUser />} />
    </nav>
  );
}
