/**
 * A reading stored by the sensor database.
 * Pulse and temperature are hers (skin). Humidity is room air and is not used.
 */

import type { VitalsSample } from './types.js';

export interface SensorReading {
  deviceId: string | null;
  /** bpm, or null when missing or implausible. */
  pulse: number | null;
  /** Skin temperature °C, or null when missing or implausible. */
  skinTempC: number | null;
  /** When the database says the reading was taken. Null when it did not say. */
  recordedAtMs: number | null;
  /** Age reported by the database, when it sends one. */
  ageSeconds: number | null;
}

const STALE_MS = 5 * 60_000;

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function denied(raw: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => raw[key] === false);
}

function pulseOf(raw: Record<string, unknown>): number | null {
  if (denied(raw, ['pulse_valid', 'valid_pulse', 'hr_valid'])) return null;
  const n = num(raw.pulse ?? raw.heart_rate_bpm ?? raw.heart_rate ?? raw.heartRate);
  if (n === null || n < 30 || n > 220) return null;
  return Math.round(n);
}

function skinOf(raw: Record<string, unknown>): number | null {
  if (denied(raw, ['temperature_valid', 'temp_valid', 'valid_temperature'])) return null;
  const n = num(raw.temperature_c ?? raw.temperature ?? raw.skin_temp ?? raw.skinTempC ?? raw.temp);
  if (n === null || n < 20 || n > 45) return null;
  return Math.round(n * 10) / 10;
}

function timeOf(raw: Record<string, unknown>): number | null {
  const value = raw.captured_at ?? raw.received_at ?? raw.recorded_at ?? raw.created_at ?? raw.timestamp ?? raw.ts ?? raw.tsMs ?? raw.time;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function one(raw: unknown): SensorReading | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const pulse = pulseOf(row);
  const skinTempC = skinOf(row);
  if (pulse === null && skinTempC === null) return null;
  const device = row.device_id ?? row.deviceId ?? row.device;
  const age = num(row.age_seconds ?? row.ageSeconds);
  return {
    deviceId: typeof device === 'string' && device.trim() ? device.trim() : null,
    pulse,
    skinTempC,
    recordedAtMs: timeOf(row),
    ageSeconds: age !== null && age >= 0 ? age : null,
  };
}

function rowsOf(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const body = raw as Record<string, unknown>;
  if (body.configured === false) return [];
  if (body.latest && typeof body.latest === 'object') {
    const latest = body.latest as Record<string, unknown>;
    return [{ ...latest, age_seconds: body.age_seconds, live: body.live }];
  }
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.readings)) return body.readings;
  if (Array.isArray(body.data)) return body.data;
  return [raw];
}

/** The newest usable reading in a document, a list, or `{ readings: [] }`. */
export function parseSensorPayload(raw: unknown): SensorReading | null {
  let best: SensorReading | null = null;
  for (const row of rowsOf(raw)) {
    const reading = one(row);
    if (!reading) continue;
    if (!best) {
      best = reading;
      continue;
    }
    const next = reading.recordedAtMs ?? -1;
    const prev = best.recordedAtMs ?? -1;
    if (next >= prev) best = reading;
  }
  return best;
}

/**
 * Turn a database document into the reading Neema already watches.
 * A document older than 5 minutes is kept, with no signal, so it cannot look live.
 */
export function sampleFromSensorPayload(raw: unknown, receivedAtMs: number, seq: number): VitalsSample | null {
  const reading = parseSensorPayload(raw);
  if (!reading) return null;
  const tsMs = reading.recordedAtMs ?? (reading.ageSeconds !== null ? receivedAtMs - reading.ageSeconds * 1000 : receivedAtMs);
  const ageMs = reading.ageSeconds !== null ? reading.ageSeconds * 1000 : receivedAtMs - tsMs;
  const fresh = ageMs <= STALE_MS && ageMs >= -60_000;
  return {
    seq: seq & 0xffff,
    tsMs,
    heartRate: reading.pulse,
    skinTempC: reading.skinTempC,
    signalQuality: fresh ? 90 : 0,
    batteryPct: null,
    sos: false,
    demo: false,
  };
}
