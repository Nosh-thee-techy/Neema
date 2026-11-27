/**
 * Emergency number for the phone dialer.
 * Kenya: 999 and 112 both reach emergency services. TEAM TO CONFIRM before field use
 * (and whether a county ambulance number should be offered too).
 */
export const EMERGENCY_NUMBER = '999';

export const EMERGENCY_TEL = `tel:${EMERGENCY_NUMBER}`;

/**
 * Opens the phone's dialer with the emergency number filled in.
 * Browsers cannot place the call themselves: she still presses the green call button.
 */
export function openEmergencyDialer(): void {
  const a = document.createElement('a');
  a.href = EMERGENCY_TEL;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
