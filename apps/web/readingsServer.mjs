/**
 * Pull the latest sensor document. The phone asks Neema; Neema logs in and
 * keeps the session cookie. The password never goes to the phone.
 *
 * READINGS_API_USERNAME
 * READINGS_API_PASSWORD
 * READINGS_API_URL  defaults to this band's latest reading
 */

const DEFAULT_URL =
  'https://bp-sensor.57-131-131-200.sslip.io/api/readings?device=esp32-3076f5f070a8&limit=1';

let sessionCookie = '';

export function readingsConfigured() {
  return Boolean((process.env.READINGS_API_USERNAME || '').trim() && (process.env.READINGS_API_PASSWORD || '').trim());
}

function readingsUrl() {
  return (process.env.READINGS_API_URL || DEFAULT_URL).trim();
}

function cookieFrom(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const list = res.headers.getSetCookie();
    if (list.length) return list.map((part) => part.split(';')[0]).join('; ');
  }
  const single = res.headers.get('set-cookie');
  if (!single) return '';
  return single
    .split(/,(?=[^;,]+=)/)
    .map((part) => part.split(';')[0].trim())
    .join('; ');
}

async function login() {
  const origin = new URL(readingsUrl()).origin;
  const res = await fetch(`${origin}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      username: process.env.READINGS_API_USERNAME.trim(),
      password: process.env.READINGS_API_PASSWORD.trim(),
    }),
  });
  if (!res.ok) {
    sessionCookie = '';
    return false;
  }
  sessionCookie = cookieFrom(res);
  return Boolean(sessionCookie);
}

async function pull(cookie) {
  return fetch(readingsUrl(), {
    headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  });
}

export async function fetchLatestReading() {
  if (!readingsConfigured()) {
    return { status: 503, body: { configured: false } };
  }
  try {
    if (!sessionCookie) {
      const ok = await login();
      if (!ok) return { status: 502, body: { error: 'The readings database could not be reached.' } };
    }
    let upstream = await pull(sessionCookie);
    if (upstream.status === 401 || upstream.status === 403) {
      const ok = await login();
      if (!ok) return { status: 502, body: { error: 'The readings database could not be reached.' } };
      upstream = await pull(sessionCookie);
    }
    const text = await upstream.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return { status: 502, body: { error: 'The readings database did not return JSON.' } };
    }
    if (!upstream.ok) {
      return { status: 502, body: { error: 'The readings database could not be reached.' } };
    }
    return { status: 200, body };
  } catch {
    return { status: 502, body: { error: 'The readings database could not be reached.' } };
  }
}
