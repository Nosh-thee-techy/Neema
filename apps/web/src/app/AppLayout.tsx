import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '../ui/BottomNav';

/** Screens that are a step in a flow (or an emergency) show no tab bar. */
const HIDE_NAV = new Set(['/start', '/orient', '/consent', '/register', '/unlock', '/alert']);

/** Shell with optional navigation (bottom bar on phones, side rail on laptops). */
export function AppLayout() {
  const loc = useLocation();
  const showNav = !HIDE_NAV.has(loc.pathname);

  return (
    <div className={showNav ? 'neema-shell neema-shell--nav' : 'neema-shell'}>
      <Outlet />
      {showNav ? <BottomNav /> : null}
    </div>
  );
}
