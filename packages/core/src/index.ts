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
