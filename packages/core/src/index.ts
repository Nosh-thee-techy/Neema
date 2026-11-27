/**
 * Public exports for @neema/core.
 * Consumers import only from this barrel — keep it free of browser APIs.
 */

export type {
  AlertRecord,
  AvatarState,
  BandCommand,
  BirthPlan,
  BodyRegion,
  BpReading,
  CheckIn,
  Contact,
  EpdsResult,
  FollowUp,
  LoopStage,
  RuleId,
  Stage,
  SymptomCode,
  SymptomReport,
  TriageInput,
  TriageLevel,
  TriageResult,
  VitalsMinute,
  VitalsSample,
} from './types.js';

export {
  NEEMA_BLE,
  decodeVitals,
  encodeBandCommand,
  encodeVitalsPacket,
  parseBandCommand,
  parseVitalsPacket,
} from './protocol.js';

export {
  calibrateSkinTempC,
  evaluateTriage,
  getDefaultTriageConfig,
  localHour,
  type TriageConfig,
} from './triage.js';

export {
  BASELINE_MIN_SAMPLES,
  baselineProgress,
  createBaseline,
  normalRange,
  updateBaseline,
  zScore,
  type BaselineSignal,
  type BaselineState,
  type BaselineUpdate,
} from './baseline.js';

export {
  buildNurseSummary,
  summariseMinute,
  type NurseSummary,
  type NurseSummaryInput,
  type SummaryShareChoices,
} from './summary.js';

export {
  advanceFollowUp,
  chaseList,
  confirmArrival,
  openFollowUp,
} from './followup.js';

export { avatarState } from './avatar.js';

export { REGION_TO_SYMPTOM } from './bodyMap.js';

export {
  EPDS_CUTOFF,
  buildEpdsResult,
  scoreEpds,
  type EpdsScore,
} from './epds.js';

export { default as triageConfigJson } from './config/triage.config.json';
export { default as swMessages } from './messages/sw.json';

export {
  assertConfigSignedForFieldUse,
  getUnsignedTriageConfig,
  isConfigSignedForUse,
  recordClinicianSignOff,
  type ClinicianSignOff,
  type SignedTriageConfig,
} from './signoff.js';

export {
  applyMessageReview,
  getMessageCatalog,
  isCatalogFullyReviewed,
  pendingMessageKeys,
  type MessageEntry,
  type MessageReviewStatus,
} from './messages/catalog.js';

export {
  buildAlertSmsText,
  reasonPhrase,
  topReason,
  type AlertSmsDraft,
  type ReasonPhrase,
} from './messages/reasons.js';

export {
  HARDWARE_CHECKS,
  HARDWARE_DISCLAIMER,
  finishHardwareValidation,
  recordHardwareCheck,
  startHardwareValidation,
  type HardwareCheckDef,
  type HardwareCheckId,
  type HardwareCheckOutcome,
  type HardwareCheckResult,
  type HardwareValidationReport,
} from './hardwareValidation.js';

export {
  StubSymptomSpeechProvider,
  type SymptomSpeechHypothesis,
  type SymptomSpeechInput,
  type SymptomSpeechProvider,
} from './symptomSpeech.js';

export {
  DEMO_SCENARIOS,
  getDemoScenario,
  scenarioA,
  scenarioBSettled,
  scenarioBYellow,
  scenarioC,
  scenarioD,
  type DemoScenario,
  type DemoScenarioId,
} from './demoScenarios.js';

export {
  computeTrendSlope,
  type TrendOptions,
  type TrendPoint,
  type TrendResult,
  type TrendSignal,
} from './trend.js';

export { isPlaceholderPhone, normalizePhone } from './phone.js';

export {
  DEMO_ESCALATION,
  FIELD_ESCALATION,
  dueEscalationSteps,
  planEscalation,
  type EscalationStepPlan,
  type EscalationTiming,
} from './escalation.js';

export {
  WHO_CARE_CARDS,
  answerCareQuestion,
  enforceCareGuardrails,
  retrieveCareCards,
  type CareCard,
  type CareGuideAnswer,
  type CareGuideContext,
  type CareUrgency,
} from './careCards.js';

export {
  FULL_TERM_DAYS,
  eddFromGestationalAge,
  isValidGestationalAge,
  pregnancyProgress,
  toLocalIsoDate,
  parseLocalIsoDate,
  trimesterFor,
  type PregnancyDating,
  type PregnancyProgress,
} from './pregnancy.js';

export {
  WEEKLY_INSIGHTS,
  insightForWeek,
  weeklyInsightsReviewed,
  type WeeklyInsight,
} from './weeklyInsights.js';

export {
  ALLERGY_CODES,
  EMPTY_ALLERGIES,
  allergiesFromLegacy,
  cleanAllergyItems,
  isContradictory,
  setNoneKnown,
  toggleAllergy,
  type AllergyAnswer,
  type AllergyCode,
  type AllergyEntry,
} from './allergies.js';

export {
  TERMS_VERSION,
  validateRegistration,
  type RegistrationError,
  type RegistrationErrors,
  type RegistrationField,
  type RegistrationInput,
} from './registration.js';

export { WHO_ANC_CONTACT_WEEKS, nextAncContact, type AncContact } from './anc.js';

export {
  KEPI_VISITS,
  WHO_PNC_CONTACTS,
  nextKepiVisit,
  nextPncContact,
  postpartumProgress,
  type KepiVisit,
  type PncContact,
  type PostpartumProgress,
} from './postpartum.js';

export {
  NEWBORN_DANGER_SIGNS,
  NEWBORN_TIPS,
  RECOVERY_EMERGENCY_SIGNS,
  RECOVERY_STAGES,
  RECOVERY_TODAY_SIGNS,
  recoveryContentReviewed,
  recoveryStageFor,
  type Bi,
  type RecoveryStage,
  type RecoveryTopic,
} from './recoveryTimeline.js';
