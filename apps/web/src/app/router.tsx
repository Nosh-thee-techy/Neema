import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GuardianProvider } from '../hooks/useGuardian';
import { AppLayout } from './AppLayout';
import { RequireAuth } from './RequireAuth';
import { EntryPage } from '../pages/EntryPage';
import { OrientationPage } from '../pages/OrientationPage';
import { RegisterPage } from '../pages/RegisterPage';
import { UnlockPage } from '../pages/UnlockPage';
import { HomePage } from '../pages/HomePage';
import { VitalsPage } from '../pages/VitalsPage';
import { BpPage } from '../pages/BpPage';
import { SymptomsPage } from '../pages/SymptomsPage';
import { AlertPage } from '../pages/AlertPage';
import { SummaryPage } from '../pages/SummaryPage';
import { ContactsPage } from '../pages/ContactsPage';
import { TeamPage } from '../pages/TeamPage';
import { HistoryPage } from '../pages/HistoryPage';
import { ProfilePage } from '../pages/ProfilePage';
import { ChasePage } from '../pages/ChasePage';
import { CheckInPage } from '../pages/CheckInPage';
import { EpdsPage } from '../pages/EpdsPage';
import { SignOffPage } from '../pages/SignOffPage';
import { SignSessionPage } from '../pages/SignSessionPage';
import { TalkModePage } from '../pages/TalkModePage';
import { CareChatPage } from '../pages/CareChatPage';
import { LocaleProvider } from '../hooks/useLocale';
import { LandingPage } from '../pages/LandingPage';

/**
 * Routes. "/" is the public band page; the installed app opens at /home (manifest start_url)
 * and the care entry flow lives at /start, so a mother never has to pass the product page.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <LocaleProvider>
      <GuardianProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<AppLayout />}>
            <Route path="/start" element={<EntryPage />} />
            <Route path="/orient" element={<OrientationPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/consent" element={<Navigate to="/register" replace />} />
            <Route path="/unlock" element={<UnlockPage />} />
            <Route
              path="/talk"
              element={
                <RequireAuth>
                  <TalkModePage />
                </RequireAuth>
              }
            />
            <Route
              path="/care"
              element={
                <RequireAuth>
                  <CareChatPage />
                </RequireAuth>
              }
            />
            <Route path="/todo" element={<Navigate to="/home" replace />} />
            <Route
              path="/home"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route
              path="/vitals"
              element={
                <RequireAuth>
                  <VitalsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/bp"
              element={
                <RequireAuth>
                  <BpPage />
                </RequireAuth>
              }
            />
            <Route
              path="/symptoms"
              element={
                <RequireAuth>
                  <SymptomsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/alert"
              element={
                <RequireAuth>
                  <AlertPage />
                </RequireAuth>
              }
            />
            <Route path="/passport" element={<Navigate to="/profile" replace />} />
            <Route
              path="/summary"
              element={
                <RequireAuth>
                  <SummaryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/contacts"
              element={
                <RequireAuth>
                  <ContactsPage />
                </RequireAuth>
              }
            />
            <Route path="/settings" element={<Navigate to="/profile" replace />} />
            <Route
              path="/chase"
              element={
                <RequireAuth>
                  <ChasePage />
                </RequireAuth>
              }
            />
            <Route
              path="/check-in"
              element={
                <RequireAuth>
                  <CheckInPage />
                </RequireAuth>
              }
            />
            <Route
              path="/epds"
              element={
                <RequireAuth>
                  <EpdsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sign-off"
              element={
                <RequireAuth>
                  <SignOffPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sign"
              element={
                <RequireAuth>
                  <SignSessionPage />
                </RequireAuth>
              }
            />
            <Route
              path="/history"
              element={
                <RequireAuth>
                  <HistoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/team"
              element={
                <RequireAuth>
                  <TeamPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/start" replace />} />
          </Route>
        </Routes>
      </GuardianProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
