import { useEffect, useId, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLocale, type Lang } from '../hooks/useLocale';
import { loadOnboarding } from '../hooks/useOnboarding';
import { BrandMark } from '../ui/BrandMark';
import { LangToggle } from '../ui/LangToggle';
import { IconHeart, IconPressure, IconTemp, IconFeel, IconBell } from '../ui/icons';
import { BandArt } from '../ui/BandArt';
import '../styles/landing.css';

type Copy = Record<Lang, string>;
const c = (en: string, sw: string): Copy => ({ en, sw });

/* Swahili copy is a draft and needs native-speaker review, like the rest of the app. */
const T = {
  navHow: c('How it works', 'Jinsi inavyofanya kazi'),
  navBand: c('The band', 'Bendi'),
  navHonest: c('Privacy', 'Faragha'),
  open: c('Open the app', 'Fungua programu'),
  openReturning: c('Open Neema', 'Fungua Neema'),
  eyebrow: c('Maternal early warning · Prototype', 'Tahadhari ya mapema kwa mama · Mfano'),
  heroTitle: c('Neema Band', 'Bendi ya Neema'),
  heroAccent: c('One clear action when it matters.', 'Hatua moja wazi inapohitajika.'),
  heroSub: c(
    "Meet Neema — your everyday guardian. A soft wristband and offline phone app watch heart rate and temperature, learn what is normal for you, and turn warning signs into one spoken step and an SMS to your community health promoter.",
    'Kutana na Neema — mlinzi wako kila siku. Bendi laini na programu isiyohitaji mtandao hufuatilia mapigo na joto, hujifunza kawaida yako, na hugeuza dalili za hatari kuwa hatua moja inayosemwa na SMS kwa mhudumu wako wa afya ya jamii.',
  ),
  meetNeema: c('Meet Neema', 'Kutana na Neema'),
  meetBody: c(
    'She talks with you in Kiswahili or English — by voice, text, or sign. Behind her smile are WHO care cards and your live readings, so “what should I do?” stays grounded and safe.',
    'Anaongea nawe kwa Kiswahili au Kiingereza — sauti, maandishi, au ishara. Nyuma ya tabasamu yake ni kadi za WHO na vipimo vyako, ili “nifanye nini?” ibaki salama.',
  ),
  meetCta: c('Talk with Neema', 'Ongea na Neema'),
  b1: c('Learns her normal', 'Inajifunza kawaida yake'),
  b2: c('Works without internet', 'Inafanya kazi bila mtandao'),
  b3: c('Speaks Kiswahili', 'Inazungumza Kiswahili'),
  tryDemo: c('Try the live demo', 'Jaribu demo'),
  how: c('How it works', 'Jinsi inavyofanya kazi'),
  f1t: c('Heart rate', 'Mapigo ya moyo'),
  f1s: c('Her own normal, night by night.', 'Kawaida yake, kila usiku.'),
  f2t: c('Temperature', 'Joto'),
  f2s: c('A fever noticed early.', 'Homa hugunduliwa mapema.'),
  f3t: c('Blood pressure', 'Shinikizo la damu'),
  f3s: c('From a validated arm cuff.', 'Kutoka kifaa halali cha mkono.'),
  f4t: c('Symptoms', 'Dalili'),
  f4s: c('Tap or speak in Kiswahili.', 'Gusa au sema kwa Kiswahili.'),
  f5t: c('CHP alert', 'Tahadhari kwa CHP'),
  f5s: c('An SMS with where she is.', 'SMS yenye mahali alipo.'),
  splitA: c('Soft band.', 'Bendi laini.'),
  splitB: c('Clear signal.', 'Ishara wazi.'),
  splitC: c('Safer nights.', 'Usiku salama zaidi.'),
  splitBody: c(
    "The band sends a reading every second to her phone over Bluetooth. Neema compares it with her own normal, her blood pressure and the symptoms she reports, then says one thing: you're okay, check again soon, or go to a facility now.",
    'Bendi inatuma kipimo kila sekunde kwa simu yake kupitia Bluetooth. Neema inakilinganisha na kawaida yake, shinikizo la damu na dalili anazoripoti, kisha inasema jambo moja: uko salama, pima tena hivi karibuni, au nenda kituo cha afya sasa.',
  ),
  snugT: c('Wear it snug', 'Ivae ikubane kidogo'),
  snugS: c(
    "Skin contact keeps readings honest. If the signal drops, Neema says so. It never shows a calm green.",
    'Ngozi ikigusana na bendi, vipimo ni sahihi. Ishara ikipotea, Neema inakuambia. Haionyeshi kijani cha utulivu.',
  ),
  k1t: c('Night watch', 'Ulinzi wa usiku'),
  k1s: c('Heart rate and skin temperature, all night long.', 'Mapigo ya moyo na joto la ngozi, usiku kucha.'),
  k2t: c('Her normal', 'Kawaida yake'),
  k2s: c('A personal baseline, so a change means something for her.', 'Kipimo chake binafsi, ili mabadiliko yawe na maana kwake.'),
  k3t: c('Kiswahili voice', 'Sauti ya Kiswahili'),
  k3s: c('One spoken instruction, not a chart to read.', 'Maelekezo moja yanayosemwa, si chati ya kusoma.'),
  k4t: c('CHP at the door', 'CHP mlangoni'),
  k4s: c('SMS to her CHP and family, then the next person if no one answers.', 'SMS kwa CHP na familia, kisha kwa mtu mwingine ikiwa hakuna anayejibu.'),
  howTitle: c('From the band to the door.', 'Kutoka bendi hadi mlangoni.'),
  s1t: c('The band measures', 'Bendi inapima'),
  s1s: c('Heart rate and skin temperature, every second.', 'Mapigo ya moyo na joto la ngozi, kila sekunde.'),
  s2t: c('The phone learns', 'Simu inajifunza'),
  s2s: c('Adds blood pressure and symptoms, and learns her normal. All on the phone.', 'Inaongeza shinikizo la damu na dalili, na kujifunza kawaida yake. Yote kwenye simu.'),
  s3t: c('Rules decide', 'Kanuni zinaamua'),
  s3s: c('Clear rules a clinician can review. Software may raise a warning, never lower one.', 'Kanuni wazi ambazo mhudumu wa afya anaweza kukagua. Programu inaweza kuongeza tahadhari, haiwezi kuipunguza.'),
  s4t: c('Someone acts', 'Mtu anachukua hatua'),
  s4s: c('A spoken step in Kiswahili, an SMS to her CHP, and escalation until someone confirms.', 'Hatua inayosemwa kwa Kiswahili, SMS kwa CHP wake, na kumfikia mwingine hadi mtu athibitishe.'),
  lgT: c('Okay', 'Salama'),
  lgG: c('Calm message, next check time.', 'Ujumbe wa utulivu, na muda wa kupima tena.'),
  lyT: c('Watch', 'Angalia'),
  lyG: c('Rest, recheck, and a quiet heads-up to the CHP.', 'Pumzika, pima tena, na taarifa ya kimya kwa CHP.'),
  lrT: c('Act now', 'Hatari'),
  lrG: c('Go to a facility now. CHP and family get an SMS.', 'Nenda kituo cha afya sasa. CHP na familia wanapata SMS.'),
  luT: c('Check the band', 'Angalia bendi'),
  luG: c('Missing data is never shown as green.', 'Data isiyokuwepo haionyeshwi kama kijani.'),
  honestTitle: c('Honest by design.', 'Uaminifu kwanza.'),
  h1: c('All raw data stays on the phone. Only the alert SMS leaves.', 'Data yote ghafi inabaki kwenye simu. SMS ya tahadhari pekee ndiyo inatoka.'),
  h2: c('Decision support, not a diagnosis.', 'Msaada wa maamuzi, si utambuzi wa ugonjwa.'),
  h3: c('A prototype band built from hobby sensors. Clinical validation is planned.', 'Bendi ya mfano kutoka sensa za majaribio. Uthibitisho wa kitabibu umepangwa.'),
  h4: c('Danger-sign thresholds are placeholders until a clinician signs them off.', 'Viwango vya dalili za hatari ni vya muda hadi mhudumu wa afya avithibitishe.'),
  ctaTitle: c('See it work in three minutes.', 'Ione ikifanya kazi kwa dakika tatu.'),
  ctaSub: c('Open the app, add a CHP number, then run the stage demo from Settings.', 'Fungua programu, ongeza namba ya CHP, kisha endesha demo kutoka Mipangilio.'),
  fOffline: c('Works offline', 'Inafanya kazi bila mtandao'),
  fAndroid: c('Android · Chrome', 'Android · Chrome'),
  fLang: c('Kiswahili & English', 'Kiswahili na Kiingereza'),
  fData: c('Your data. On your phone.', 'Data yako. Kwenye simu yako.'),
  footnote: c(
    'Neema is a hackathon prototype for decision support. It does not diagnose, treat or replace care. In an emergency, go to the nearest health facility.',
    'Neema ni mfano wa hackathon wa kusaidia maamuzi. Haitambui ugonjwa, haitibu wala haichukui nafasi ya huduma ya afya. Katika dharura, nenda kituo cha afya kilicho karibu.',
  ),
  mockOk: c("You're okay", 'Uko salama'),
  mockSub: c('All quiet. Rest when you can.', 'Tulivu. Pumzika unapoweza.'),
  mockNormal: c('Her normal', 'Kawaida yake'),
};

/** Public product page for the Neema band. The installed app opens at /home and skips this. */
export function LandingPage() {
  const { lang } = useLocale();
  const nav = useNavigate();
  const t = (k: keyof typeof T) => T[k][lang];
  const returning = loadOnboarding().consentDone;

  // Opened as the installed app: go straight into care.
  useEffect(() => {
    if (window.matchMedia?.('(display-mode: standalone)').matches) nav('/start', { replace: true });
  }, [nav]);

  return (
    <div className="lp" lang={lang}>
      <header className="lp-nav">
        <div className="lp-wrap lp-nav__row">
          <Link to="/" className="lp-nav__brand" aria-label="Neema">
            <BrandMark />
          </Link>
          <nav className="lp-nav__links" aria-label={lang === 'sw' ? 'Sehemu za ukurasa' : 'Page sections'}>
            <a href="#neema">{t('meetNeema')}</a>
            <a href="#band">{t('navBand')}</a>
            <a href="#how">{t('navHow')}</a>
            <a href="#honest">{t('navHonest')}</a>
          </nav>
          <div className="lp-nav__actions">
            <LangToggle />
            <Link to="/start" className="lp-pill lp-pill--dark">
              {returning ? t('openReturning') : t('open')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero__grid">
            <div className="lp-hero__copy">
              <p className="lp-eyebrow">{t('eyebrow')}</p>
              <h1 className="lp-display">{t('heroTitle')}</h1>
              <p className="lp-accent">{t('heroAccent')}</p>
              <p className="lp-lead">{t('heroSub')}</p>
              <ul className="lp-bullets">
                <li>
                  <span className="lp-ring-ico"><IconWave /></span>
                  {t('b1')}
                </li>
                <li>
                  <span className="lp-ring-ico"><IconOffline /></span>
                  {t('b2')}
                </li>
                <li>
                  <span className="lp-ring-ico"><IconSpeak /></span>
                  {t('b3')}
                </li>
              </ul>
              <div className="lp-cta-row">
                <Link to="/start" className="lp-pill lp-pill--dark lp-pill--lg">
                  {t('tryDemo')}
                </Link>
                <a href="#how" className="lp-pill lp-pill--light lp-pill--lg">
                  {t('how')}
                </a>
              </div>
            </div>
            <div className="lp-hero__art">
              <Ribbon />
              <figure className="lp-neema-hero">
                <img
                  src="/brand/neema-companion.jpg"
                  alt={lang === 'sw' ? 'Neema, mlinzi wa mama' : 'Neema, maternal guardian'}
                  width={480}
                  height={640}
                  decoding="async"
                />
                <figcaption>Neema</figcaption>
              </figure>
              <BandArt className="lp-band lp-band--overlay" />
            </div>
          </div>
        </section>

        {/* Meet Neema */}
        <section className="lp-meet" id="neema" aria-labelledby="meet-neema-title">
          <div className="lp-wrap lp-meet__grid">
            <div className="lp-meet__portrait">
              <img
                src="/brand/neema-companion.jpg"
                alt=""
                width={420}
                height={560}
                decoding="async"
              />
            </div>
            <div className="lp-meet__copy">
              <h2 className="lp-h2" id="meet-neema-title">
                {t('meetNeema')}
              </h2>
              <p className="lp-lead">{t('meetBody')}</p>
              <Link to="/start" className="lp-pill lp-pill--dark lp-pill--lg">
                {t('meetCta')}
              </Link>
            </div>
          </div>
        </section>

        {/* Feature strip */}
        <section className="lp-strip" aria-label={lang === 'sw' ? 'Inachopima' : 'What it watches'}>
          <div className="lp-wrap lp-strip__grid">
            <Feature icon={<IconHeart />} title={t('f1t')} sub={t('f1s')} />
            <Feature icon={<IconTemp />} title={t('f2t')} sub={t('f2s')} />
            <Feature icon={<IconPressure />} title={t('f3t')} sub={t('f3s')} />
            <Feature icon={<IconFeel />} title={t('f4t')} sub={t('f4s')} />
            <Feature icon={<IconBell />} title={t('f5t')} sub={t('f5s')} />
          </div>
        </section>

        {/* Band + phone */}
        <section className="lp-split" id="band">
          <div className="lp-wrap lp-split__grid">
            <div className="lp-split__art">
              <PhoneMock lang={lang} okLabel={t('mockOk')} subLabel={t('mockSub')} normalLabel={t('mockNormal')} />
              <div className="lp-dock">
                <BandArt className="lp-dock__band" compact />
                <div className="lp-dock__base" aria-hidden />
              </div>
            </div>
            <div className="lp-split__copy">
              <h2 className="lp-h2">
                {t('splitA')}
                <br />
                {t('splitB')}
                <br />
                <em>{t('splitC')}</em>
              </h2>
              <p className="lp-lead">{t('splitBody')}</p>
              <div className="lp-note">
                <span className="lp-ring-ico"><IconBandLoop /></span>
                <div>
                  <strong>{t('snugT')}</strong>
                  <p>{t('snugS')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="lp-cards">
          <div className="lp-wrap lp-cards__grid">
            <MoodCard tone="night" icon={<IconMoon />} title={t('k1t')} sub={t('k1s')} />
            <MoodCard tone="dawn" icon={<IconWave />} title={t('k2t')} sub={t('k2s')} />
            <MoodCard tone="clay" icon={<IconSpeak />} title={t('k3t')} sub={t('k3s')} />
            <MoodCard tone="sea" icon={<IconPin />} title={t('k4t')} sub={t('k4s')} />
          </div>
        </section>

        {/* How it works */}
        <section className="lp-how" id="how">
          <div className="lp-wrap">
            <h2 className="lp-h2 lp-center">{t('howTitle')}</h2>
            <ol className="lp-steps">
              <Step n={1} title={t('s1t')} sub={t('s1s')} />
              <Step n={2} title={t('s2t')} sub={t('s2s')} />
              <Step n={3} title={t('s3t')} sub={t('s3s')} />
              <Step n={4} title={t('s4t')} sub={t('s4s')} />
            </ol>
            <div className="lp-legend">
              <Level level="GREEN" title={t('lgT')} sub={t('lgG')} />
              <Level level="YELLOW" title={t('lyT')} sub={t('lyG')} />
              <Level level="RED" title={t('lrT')} sub={t('lrG')} />
              <Level level="UNKNOWN" title={t('luT')} sub={t('luG')} />
            </div>
          </div>
        </section>

        {/* Honest claims */}
        <section className="lp-honest" id="honest">
          <div className="lp-wrap lp-honest__grid">
            <h2 className="lp-h2">
              <em>{t('honestTitle')}</em>
            </h2>
            <ul>
              <li><IconShield />{t('h1')}</li>
              <li><IconShield />{t('h2')}</li>
              <li><IconShield />{t('h3')}</li>
              <li><IconShield />{t('h4')}</li>
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section className="lp-final">
          <div className="lp-wrap lp-center">
            <h2 className="lp-h2">{t('ctaTitle')}</h2>
            <p className="lp-lead lp-center">{t('ctaSub')}</p>
            <Link to="/start" className="lp-pill lp-pill--dark lp-pill--lg">
              {t('tryDemo')}
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <ul className="lp-foot__bar">
            <li><IconOffline />{t('fOffline')}</li>
            <li><IconPhone />{t('fAndroid')}</li>
            <li><IconSpeak />{t('fLang')}</li>
            <li><IconShield />{t('fData')}</li>
          </ul>
          <p className="lp-foot__note">{t('footnote')}</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="lp-feature">
      <span className="lp-ring-ico lp-ring-ico--light">{icon}</span>
      <strong>{title}</strong>
      <span>{sub}</span>
    </div>
  );
}

function MoodCard({ tone, icon, title, sub }: { tone: string; icon: ReactNode; title: string; sub: string }) {
  return (
    <article className="lp-mood" data-tone={tone}>
      <div className="lp-mood__art" aria-hidden>
        {icon}
      </div>
      <div className="lp-mood__text">
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
      <span className="lp-mood__ico" aria-hidden>
        {icon}
      </span>
    </article>
  );
}

function Step({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <li className="lp-step">
      <span className="lp-step__n">{n}</span>
      <strong>{title}</strong>
      <p>{sub}</p>
    </li>
  );
}

function Level({ level, title, sub }: { level: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'; title: string; sub: string }) {
  return (
    <div className="lp-level" data-level={level}>
      <span className="lp-level__dot" aria-hidden />
      <div>
        <strong>{title}</strong>
        <p>{sub}</p>
      </div>
    </div>
  );
}

/** Mini phone showing the real home screen layout (illustrative numbers). */
function PhoneMock({ lang, okLabel, subLabel, normalLabel }: { lang: Lang; okLabel: string; subLabel: string; normalLabel: string }) {
  return (
    <div className="lp-phone" aria-hidden>
      <div className="lp-phone__notch" />
      <div className="lp-phone__screen">
        <div className="lp-phone__top">
          <span className="lp-phone__brand">Neema</span>
          <span className="lp-phone__lang">{lang === 'sw' ? 'SW' : 'EN'}</span>
        </div>
        <div className="lp-phone__hero">
          <span className="lp-phone__pill">{lang === 'sw' ? 'SALAMA' : 'OKAY'}</span>
          <strong>{okLabel}</strong>
          <span>{subLabel}</span>
        </div>
        <div className="lp-phone__tiles">
          <div>
            <b>74</b>
            <small>bpm</small>
          </div>
          <div>
            <b>36.8</b>
            <small>°C</small>
          </div>
          <div>
            <b>118/76</b>
            <small>BP</small>
          </div>
        </div>
        <div className="lp-phone__normal">
          <span>{normalLabel}</span>
          <div className="lp-phone__band">
            <i style={{ left: '34%', width: '30%' }} />
            <em style={{ left: '46%' }} />
          </div>
          <small>68–78 bpm</small>
        </div>
        <div className="lp-phone__list">
          <div className="lp-phone__row" data-done="true">
            <i />
            {lang === 'sw' ? 'Shinikizo · 118/76' : 'Pressure · 118/76'}
          </div>
          <div className="lp-phone__row">
            <i />
            {lang === 'sw' ? 'Unajisikiaje?' : 'How do you feel?'}
          </div>
          <div className="lp-phone__row" data-done="true">
            <i />
            {lang === 'sw' ? 'Bendi inakulinda' : 'Band is watching'}
          </div>
        </div>
        <div className="lp-phone__sos">SOS</div>
      </div>
    </div>
  );
}

/** Soft flowing ribbon behind the hero band. */
function Ribbon() {
  const id = useId();
  return (
    <svg className="lp-ribbon" viewBox="0 0 640 420" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efe3cf" />
          <stop offset="0.55" stopColor="#e4d2b5" />
          <stop offset="1" stopColor="#d7dbe4" />
        </linearGradient>
      </defs>
      <path
        d="M-20 300 C 120 210, 220 340, 360 270 S 560 150, 680 220 L 680 300 C 560 230, 470 360, 340 350 S 120 300, -20 380 Z"
        fill={`url(#${id}r)`}
        opacity="0.9"
      />
    </svg>
  );
}

/* --- small line icons used only on this page --- */

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
function IconWave() {
  return <Svg><path d="M3 12h3l2-5 4 10 2-5h7" /></Svg>;
}
function IconOffline() {
  return <Svg><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.2-2.6M19 13a10 10 0 0 0-2.4-1.7M2 9.5a15 15 0 0 1 5-3M22 9.5A15 15 0 0 0 12 5.5" /><circle cx="12" cy="20" r="0.8" /></Svg>;
}
function IconSpeak() {
  return <Svg><path d="M5 18l-1 3 4-2h7a5 5 0 0 0 5-5V9a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v5a5 5 0 0 0 1 3z" /><path d="M9 10h6M9 13h4" /></Svg>;
}
function IconMoon() {
  return <Svg><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Svg>;
}
function IconPin() {
  return <Svg><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>;
}
function IconShield() {
  return <Svg><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></Svg>;
}
function IconPhone() {
  return <Svg><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></Svg>;
}
function IconBandLoop() {
  return <Svg><ellipse cx="12" cy="12" rx="8" ry="5" /><rect x="9" y="14" width="6" height="4" rx="1.5" /></Svg>;
}
