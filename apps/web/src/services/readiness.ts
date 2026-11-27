/**
 * Field-readiness gates: clinician sign-off, Swahili review, hardware QA, auth/consent.
 * Demo mode may run without these; field alerts must not.
 */

import {
  getMessageCatalog,
  getUnsignedTriageConfig,
  isCatalogFullyReviewed,
  isConfigSignedForUse,
  pendingMessageKeys,
  weeklyInsightsReviewed,
  recoveryContentReviewed,
  type HardwareValidationReport,
  type MessageEntry,
  type SignedTriageConfig,
} from '@neema/core';
import { db } from '../storage/db';
import { getAuthMeta, isSessionUnlocked } from './auth';
import { loadConsent } from './passport';
import { contactReadiness } from './contacts';

export interface ReadinessReport {
  demoAllowed: boolean;
  fieldReady: boolean;
  config: SignedTriageConfig;
  messages: MessageEntry[];
  pendingMessages: string[];
  messagesReviewed: boolean;
  configSigned: boolean;
  hardwareEngineeringPass: boolean;
  latestHardware: HardwareValidationReport | null;
  pinEnabled: boolean;
  sessionUnlocked: boolean;
  consentOnFile: boolean;
  chpContactOnFile: boolean;
  weeklyContentReviewed: boolean;
  blockers: string[];
}

async function loadSignedConfig(): Promise<SignedTriageConfig> {
  const row = await db.signOff.get('triage');
  const base = getUnsignedTriageConfig();
  if (!row) return base;
  return {
    ...base,
    version: row.configVersion || base.version,
    signOff: {
      configVersion: row.configVersion,
      reviewerName: row.reviewerName,
      reviewerRole: row.reviewerRole,
      reviewedOn: row.reviewedOn,
      attestation: row.attestation,
      signed: row.signed,
      ...(row.notes !== undefined ? { notes: row.notes } : {}),
    },
  };
}

async function loadMessageCatalog(): Promise<MessageEntry[]> {
  const bundled = getMessageCatalog();
  const rows = await db.messageReviews.toArray();
  if (rows.length === 0) return bundled;
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return bundled.map((entry) => {
    const row = byKey.get(entry.key);
    if (!row) return entry;
    return {
      key: entry.key,
      sw: row.sw,
      enGloss: row.enGloss || entry.enGloss,
      status: row.status,
      ...(row.reviewerName !== undefined ? { reviewerName: row.reviewerName } : {}),
      ...(row.reviewedOn !== undefined ? { reviewedOn: row.reviewedOn } : {}),
      ...(row.notes !== undefined ? { notes: row.notes } : {}),
    };
  });
}

async function latestHardware(): Promise<HardwareValidationReport | null> {
  const row = await db.hardwareReports.orderBy('startedAtMs').reverse().first();
  if (!row) return null;
  return {
    id: row.id,
    deviceLabel: row.deviceLabel,
    operatorName: row.operatorName,
    startedAtMs: row.startedAtMs,
    ...(row.finishedAtMs !== undefined ? { finishedAtMs: row.finishedAtMs } : {}),
    outcomes: JSON.parse(row.outcomesJson) as HardwareValidationReport['outcomes'],
    engineeringPass: row.engineeringPass,
    disclaimer: row.disclaimer,
  };
}

/** Computes whether demo-only or field-ready mode is allowed. */
export async function getReadiness(): Promise<ReadinessReport> {
  const config = await loadSignedConfig();
  const messages = await loadMessageCatalog();
  const hardware = await latestHardware();
  const auth = await getAuthMeta();
  const consent = await loadConsent();
  const configSigned = isConfigSignedForUse(config);
  const messagesReviewed = isCatalogFullyReviewed(messages);
  const hardwareEngineeringPass = hardware?.engineeringPass === true;
  const pinEnabled = Boolean(auth?.pinEnabled);
  const sessionUnlocked = !pinEnabled || isSessionUnlocked();
  const consentOnFile = Boolean(consent);
  const contacts = await contactReadiness();

  const blockers: string[] = [];
  if (!configSigned) blockers.push('Triage thresholds are not clinician-signed.');
  if (!messagesReviewed) {
    blockers.push(`Swahili messages pending review: ${pendingMessageKeys(messages).join(', ')}`);
  }
  if (!hardwareEngineeringPass) blockers.push('Hardware engineering QA has not passed.');
  if (pinEnabled && !sessionUnlocked) blockers.push('Session is locked.');
  if (!consentOnFile) blockers.push('No consent record on file.');
  if (!contacts.hasRealChp) blockers.push('No CHP phone number saved.');
  if (contacts.placeholders.length) blockers.push('Some contacts still have placeholder numbers.');
  const weeklyContentReviewed = weeklyInsightsReviewed();
  if (!weeklyContentReviewed) blockers.push('Weekly pregnancy cards are drafts: need nurse/midwife review and Swahili check.');
  if (!recoveryContentReviewed()) blockers.push('After-birth recovery guide, newborn tips and danger-sign rules R15–R17 are drafts: need clinician sign-off and Swahili check.');

  return {
    demoAllowed: true,
    fieldReady: blockers.length === 0,
    config,
    messages,
    pendingMessages: pendingMessageKeys(messages),
    messagesReviewed,
    configSigned,
    hardwareEngineeringPass,
    latestHardware: hardware,
    pinEnabled,
    sessionUnlocked,
    consentOnFile,
    chpContactOnFile: contacts.hasRealChp,
    weeklyContentReviewed,
    blockers,
  };
}

/**
 * Throws when attempting field (non-demo) alert sending without readiness.
 * Harness demo mode should pass { allowDemo: true }.
 */
export async function assertFieldReady(opts?: { allowDemo?: boolean }): Promise<ReadinessReport> {
  const report = await getReadiness();
  if (opts?.allowDemo) return report;
  if (!report.fieldReady) {
    throw new Error(`Not field-ready: ${report.blockers.join(' ')}`);
  }
  return report;
}
