/**
 * Swahili message catalog with per-key review status.
 * Draft strings ship for the demo; "reviewed" requires a real native speaker + CHP.
 */

import swJson from './sw.json';

export type MessageReviewStatus = 'draft' | 'in_review' | 'reviewed' | 'rejected';

export interface MessageEntry {
  key: string;
  sw: string;
  /** Short English gloss for reviewers (not spoken to mothers). */
  enGloss: string;
  status: MessageReviewStatus;
  reviewerName?: string;
  reviewedOn?: string;
  notes?: string;
}

const GLOSSES: Record<string, string> = {
  green_calm: 'Hello mama. Your readings look fine now. We will check again later.',
  yellow_recheck_bp: 'Your blood pressure is a little high. Rest, sit up, and we will measure again later.',
  yellow_fever: 'Your temperature is raised. Recheck and contact a health worker today.',
  yellow_pulse_baseline: 'Your heart rate is above your usual. Rest and we will measure again.',
  yellow_baby_movement: 'Baby movement has reduced. Please go to the clinic today.',
  yellow_signal_lost: 'The band signal is weak, but you reported symptoms. Contact a health worker today.',
  red_go_now: 'Go to a health facility now. Do not wait for morning. Open the message to your health worker.',
  red_bleeding: 'You are seeing heavy bleeding. Go to a health facility now. Open the message to your health worker.',
  red_sos: 'SOS signal received. Open the message for help. Go to a facility if you can.',
  unknown_check_band: 'Check your band. There is no valid data right now.',
  epds_ok: 'Thank you mama. Your answers are kept private on this phone.',
  red_talk_now:
    'Please talk to someone right now. Call your CHP or someone you trust, or call 1199 free. You are not alone.',
  yellow_review_today: 'This sign needs a health worker today. Contact your CHP or go to the clinic today.',
  epds_talk_to_person:
    'Please talk to a health worker or someone you trust. This is not a diagnosis — it is support.',
};

function loadDraftCatalog(): MessageEntry[] {
  const entries: MessageEntry[] = [];
  for (const [key, value] of Object.entries(swJson)) {
    if (key.startsWith('_')) continue;
    if (typeof value !== 'string') continue;
    entries.push({
      key,
      sw: value,
      enGloss: GLOSSES[key] ?? '',
      status: 'draft',
    });
  }
  return entries;
}

/** Returns the bundled draft catalog (all keys draft until reviewed). */
export function getMessageCatalog(): MessageEntry[] {
  return loadDraftCatalog();
}

/** Applies a human review result to one message key. */
export function applyMessageReview(
  catalog: MessageEntry[],
  key: string,
  review: {
    status: Exclude<MessageReviewStatus, 'draft'>;
    reviewerName: string;
    reviewedOn: string;
    sw?: string;
    notes?: string;
  },
): MessageEntry[] {
  return catalog.map((entry) => {
    if (entry.key !== key) return entry;
    return {
      ...entry,
      status: review.status,
      reviewerName: review.reviewerName,
      reviewedOn: review.reviewedOn,
      ...(review.sw !== undefined ? { sw: review.sw } : {}),
      ...(review.notes !== undefined ? { notes: review.notes } : {}),
    };
  });
}

/** True when every spoken action key is marked reviewed. */
export function isCatalogFullyReviewed(catalog: MessageEntry[]): boolean {
  return catalog.length > 0 && catalog.every((e) => e.status === 'reviewed');
}

/** Keys still blocking field messaging. */
export function pendingMessageKeys(catalog: MessageEntry[]): string[] {
  return catalog.filter((e) => e.status !== 'reviewed').map((e) => e.key);
}
