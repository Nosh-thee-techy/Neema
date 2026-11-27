import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isRegistered, loadOnboarding } from '../hooks/useOnboarding';
import { isSessionUnlocked } from '../services/auth';
import { LoadingScreen } from '../ui/LoadingScreen';

/**
 * No marketing landing — route straight into care.
 * Orient → register (consent inside) → unlock → home.
 */
export function EntryPage() {
  const nav = useNavigate();

  useEffect(() => {
    const flags = loadOnboarding();
    if (!flags.orientationDone) {
      nav('/orient', { replace: true });
      return;
    }
    if (!isRegistered(flags)) {
      nav('/register', { replace: true });
      return;
    }
    if (!isSessionUnlocked()) {
      nav('/unlock', { replace: true });
      return;
    }
    nav('/home', { replace: true });
  }, [nav]);

  return <LoadingScreen />;
}
