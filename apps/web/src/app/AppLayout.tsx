import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useGuardian } from '../hooks/useGuardian';
import { sleepingNow } from '../services/sleepSession';
import { db } from '../storage/db';
import { BandSosConfirm } from '../ui/BandSosConfirm';
import { BottomNav } from '../ui/BottomNav';

/** Screens that are a step in a flow (or an emergency) show no tab bar. */
const HIDE_NAV = new Set(['/start', '/orient', '/consent', '/register', '/terms', '/record-birth', '/recovery-check', '/settings', '/unlock', '/alert', '/story', '/reading-check']);

/**
 * Opens the full-page check only for the pattern she may not feel:
 * a very low blood pressure together with a fast heart, and not while she is asleep.
 */
function ReadingWatch() {
  const g = useGuardian();
  const nav = useNavigate();
  const loc = useLocation();
  const hr = g.sample?.heartRate ?? null;

  useEffect(() => {
    if (hr === null || hr < 110) return;
    if (sleepingNow()) return;
    if (loc.pathname === '/reading-check' || loc.pathname === '/alert') return;
    try {
      if (sessionStorage.getItem('neema.readingCheck')) return;
    } catch {
      /* ignore */
    }
    void db.bp
      .orderBy('tsMs')
      .last()
      .then((bp) => {
        if (!bp || Date.now() - bp.tsMs > 30 * 60 * 1000 || bp.systolic >= 90) return;
        nav('/reading-check');
      });
  }, [hr, loc.pathname, nav]);

  return null;
}

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
      <ReadingWatch />
      <Outlet />
      <BandSosConfirm />
      {showNav ? <BottomNav /> : null}
    </div>
  );
}
