import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { useLocale } from '../hooks/useLocale';
import { loadOnboarding, saveOnboarding } from '../hooks/useOnboarding';

/** Short trust story — not a product briefing. */
export function OrientationPage() {
  const nav = useNavigate();
  const { lang, t } = useLocale();
  const [i, setI] = useState(0);

  const slides =
    lang === 'sw'
      ? [
          {
            title: 'Neema anakulinda usiku',
            body: 'Anasikiliza bendi yako, na mambo unayoandika — shinikizo na jinsi unavyojisikia.',
          },
          {
            title: 'Hatua moja wazi',
            body: 'Safi = pumzika. Angalia = pima tena. Hatari = wasiliana na CHP sasa.',
          },
          {
            title: 'Data inabaki hapa',
            body: 'Vipimo viko kwenye simu hii. Unachagua nani apokee tahadhari.',
          },
        ]
      : [
          {
            title: 'Neema watches with you',
            body: 'She listens to your band, and what you share — blood pressure and how you feel.',
          },
          {
            title: 'One clear next step',
            body: 'Okay = rest. Check = measure again. Go now = reach your CHP.',
          },
          {
            title: 'Your data stays here',
            body: 'Readings live on this phone. You choose who gets an alert.',
          },
        ];

  const slide = slides[i]!;

  function finish() {
    const flags = loadOnboarding();
    saveOnboarding({ ...flags, orientationDone: true });
    nav('/register');
  }

  return (
    <main className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BrandMark showSub />
        <LangToggle />
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h1 className="screen-title">{slide.title}</h1>
        <p className="screen-sub" style={{ fontSize: '1.05rem' }}>
          {slide.body}
        </p>
        <div className="dots" aria-hidden>
          {slides.map((_, idx) => (
            <span key={idx} data-on={idx === i} />
          ))}
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: '2rem' }}>
        <Button variant="ghost" onClick={finish}>
          {t('skip')}
        </Button>
        {i < slides.length - 1 ? (
          <Button variant="primary" onClick={() => setI((v) => v + 1)}>
            {t('next')}
          </Button>
        ) : (
          <Button variant="primary" onClick={finish}>
            {t('continue')}
          </Button>
        )}
      </div>
      <p className="trust-line">{t('saved_here')}</p>
    </main>
  );
}
