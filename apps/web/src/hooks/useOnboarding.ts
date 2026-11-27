const KEY = 'neema.onboarding.v1';

export interface OnboardingFlags {
  orientationDone: boolean;
  consentDone: boolean;
  /** Registration wizard finished (v2). Older installs only have consentDone. */
  registrationDone?: boolean;
}

/** Registered = wizard done, or an older install that already gave consent. */
export function isRegistered(flags: OnboardingFlags): boolean {
  return Boolean(flags.registrationDone || flags.consentDone);
}

export function loadOnboarding(): OnboardingFlags {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { orientationDone: false, consentDone: false };
    return JSON.parse(raw) as OnboardingFlags;
  } catch {
    return { orientationDone: false, consentDone: false };
  }
}

export function saveOnboarding(flags: OnboardingFlags): void {
  localStorage.setItem(KEY, JSON.stringify(flags));
}
