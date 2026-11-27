import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { TermsContent } from '../ui/TermsContent';

/** Public Terms and Conditions page (no PIN needed). */
export function TermsPage() {
  const nav = useNavigate();
  const { lang } = useLocale();
  return (
    <main className="screen">
      <div className="reg__top">
        <BrandMark />
        <LangToggle />
      </div>
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {lang === 'sw' ? 'Masharti na Vigezo' : 'Terms and Conditions'}
      </h1>
      <TermsContent lang={lang} />
      <button type="button" className="btn btn-secondary btn-block" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/start'))}>
        {lang === 'sw' ? 'Rudi' : 'Back'}
      </button>
    </main>
  );
}
