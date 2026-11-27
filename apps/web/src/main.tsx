import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/nunito';
import '@fontsource-variable/fraunces/soft.css';
import '@fontsource-variable/fraunces/soft-italic.css';
import './styles/app.css';
import './styles/alerting.css';
import './styles/theme-linen.css';
import './styles/dashboard.css';
import './styles/bento.css';
import './styles/care-chat.css';
import './styles/todo.css';
import './styles/auth.css';
import './styles/register.css';
import './styles/home.css';
import './styles/nav.css';
import './styles/system.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the offline shell after first paint. No analytics, no remote logging.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline install is best-effort; the app still works online without it.
    });
  });
}
