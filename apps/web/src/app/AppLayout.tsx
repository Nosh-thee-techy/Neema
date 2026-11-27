import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '../ui/BottomNav';

/** Screens that are a step in a flow (or an emergency) show no tab bar. */
const HIDE_NAV = new Set(['/start', '/orient', '/consent', '/register', '/terms', '/record-birth', '/recovery-check', '/settings', '/unlock', '/alert']);

/** Shell with optional navigation (bottom bar on phones, side rail on laptops). */
export function AppLayout() {
  const loc = useLocation();
  const showNav = !HIDE_NAV.has(loc.pathname);

  // Each screen starts at the top (keeps #anchors working).
  useEffect(() => {
    if (!loc.hash) window.scrollTo({ top: 0 });
  }, [loc.pathname, loc.hash]);

  return (
    <div className={showNav ? 'neema-shell neema-shell--nav' : 'neema-shell'}>
      <Outlet />
      {showNav ? <BottomNav /> : null}
    </div>
  );
}
