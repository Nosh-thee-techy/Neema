import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '../ui/BottomNav';
import { NeemaFab } from '../ui/NeemaFab';

const HIDE_NAV = new Set(['/start', '/orient', '/consent', '/unlock', '/alert']);
/** Full-screen Neema surfaces — hide the floating icon while already there. */
const HIDE_NEEMA_FAB = new Set(['/care', '/sign', '/talk', ...HIDE_NAV]);

/** Shell with optional navigation (bottom bar on phones, side rail on laptops). */
export function AppLayout() {
  const loc = useLocation();
  const showNav = !HIDE_NAV.has(loc.pathname);
  const showNeemaFab = !HIDE_NEEMA_FAB.has(loc.pathname);

  return (
    <div className={showNav ? 'neema-shell neema-shell--nav' : 'neema-shell'}>
      <Outlet />
      {showNeemaFab ? <NeemaFab /> : null}
      {showNav ? <BottomNav /> : null}
    </div>
  );
}
