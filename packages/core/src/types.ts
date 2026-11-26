/**
 * Shared domain types for Neema.
 * No runtime code here — only contracts used by core, firmware protocol, and app services.
 */

/** Result of triage. UNKNOWN means we lack valid data and must never be shown as GREEN. */
export type TriageLevel = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

/** Pregnancy and postpartum use separate rule behaviour where physiology differs. */
export type Stage = 'pregnancy' | 'postpartum';

/**
 * The only vocabulary the rules understand.
 * Voice, taps and any future language model must map to these codes.
 */
export type SymptomCode =
  | 'headache'
  | 'blurred_vision'
  | 'upper_abdominal_pain'
  | 'heavy_bleeding'
  | 'fever_chills'
  | 'baby_moving_less'
  | 'swelling_face_hands'
  | 'low_mood'
  | 'other';

/** Identifiers of triage rules, logged with every result for explainability. */
export type RuleId =
  | 'R1_SEVERE_BP'
  | 'R2_RAISED_BP'
  | 'R3_RAISED_BP_WITH_SYMPTOM'
  | 'R4_RAISED_BP_PERSISTS'
  | 'R5_HEAVY_BLEEDING'
  | 'R6_FEVER'
  | 'R7_FEVER_FAST_PULSE_POSTPARTUM'
  | 'R8_PULSE_ABOVE_BASELINE'
  | 'R9_SOS'
  | 'R10_REDUCED_BABY_MOVEMENT'
  | 'R11_SIGNAL_INVALID'
  | 'R12_NOTHING_CONCERNING'
  | 'R13_SHOCK_INDEX'
  | 'R14_SIGNAL_LOST_WITH_SYMPTOMS';

/** Optional daily check-in. CONTEXT ONLY — rules never read it. */
export interface CheckIn {
  id: string;
  tsMs: number;
  /** 0..100 slider. */
  energy: number;
  mood: 'great' | 'good' | 'okay' | 'low' | 'very_low';
}

/** Body regions for the tap-to-place map. */
export type BodyRegion =
  | 'head'
  | 'upper_abdomen'
  | 'lower_abdomen'
  | 'breast'
  | 'calf'
  | 'face_hands'
  | 'wound';

/** Kiswahili EPDS answers. Cut-offs are placeholders for clinician review. */
export interface EpdsResult {
  id: string;
  tsMs: number;
  answers: number[];
  total: number;
  item10: number;
}

/** Birth preparedness checklist — not a risk score. */
export interface BirthPlan {
  facility?: string;
  skilledAttendant: boolean;
  bloodDonor: boolean;
  savings: boolean;
  companion: boolean;
  transport: boolean;
}

/** CareLoop-style follow-up after an alert. Humans alone set arrive. */
export type LoopStage = 'watch' | 'warn' | 'act' | 'chase' | 'arrive';

export interface FollowUp {
  alertId: string;
  stage: LoopStage;
  chaseCount: number;
  lastChaseAtMs?: number;
  /** ONLY a human sets this, never the app. */
  arrivalConfirmedBy?: 'chp' | 'nurse';
  arrivalConfirmedAtMs?: number;
}

/** Companion state. Derived from triage; never decides triage. */
export type AvatarState = 'calm' | 'watchful' | 'urgent' | 'waiting';

/** One reading from the band, about once per second. Never persisted. */
export interface VitalsSample {
  /** Packet sequence; wraps at 65535; used to detect dropped packets. */
  seq: number;
  /** Phone time when received (the band has no clock). */
  tsMs: number;
  /** bpm; null when the band marks it invalid. */
  heartRate: number | null;
  /** RAW skin temperature in C (calibration is applied in the app). */
  skinTempC: number | null;
  /** 0..100 from the band. */
  signalQuality: number;
  /** null when unknown. */
  batteryPct: number | null;
  /** true while the SOS button flag is set. */
  sos: boolean;
  /** true when the band is in scripted demo mode. */
  demo: boolean;
}

/** One stored row per minute. Calibrated temperature. */
export interface VitalsMinute {
  /** Start of the minute. */
  tsMs: number;
  hrMean: number | null;
  hrMin: number | null;
  hrMax: number | null;
  /** Calibrated skin temperature mean for the minute. */
  tempMeanC: number | null;
  /** 0..1 share of the minute with valid data. */
  validFraction: number;
}

/** Blood pressure, entered manually from a cuff. */
export interface BpReading {
  id: string;
  tsMs: number;
  /** mmHg */
  systolic: number;
  /** mmHg */
  diastolic: number;
  enteredBy: 'mother' | 'chp' | 'nurse';
  source: 'home_cuff' | 'clinic';
}

/** Symptoms reported by the mother (or CHP on her behalf). */
export interface SymptomReport {
  id: string;
  tsMs: number;
  codes: SymptomCode[];
  inputMethod: 'tap' | 'voice';
  /** Free text; never read by the rules. */
  note?: string;
}

/** Everything the triage function needs. Pure input, no hidden state. */
export interface TriageInput {
  nowMs: number;
  stage: Stage;
  /** Pregnancy only. */
  gestationWeeks?: number;
  /** Recent minutes, oldest first (at least the last 30 minutes if available). */
  vitals: VitalsMinute[];
  /** Recent readings, oldest first. */
  bp: BpReading[];
  /** Recent reports, oldest first. */
  symptoms: SymptomReport[];
  sosActive: boolean;
  /**
   * Mother says she is resting now.
   * ASSUMPTION: no motion sensor yet, so resting is explicit or night window.
   */
  markedResting: boolean;
  /** z-scores from the personal baseline. */
  baselineZ: { hr: number | null; temp: number | null };
  /**
   * IANA timezone for sleep-window checks (e.g. Africa/Nairobi).
   * When omitted, sleep window uses UTC.
   */
  timeZone?: string;
}

/** Output of triage. Fully explainable. */
export interface TriageResult {
  level: TriageLevel;
  firedRules: RuleId[];
  /** Short machine-readable reason codes, for example 'bp_high', 'fever'. */
  reasons: string[];
  /** Key into messages/sw.json. */
  messageKey: string;
  /** Set for YELLOW when a recheck is needed. */
  recheckInMinutes?: number;
  /** Version of triage.config.json used. */
  configVersion: string;
  evaluatedAtMs: number;
}

/** Who to alert and in what order. */
export interface Contact {
  id: string;
  name: string;
  role: 'chp' | 'family' | 'supervisor';
  /** E.164 where possible. */
  phone: string;
  /** 1 first. */
  escalationOrder: number;
}

/** A raised alert and what happened to it. */
export interface AlertRecord {
  id: string;
  tsMs: number;
  level: Exclude<TriageLevel, 'GREEN' | 'UNKNOWN'>;
  firedRules: RuleId[];
  /** Reason codes from the triage result, so a sticky RED can still explain itself. */
  reasons?: string[];
  /** The SMS text prepared for this alert, kept on the phone so escalation can resend it. */
  smsBody?: string;
  notified: { contactId: string; method: 'sms_link'; atMs: number }[];
  /** RED stays active until this is set. */
  acknowledgedAtMs?: number;
  /** Who confirmed someone is acting: CHP reply, mother on her way, or a clinician. */
  acknowledgedBy?: 'chp_replied' | 'mother_on_the_way' | 'clinician_cleared';
  outcome?: 'resolved' | 'went_to_facility' | 'false_alarm';
}

/** Commands the phone sends to the band. */
export type BandCommand =
  | { kind: 'led'; color: 'off' | 'green' | 'yellow' | 'red' }
  | { kind: 'vibrate'; pattern: 'short' | 'long' | 'sos' }
  /** 0 real sensors, 1 normal night, 2 warning drift, 3 fever with fast pulse. */
  | { kind: 'demo'; scenario: 0 | 1 | 2 | 3 };
