/**
 * Asks the Neema server to place the SOS call and send the text.
 * If the phone line is not connected, this returns quietly and the
 * mother's own phone still opens 999 and the SMS buttons.
 */

export type SosNoticeResult = {
  configured: boolean;
  callsPlaced: number;
  smsSent: number;
};

export function phoneFromSmsHref(href: string): string | null {
  const match = href.match(/^sms:([^?]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function placeSosNotice(input: {
  calls: { to: string; message: string }[];
  sms: { to: string; message: string }[];
}): Promise<SosNoticeResult> {
  const empty = { configured: false, callsPlaced: 0, smsSent: 0 };
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return empty;
    const body = (await res.json()) as Partial<SosNoticeResult>;
    return {
      configured: Boolean(body.configured),
      callsPlaced: Number(body.callsPlaced) || 0,
      smsSent: Number(body.smsSent) || 0,
    };
  } catch {
    return empty;
  }
}
