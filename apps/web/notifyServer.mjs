/**
 * SOS notices: a voice call Neema places, and an SMS, through a phone gateway.
 * Africa's Talking is used when its keys are set (Kenyan numbers). Twilio is the other.
 * 999 and 112 are never dialled from here. Those stay on the mother's own phone.
 */

const scripts = new Map();

function env(name) {
  return (process.env[name] || '').trim();
}

function atOn() {
  return Boolean(env('AT_API_KEY') && env('AT_USERNAME') && env('AT_FROM'));
}

function twilioOn() {
  return Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_FROM'));
}

export function noticesConfigured() {
  return atOn() || twilioOn();
}

function digits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function isRealMobile(phone) {
  const d = digits(phone);
  if (d.length < 8 || d.length > 15) return false;
  if (d === '999' || d === '112' || d === '911') return false;
  return true;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function remember(phone, text) {
  const key = digits(phone).slice(-9);
  if (!key) return;
  scripts.set(key, { text: String(text).slice(0, 500), at: Date.now() });
}

function recall(phone) {
  const key = digits(phone).slice(-9);
  const row = key ? scripts.get(key) : null;
  if (!row || Date.now() - row.at > 15 * 60 * 1000) {
    return 'This is Neema. Please check on the mother now. This call is urgent.';
  }
  return row.text;
}

export function handleVoice(phone) {
  return voiceXmlFor(phone);
}

function voiceXmlFor(phone) {
  const line = escapeXml(recall(phone));
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="woman">${line}</Say></Response>`;
}

/** Phone the gateway is asking us to speak to, from an Africa's Talking callback. */
export function phoneFromCallback(query, raw) {
  const bag = { ...query };
  if (raw && raw.trim().startsWith('{')) {
    try {
      Object.assign(bag, JSON.parse(raw));
    } catch {
      /* form body below */
    }
  } else if (raw && raw.includes('=')) {
    const params = new URLSearchParams(raw);
    for (const [k, v] of params) bag[k] = v;
  }
  return (
    bag.destinationNumber ||
    bag.clientDialedNumber ||
    bag.callerNumber ||
    bag.phoneNumber ||
    ''
  );
}

async function atSms(to, message) {
  const username = env('AT_USERNAME');
  const body = new URLSearchParams({ username, to, message });
  const from = env('AT_FROM');
  if (from) body.set('from', from);
  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey: env('AT_API_KEY'),
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}

async function atCall(to, message) {
  remember(to, message);
  const body = new URLSearchParams({
    username: env('AT_USERNAME'),
    from: env('AT_FROM'),
    to,
  });
  const res = await fetch('https://voice.africastalking.com/call', {
    method: 'POST',
    headers: {
      apiKey: env('AT_API_KEY'),
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}

async function twilio(path, fields) {
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/${path}.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}

/**
 * Places the voice call and sends the SMS.
 * `calls` is who Neema phones and what she says. `sms` is the text message.
 */
export async function placeNotices(input) {
  if (!noticesConfigured()) {
    return { configured: false, callsPlaced: 0, smsSent: 0 };
  }
  const calls = Array.isArray(input.calls) ? input.calls.slice(0, 3) : [];
  const texts = Array.isArray(input.sms) ? input.sms.slice(0, 3) : [];
  let callsPlaced = 0;
  let smsSent = 0;
  const useAt = atOn();

  for (const row of calls) {
    const to = String(row?.to || '');
    const message = String(row?.message || '').trim().slice(0, 500);
    if (!isRealMobile(to) || !message) continue;
    const ok = useAt
      ? await atCall(to, message).catch(() => false)
      : await twilio('Calls', {
          To: to,
          From: env('TWILIO_FROM'),
          Twiml: `<Response><Say voice="Polly.Joanna">${escapeXml(message)}</Say></Response>`,
        }).catch(() => false);
    if (ok) callsPlaced += 1;
  }

  for (const row of texts) {
    const to = String(row?.to || '');
    const message = String(row?.message || '').trim().slice(0, 500);
    if (!isRealMobile(to) || !message) continue;
    const ok = useAt
      ? await atSms(to, message).catch(() => false)
      : await twilio('Messages', { To: to, From: env('TWILIO_FROM'), Body: message }).catch(() => false);
    if (ok) smsSent += 1;
  }

  return { configured: true, callsPlaced, smsSent };
}
