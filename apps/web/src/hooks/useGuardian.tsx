/**
 * Full guardian product state: band/simulator, triage, auto alerts, recheck.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEMO_ESCALATION,
  FIELD_ESCALATION,
  type AlertRecord,
  type Contact,
  type RuleId,
  type Stage,
  type SymptomCode,
  type TriageResult,
  type VitalsSample,
} from '@neema/core';
import { getMessageText } from '../services/speech';
import { createSimulatorBand, isSimulatorBand } from '../services/simulatorBand';
import { createWebBluetoothBand } from '../services/webBluetoothBand';
import { createReadingsBand } from '../services/readingsBand';
import { createVitalsPipeline } from '../services/vitalsPipeline';
import { runTriage } from '../services/triageRunner';
import { applyBandFeedback, nudgeIfCheckDue } from '../services/bandFeedback';
import type { BandSource } from '../services/bandSource';
import {
  createRecheckLoop,
  latestBpId,
  recheckDelayMs,
  type RecheckState,
} from '../services/recheck';
import { runAlertChain } from '../services/alertChain';
import {
  acknowledgeRed,
  activeRedAlert,
  buildSmsLink,
  firstRecipients,
  markNotified,
  type AcknowledgedBy,
} from '../services/alerts';
import { tickFollowUps } from '../services/followUp';
import { contactReadiness } from '../services/contacts';
import { startEscalation } from '../services/escalation';
import { soundAlarm } from '../services/alarm';
import { watchPlanFor } from '../services/watchPlan';
import { progressFromProfile } from '../services/pregnancyProgress';
import { loadProfile } from '../services/passport';
import { resetDemoData, seedDemoStep, type DemoStep } from '../services/demoPlayer';
import type { EscalationHandle } from '../services/escalation';
import { db } from '../storage/db';

export type BandMode = 'simulator' | 'bluetooth' | 'live';

/** One prefilled SMS the mother can open (a web app cannot send silently). */
export interface PendingSms {
  contactId: string;
  name: string;
  role: 'chp' | 'family' | 'supervisor';
  href: string;
  opened: boolean;
  /** Added by escalation because nobody acknowledged in time. */
  escalated?: boolean;
}

/** An escalation step that just fired: nobody acknowledged in time. */
export interface EscalationNotice {
  name: string;
  label: 'next' | 'supervisor';
  atMs: number;
}

/** A reply from the CHP. In demo mode it is scripted (project doc ??10). */
export interface ChpReply {
  name: string;
  text: string;
  atMs: number;
  scripted: boolean;
}

/** After acknowledgement, the same evidence must not re-raise a new alert for this long. */
const ACK_QUIET_MS = 30 * 60_000;
/** Survives a page reload during the demo (session only, cleared by Reset). */
const DEMO_KEY = 'neema.demo.v1';

interface SavedDemo {
  step: DemoStep;
  stage: Stage;
  gestationWeeks?: number;
}

function loadSavedDemo(): SavedDemo | null {
  try {
    const raw = sessionStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as SavedDemo) : null;
  } catch {
    return null;
  }
}

function saveDemo(demo: SavedDemo | null): void {
  try {
    if (demo) sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    else sessionStorage.removeItem(DEMO_KEY);
  } catch {
    // private mode: the demo still works until reload
  }
}

/** Scripted CHP reply delay after the mother opens the SMS in demo mode. */
const SCRIPTED_REPLY_MS = 6_000;

interface GuardianState {
  sample: VitalsSample | null;
  triage: TriageResult | null;
  message: string;
  connected: boolean;
  bandMode: BandMode;
  loading: boolean;
  error: string | null;
  pendingSmsHref: string | null;
  /** Every SMS prepared for the active alert, in the order to send them. */
  pendingSms: PendingSms[];
  activeAlertId: string | null;
  /** True when RED is still showing but someone has confirmed they are acting on it. */
  redAcknowledged: boolean;
  chpReply: ChpReply | null;
  /** The SMS text of the active alert (for the "choose who to text" fallback). */
  alertBody: string | null;
  /** Set when escalation reached a new contact; shown loudly on the alert screen. */
  escalationNotice: EscalationNotice | null;
  /** Seconds until the next escalation step, or null when none is planned. */
  escalationDueInSec: number | null;
  /** Stage used for triage (from the Passport, or the demo step). */
  stage: Stage;
  demoStep: DemoStep | null;
  lastChainNote: string | null;
  recheck: RecheckState;
  recheckDueInSec: number | null;
  connectSimulator: () => Promise<void>;
  /** Pull the band's Wi-Fi readings. Does not open a Bluetooth pair sheet. */
  connectLive: () => Promise<void>;
  connectBluetooth: () => Promise<void>;
  disconnect: () => Promise<void>;
  saveBp: (systolic: number, diastolic: number) => Promise<TriageResult | null>;
  saveSymptoms: (codes: SymptomCode[]) => Promise<TriageResult | null>;
  refreshTriage: (sos?: boolean) => Promise<TriageResult | null>;
  /** Clears RED. Only a CHP reply, the mother on her way, or a clinician may do this. */
  acknowledgeActiveRed: (by: AcknowledgedBy) => Promise<void>;
  /** App SOS (R9). The on-screen hold still sends for help on the first hold. */
  pressSos: () => Promise<TriageResult | null>;
  /**
   * The band's first long-press only asks. A second one, or confirmBandSos, sends for help.
   * dismissBandSos treats it as a mistake and does not alert anyone.
   */
  bandSosAsk: boolean;
  confirmBandSos: () => Promise<TriageResult | null>;
  dismissBandSos: () => void;
  /** Records that the mother opened one SMS link; in demo mode schedules the CHP reply. */
  markSmsOpened: (contactId: string) => void;
  /** Demo mode: seed a scripted scenario step and run the full chain. */
  playDemo: (step: DemoStep) => Promise<TriageResult | null>;
  /** Demo mode: clear readings and alerts and return to a calm band. */
  resetDemo: () => Promise<void>;
  /** Drop a scripted stage override and triage from the saved passport. */
  syncFromProfile: () => Promise<TriageResult | null>;
  clearPendingSms: () => void;
  clearError: () => void;
  openPendingSms: () => void;
  /** Simulator-only: switch demo vitals scenario (0?3). */
  setDemoScenario: (n: 0 | 1 | 2 | 3) => Promise<void>;
}

const GuardianContext = createContext<GuardianState | null>(null);

export function GuardianProvider({ children }: { children: ReactNode }) {
  const bandRef = useRef<BandSource>(createSimulatorBand(1));
  const unsubRef = useRef<(() => void) | null>(null);
  const pipelineRef = useRef(createVitalsPipeline());
  const recheckRef = useRef(createRecheckLoop());
  const escalationRef = useRef<EscalationHandle | null>(null);
  const lastLevel = useRef<string | null>(null);
  const chainInFlight = useRef(false);
  const refreshRef = useRef<(sos?: boolean) => Promise<TriageResult | null>>(async () => null);
  const savedDemo = useRef(loadSavedDemo()).current;
  const stageOverrideRef = useRef<{ stage: Stage; gestationWeeks?: number } | null>(
    savedDemo
      ? { stage: savedDemo.stage, ...(savedDemo.gestationWeeks !== undefined ? { gestationWeeks: savedDemo.gestationWeeks } : {}) }
      : null,
  );
  const ackRef = useRef<{ rules: RuleId[]; atMs: number } | null>(null);
  const replyTimerRef = useRef<number | null>(null);
  const alertBodyRef = useRef<string | null>(null);
  /** Alert whose SMS buttons/escalation are already set up in this page session. */
  const restoredAlertRef = useRef<string | null>(null);
  const restoreOpenAlertRef = useRef<(alert: AlertRecord) => Promise<void>>(async () => undefined);
  const demoActiveRef = useRef<boolean>(false);

  const [sample, setSample] = useState<VitalsSample | null>(null);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [connected, setConnected] = useState(false);
  const [bandMode, setBandMode] = useState<BandMode>('simulator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSms, setPendingSms] = useState<PendingSms[]>([]);
  const [chpReply, setChpReply] = useState<ChpReply | null>(null);
  const [redAcknowledged, setRedAcknowledged] = useState(false);
  const [stage, setStage] = useState<Stage>('pregnancy');
  const [demoStep, setDemoStep] = useState<DemoStep | null>(savedDemo?.step ?? null);
  const [alertBody, setAlertBody] = useState<string | null>(null);
  const [escalationNotice, setEscalationNotice] = useState<EscalationNotice | null>(null);
  const [escalationDueInSec, setEscalationDueInSec] = useState<number | null>(null);
  demoActiveRef.current = demoStep !== null;
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [lastChainNote, setLastChainNote] = useState<string | null>(null);
  const [recheck, setRecheck] = useState<RecheckState>(recheckRef.current.getState());
  const [recheckDueInSec, setRecheckDueInSec] = useState<number | null>(null);
  const [bandSosAsk, setBandSosAsk] = useState(false);
  /** True while the on-screen Emergency hold is the one raising SOS. */
  const phoneSosRef = useRef(false);
  /** True after the band's first long-press, until she confirms or dismisses. */
  const bandAskRef = useRef(false);
  const prevBandSos = useRef(false);
  /** Ignore the band flag until this time after she says it was a mistake. */
  const ignoreBandSosUntil = useRef(0);

  const bindBand = useCallback((band: BandSource) => {
    unsubRef.current?.();
    bandRef.current = band;
    unsubRef.current = band.onVitals(async (s) => {
      setSample(s);
      await pipelineRef.current.ingest(s);
      const rising = s.sos && !prevBandSos.current;
      prevBandSos.current = s.sos;
      const suppressed = Date.now() < ignoreBandSosUntil.current;
      if (rising && !phoneSosRef.current && !suppressed) {
        if (bandAskRef.current) {
          bandAskRef.current = false;
          setBandSosAsk(false);
          await refreshRef.current(true);
          return;
        }
        bandAskRef.current = true;
        setBandSosAsk(true);
        await refreshRef.current(false);
        return;
      }
      const sosForRules = !suppressed && (phoneSosRef.current || (s.sos && !bandAskRef.current));
      await refreshRef.current(sosForRules);
    });
  }, []);

  const handleLevelTransition = useCallback(async (result: TriageResult) => {
    if (lastLevel.current === result.level) {
      setRecheck(recheckRef.current.getState());
      return;
    }
    const prev = lastLevel.current;
    lastLevel.current = result.level;
    await applyBandFeedback(bandRef.current, result.level);

    if (result.level === 'YELLOW') {
      const bps = await db.bp.orderBy('tsMs').toArray();
      recheckRef.current.scheduleInMs(result, latestBpId(bps), recheckDelayMs(result));
      setRecheck(recheckRef.current.getState());
      setLastChainNote(
        import.meta.env.DEV
          ? 'A quiet heads-up for your CHP is ready. Recheck blood pressure soon.'
          : `A quiet heads-up for your CHP is ready. Recheck blood pressure in about ${result.recheckInMinutes ?? 45} minutes.`,
      );
    } else if (result.level === 'GREEN' || result.level === 'UNKNOWN') {
      recheckRef.current.cancel();
      setRecheck(recheckRef.current.getState());
    }

    // Someone already confirmed they are acting on this RED: do not re-alert for
    // the same evidence (a BP reading stays in the 30-minute window after the ack).
    const ack = ackRef.current;
    const sameEvidence =
      ack !== null &&
      Date.now() - ack.atMs < ACK_QUIET_MS &&
      !result.firedRules.includes('R9_SOS') &&
      result.firedRules
        .filter((r) => r !== 'R12_NOTHING_CONCERNING' && r !== 'R11_SIGNAL_INVALID')
        .every((r) => ack.rules.includes(r));
    setRedAcknowledged(result.level === 'RED' && sameEvidence);
    if (sameEvidence && result.level !== 'GREEN') return;
    if (result.level === 'GREEN') ackRef.current = null;

    if (
      (result.level === 'RED' || result.level === 'YELLOW') &&
      prev !== result.level &&
      !chainInFlight.current
    ) {
      chainInFlight.current = true;
      try {
        // On reload, sticky/open alerts must not spawn a second chain.
        const latest = await db.alerts.orderBy('tsMs').reverse().first();
        const reuseOpen =
          latest &&
          latest.level === result.level &&
          latest.acknowledgedAtMs === undefined &&
          prev === null;
        if (reuseOpen) {
          await restoreOpenAlertRef.current(latest);
          setLastChainNote(
            result.level === 'RED'
              ? 'Open the message to reach your CHP now.'
              : 'A quiet heads-up for your CHP is ready.',
          );
        } else {
          const chain = await runAlertChain(
            result,
            { allowDemo: true, skipConsent: true },
            demoActiveRef.current ? DEMO_ESCALATION : FIELD_ESCALATION,
          );
          if (chain) {
            setChpReply(null);
            setEscalationNotice(null);
            alertBodyRef.current = chain.body;
            setAlertBody(chain.body);
            setPendingSms(
              chain.smsLinks.map(({ contact, href }) => ({
                contactId: contact.id,
                name: contact.name,
                role: contact.role,
                href,
                opened: false,
              })),
            );
            setActiveAlertId(chain.alertId);
            restoredAlertRef.current = chain.alertId;
            escalationRef.current?.stop();
            escalationRef.current = chain.escalation;
            setLastChainNote(
              result.level === 'RED'
                ? 'Open the message to reach your CHP now.'
                : 'Guidance is ready, and a quiet SMS for your CHP is prepared.',
            );
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        chainInFlight.current = false;
      }
    }
  }, []);

  const refreshTriage = useCallback(
    async (sos = false) => {
      try {
        // Stage drives rule sets (R7 is postpartum-only, R10 needs gestation weeks).
        // ASSUMPTION: an encrypted profile cannot be read here without the PIN, so it
        // falls back to pregnancy with no gestation week (R10 then stays silent).
        const override = stageOverrideRef.current;
        const profile = override ? null : await loadProfile().catch(() => null);
        const activeStage: Stage = override?.stage ?? profile?.stage ?? 'pregnancy';
        const weeks = override
          ? override.gestationWeeks
          : (progressFromProfile(profile)?.weeks ?? profile?.gestationWeeks);
        setStage(activeStage);
        // Her watch plan: stricter settings from her own history (none in demo or when locked).
        const plan = watchPlanFor(override ? null : profile);
        const result = await runTriage({
          stage: activeStage,
          ...(activeStage === 'pregnancy' && weeks !== undefined ? { gestationWeeks: weeks } : {}),
          sosActive: sos,
          markedResting: true,
          timeZone: 'Africa/Nairobi',
          config: plan.config,
        });
        setTriage(result);
        await handleLevelTransition(result);
        // A check her plan asks for (e.g. blood pressure) is due: one gentle buzz a day.
        if (plan.bpEveryDays !== null && result.level !== 'RED') {
          const lastBp = await db.bp.orderBy('tsMs').last().catch(() => undefined);
          await nudgeIfCheckDue(bandRef.current, plan, lastBp?.tsMs ?? null).catch(() => false);
        }
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [handleLevelTransition],
  );

  refreshRef.current = refreshTriage;

  /** Nobody acknowledged in time: offer an SMS to the next person and make noise. */
  const offerEscalationSms = useCallback((contact: Contact, label: 'next' | 'supervisor') => {
    const body = alertBodyRef.current;
    if (!body) return;
    setPendingSms((list) =>
      list.some((p) => p.contactId === contact.id)
        ? list
        : [
            ...list,
            {
              contactId: contact.id,
              name: contact.name,
              role: contact.role,
              href: buildSmsLink(contact.phone, body),
              opened: false,
              escalated: true,
            },
          ],
    );
    setEscalationNotice({ name: contact.name, label, atMs: Date.now() });
    soundAlarm();
    void bandRef.current.sendCommand({ kind: 'vibrate', pattern: 'long' }).catch(() => undefined);
  }, []);

  /**
   * Rebuilds the SMS buttons (and, for RED, the escalation timer) for an alert that
   * is still open after a reload. Idempotent per alert, so the mount effect and the
   * reload guard in handleLevelTransition can both call it safely.
   */
  const restoreOpenAlert = useCallback(async (alert: AlertRecord) => {
    if (restoredAlertRef.current === alert.id) return;
    restoredAlertRef.current = alert.id;
    setActiveAlertId(alert.id);
    if (!alert.smsBody) return;
    const body = alert.smsBody;
    alertBodyRef.current = body;
    setAlertBody(body);
    const { usable } = await contactReadiness();
    const first = firstRecipients(alert.level, usable);
    const opened = new Set(alert.notified.map((n) => n.contactId));
    setPendingSms(
      first.map((c) => ({
        contactId: c.id,
        name: c.name,
        role: c.role,
        href: buildSmsLink(c.phone, body),
        opened: opened.has(c.id),
      })),
    );
    if (alert.level === 'RED') {
      escalationRef.current?.stop();
      escalationRef.current = startEscalation(
        alert.id,
        usable,
        first.map((c) => c.id),
        demoActiveRef.current ? DEMO_ESCALATION : FIELD_ESCALATION,
        alert.tsMs,
      );
    }
  }, []);
  restoreOpenAlertRef.current = restoreOpenAlert;

  useEffect(() => {
    bindBand(bandRef.current);
    return () => unsubRef.current?.();
  }, [bindBand]);

  // A sticky RED survives reloads: restore its id, SMS buttons and escalation.
  useEffect(() => {
    void (async () => {
      const alert = await activeRedAlert();
      if (alert) {
        lastLevel.current = 'RED';
        await restoreOpenAlertRef.current(alert);
      }
      void refreshRef.current(false);
    })();
    return () => {
      if (replyTimerRef.current) window.clearTimeout(replyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      recheckRef.current.isDue();
      const state = recheckRef.current.getState();
      setRecheck({ ...state });
      if (state.status === 'scheduled' && state.dueAtMs) {
        setRecheckDueInSec(Math.max(0, Math.ceil((state.dueAtMs - Date.now()) / 1000)));
      } else if (state.status === 'due') {
        setRecheckDueInSec(0);
      } else {
        setRecheckDueInSec(null);
      }

      const esc = escalationRef.current;
      if (esc) {
        void esc.tick().then((step) => {
          if (step.kind === 'notify') offerEscalationSms(step.contact, step.label);
          // Read the next due time after the tick, so a step that just fired never shows 0:00.
          const due = step.kind === 'acknowledged' ? null : esc.nextDueAtMs();
          setEscalationDueInSec(due === null ? null : Math.max(0, Math.ceil((due - Date.now()) / 1000)));
        });
      }

      void tickFollowUps();
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (loadSavedDemo()) return;
    let cancel = false;
    void (async () => {
      try {
        const probe = await fetch('/api/readings');
        if (cancel || probe.status === 503 || !probe.ok) return;
        await bandRef.current.disconnect().catch(() => undefined);
        const band = createReadingsBand();
        bindBand(band);
        await band.connect();
        if (cancel) {
          await band.disconnect();
          return;
        }
        setBandMode('live');
        setConnected(true);
      } catch {
        /* Leave the page as it is until the readings endpoint answers. */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [bindBand]);

  const connectBand = useCallback(
    async (mode: BandMode) => {
      setLoading(true);
      setError(null);
      try {
        await bandRef.current.disconnect().catch(() => undefined);
        const next =
          mode === 'live'
            ? createReadingsBand()
            : mode === 'bluetooth'
              ? createWebBluetoothBand()
              : createSimulatorBand(1);
        bindBand(next);
        await next.connect();
        setBandMode(mode);
        setConnected(true);
      } catch (err) {
        if (mode === 'live') {
          setConnected(false);
          setError(err instanceof Error ? err.message : 'The band readings could not be reached.');
        } else if (mode === 'bluetooth') {
          try {
            const sim = createSimulatorBand(1);
            bindBand(sim);
            await sim.connect();
            setBandMode('simulator');
            setConnected(true);
            setError('Bluetooth unavailable ? using simulator instead.');
          } catch (simErr) {
            setError(simErr instanceof Error ? simErr.message : String(simErr));
          }
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setLoading(false);
      }
    },
    [bindBand],
  );

  const value = useMemo<GuardianState>(() => {
  const markSmsOpened = (contactId: string) => {
      setPendingSms((list) => list.map((p) => (p.contactId === contactId ? { ...p, opened: true } : p)));
      if (activeAlertId) void markNotified(activeAlertId, contactId);
      const opened = pendingSms.find((p) => p.contactId === contactId);
      // Demo only: the CHP phone "replies". In the field the reply arrives as a real SMS
      // and the mother taps "My CHP replied".
      if (demoStep && opened?.role === 'chp' && triage?.level === 'RED') {
        if (replyTimerRef.current) window.clearTimeout(replyTimerRef.current);
        replyTimerRef.current = window.setTimeout(() => {
          setChpReply({ name: opened.name, text: 'Nakuja sasa. Kaa tayari.', atMs: Date.now(), scripted: true });
          replyTimerRef.current = null;
        }, SCRIPTED_REPLY_MS);
      }
    };

    return {
      sample,
      triage,
      message: triage ? getMessageText(triage.messageKey) : 'Connect your band to begin watching.',
      connected,
      bandMode,
      loading,
      error,
      pendingSmsHref: pendingSms.find((p) => !p.opened)?.href ?? pendingSms[0]?.href ?? null,
      pendingSms,
      activeAlertId,
      redAcknowledged,
      chpReply,
      alertBody,
      escalationNotice,
      escalationDueInSec,
      stage,
      demoStep,
      lastChainNote,
      recheck,
      recheckDueInSec,
      connectSimulator: () => connectBand('simulator'),
      connectLive: () => connectBand('live'),
      connectBluetooth: () => connectBand('bluetooth'),
      async disconnect() {
        await bandRef.current.disconnect();
        setConnected(false);
      },
      async saveBp(systolic, diastolic) {
        setLoading(true);
        setError(null);
        try {
          await db.bp.put({
            id: crypto.randomUUID(),
            tsMs: Date.now(),
            systolic,
            diastolic,
            enteredBy: 'mother',
            source: 'home_cuff',
          });
          const result = await refreshTriage(sample?.sos ?? false);
          const rs = recheckRef.current.getState();
          if (result && (rs.status === 'due' || rs.status === 'scheduled') && result.level !== 'YELLOW') {
            recheckRef.current.cancel();
            setRecheck(recheckRef.current.getState());
            setRecheckDueInSec(null);
          }
          return result;
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          return null;
        } finally {
          setLoading(false);
        }
      },
      async saveSymptoms(codes) {
        setLoading(true);
        setError(null);
        try {
          await db.symptoms.put({
            id: crypto.randomUUID(),
            tsMs: Date.now(),
            codes,
            inputMethod: 'tap',
          });
          return await refreshTriage(sample?.sos ?? false);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          return null;
        } finally {
          setLoading(false);
        }
      },
      refreshTriage,
      async acknowledgeActiveRed(by) {
        const alertId = activeAlertId ?? (await activeRedAlert())?.id;
        if (!alertId) return;
        const row = await db.alerts.get(alertId);
        await acknowledgeRed(alertId, Date.now(), by);
        ackRef.current = { rules: row?.firedRules ?? [], atMs: Date.now() };
        escalationRef.current?.stop();
        escalationRef.current = null;
        setActiveAlertId(null);
        setPendingSms([]);
        setEscalationNotice(null);
        setEscalationDueInSec(null);
        setLastChainNote(
          by === 'chp_replied'
            ? 'Your CHP is on the way.'
            : by === 'mother_on_the_way'
              ? 'You are on your way. Keep your phone with you.'
              : 'Cleared by a clinician.',
        );
        lastLevel.current = null;
        await refreshTriage(false);
      },
      async pressSos() {
        const band = bandRef.current;
        phoneSosRef.current = true;
        window.setTimeout(() => {
          phoneSosRef.current = false;
        }, 4000);
        bandAskRef.current = false;
        setBandSosAsk(false);
        if (isSimulatorBand(band) && band.isConnected()) band.pressSos();
        ackRef.current = null;
        return refreshTriage(true);
      },
      bandSosAsk,
      async confirmBandSos() {
        bandAskRef.current = false;
        setBandSosAsk(false);
        ackRef.current = null;
        return refreshTriage(true);
      },
      dismissBandSos() {
        bandAskRef.current = false;
        ignoreBandSosUntil.current = Date.now() + 5000;
        setBandSosAsk(false);
      },
      markSmsOpened,
      async playDemo(step) {
        setLoading(true);
        setError(null);
        try {
          const plan = await seedDemoStep(step);
          stageOverrideRef.current = {
            stage: plan.stage,
            ...(plan.gestationWeeks !== undefined ? { gestationWeeks: plan.gestationWeeks } : {}),
          };
          if (step !== 'B_recheck') {
            escalationRef.current?.stop();
            escalationRef.current = null;
            recheckRef.current.cancel();
            setActiveAlertId(null);
            setPendingSms([]);
            setChpReply(null);
            setEscalationNotice(null);
            setEscalationDueInSec(null);
            setAlertBody(null);
            alertBodyRef.current = null;
            ackRef.current = null;
            lastLevel.current = null;
          }
          setDemoStep(step);
          saveDemo({ step, ...stageOverrideRef.current! });
          if (!bandRef.current.isConnected()) {
            const sim = createSimulatorBand(plan.bandScenario);
            bindBand(sim);
            await sim.connect();
            setBandMode('simulator');
            setConnected(true);
          } else if (isSimulatorBand(bandRef.current)) {
            await bandRef.current.sendCommand({ kind: 'demo', scenario: plan.bandScenario });
          }
          const result = await refreshTriage(false);
          if (step === 'B_recheck' && result && result.level !== 'YELLOW') {
            recheckRef.current.cancel();
            setRecheck(recheckRef.current.getState());
            setRecheckDueInSec(null);
          }
          return result;
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          return null;
        } finally {
          setLoading(false);
        }
      },
      async resetDemo() {
        await resetDemoData();
        stageOverrideRef.current = null;
        escalationRef.current?.stop();
        escalationRef.current = null;
        recheckRef.current.cancel();
        setRecheck(recheckRef.current.getState());
        setRecheckDueInSec(null);
        setActiveAlertId(null);
        setPendingSms([]);
        setChpReply(null);
        setEscalationNotice(null);
        setEscalationDueInSec(null);
        setAlertBody(null);
        alertBodyRef.current = null;
        setDemoStep(null);
        saveDemo(null);
        setRedAcknowledged(false);
        ackRef.current = null;
        lastLevel.current = null;
        if (isSimulatorBand(bandRef.current)) {
          await bandRef.current.sendCommand({ kind: 'demo', scenario: 1 });
        }
        setLastChainNote(null);
        await refreshTriage(false);
      },
      async syncFromProfile() {
        stageOverrideRef.current = null;
        setDemoStep(null);
        saveDemo(null);
        escalationRef.current?.stop();
        escalationRef.current = null;
        recheckRef.current.cancel();
        setRecheck(recheckRef.current.getState());
        setRecheckDueInSec(null);
        setActiveAlertId(null);
        setPendingSms([]);
        setChpReply(null);
        setEscalationNotice(null);
        setEscalationDueInSec(null);
        setAlertBody(null);
        alertBodyRef.current = null;
        setRedAcknowledged(false);
        ackRef.current = null;
        lastLevel.current = null;
        setLastChainNote(null);
        return refreshTriage(false);
      },
      clearPendingSms() {
        setPendingSms([]);
      },
      clearError() {
        setError(null);
      },
      openPendingSms() {
        const next = pendingSms.find((p) => !p.opened) ?? pendingSms[0];
        if (!next) return;
        markSmsOpened(next.contactId);
        window.location.href = next.href;
      },
      async setDemoScenario(n) {
        await bandRef.current.sendCommand({ kind: 'demo', scenario: n });
        setLastChainNote(`Simulator scenario ${n} active.`);
      },
    };
  },
    [
      sample,
      triage,
      connected,
      bandMode,
      loading,
      error,
      pendingSms,
      activeAlertId,
      redAcknowledged,
      chpReply,
      stage,
      demoStep,
      lastChainNote,
      recheck,
      recheckDueInSec,
      connectBand,
      refreshTriage,
      bindBand,
      pendingSms,
      alertBody,
      escalationNotice,
      escalationDueInSec,
    ],
  );

  return <GuardianContext.Provider value={value}>{children}</GuardianContext.Provider>;
}

export function useGuardian(): GuardianState {
  const ctx = useContext(GuardianContext);
  if (!ctx) throw new Error('useGuardian must be used within GuardianProvider');
  return ctx;
}
