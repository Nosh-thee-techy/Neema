import { useCallback, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import { useTodayTasks } from '../hooks/useTodayTasks';
import { IconChat, IconHome, IconList, IconMore, IconPlus } from './icons';
import { QuickAddSheet } from './QuickAddSheet';

function Item({
  to,
  label,
  icon,
  badge,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
      <span className="nav-ico">
        {icon}
        {badge && badge > 0 ? <span className="nav-badge">{badge > 9 ? '9+' : badge}</span> : null}
      </span>
      {label}
    </NavLink>
  );
}

/** Main navigation: home, today list, add, talk with Neema, more. */
export function BottomNav() {
  const { t } = useLocale();
  const { remaining } = useTodayTasks();
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    fabRef.current?.focus();
  }, []);

  return (
    <>
      <nav className="bottom-nav" aria-label="Main">
        <Item to="/home" label={t('home')} icon={<IconHome />} />
        <Item to="/todo" label={t('todo_nav')} icon={<IconList />} badge={remaining} />
        <button
          ref={fabRef}
          type="button"
          className="fab"
          aria-label={t('add')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <IconPlus />
        </button>
        <Item to="/care" label={t('talk_nav')} icon={<IconChat />} />
        <Item to="/settings" label={t('more')} icon={<IconMore />} />
      </nav>
      <QuickAddSheet open={open} onClose={close} />
    </>
  );
}
