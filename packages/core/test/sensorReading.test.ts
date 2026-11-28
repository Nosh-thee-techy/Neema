import { describe, expect, it } from 'vitest';
import { parseSensorPayload, sampleFromSensorPayload } from '../src/sensorReading.js';

const now = Date.parse('2026-11-28T09:00:00Z');

describe('sensor database reading', () => {
  it('takes pulse and skin temperature from the stored document', () => {
    const sample = sampleFromSensorPayload(
      {
        device_id: 'esp32_sensor_01',
        temperature: 36.4,
        humidity: 58.2,
        pulse: 78,
        source: 'esp32_wifi',
        protocol: 'smart_med_wifi_v1',
        recorded_at: '2026-11-28T08:59:00Z',
      },
      now,
      4,
    );
    expect(sample).toMatchObject({
      seq: 4,
      heartRate: 78,
      skinTempC: 36.4,
      signalQuality: 90,
      sos: false,
      demo: false,
    });
  });

  it('uses the newest row when the database returns a list', () => {
    const reading = parseSensorPayload({
      readings: [
        { device_id: 'esp32_sensor_01', pulse: 70, temperature: 36.1, recorded_at: '2026-11-28T08:00:00Z' },
        { device_id: 'esp32_sensor_01', pulse: 88, temperature: 36.6, recorded_at: '2026-11-28T08:59:30Z' },
      ],
    });
    expect(reading?.pulse).toBe(88);
    expect(reading?.skinTempC).toBe(36.6);
  });

  it('does not treat a stale document as a live signal', () => {
    const sample = sampleFromSensorPayload(
      { pulse: 78, temperature: 36.4, recorded_at: '2026-11-28T08:00:00Z' },
      now,
      1,
    );
    expect(sample?.signalQuality).toBe(0);
    expect(sample?.heartRate).toBe(78);
  });

  it('accepts the document they store today', () => {
    const sample = sampleFromSensorPayload(
      {
        device_id: 'esp32_sensor_01',
        temperature: 26.5,
        humidity: 58.2,
        pulse: 78,
        source: 'esp32_wifi',
        protocol: 'smart_med_wifi_v1',
      },
      now,
      1,
    );
    expect(sample?.heartRate).toBe(78);
    expect(sample?.skinTempC).toBe(26.5);
    expect(sample?.signalQuality).toBe(90);
  });

  it('reads the stats document, including an invalid pulse', () => {
    const reading = parseSensorPayload({
      latest: { temperature: 36.2, humidity: 50, pulse: 78, timestamp: '2026-11-28T08:59:40Z', pulse_valid: false },
      live: true,
      age_seconds: 4,
    });
    expect(reading?.pulse).toBeNull();
    expect(reading?.skinTempC).toBe(36.2);
    expect(reading?.ageSeconds).toBe(4);
  });

  it('reads the sensor database document', () => {
    const sample = sampleFromSensorPayload(
      {
        items: [{
          device_id: 'esp32-3076f5f070a8',
          temperature_c: 27.2,
          humidity_pct: 52.1,
          heart_rate_bpm: null,
          temperature_valid: true,
          pulse_valid: false,
          captured_at: '2026-11-28T08:33:59.579000+00:00',
        }],
      },
      now,
      3,
    );
    expect(sample?.heartRate).toBeNull();
    expect(sample?.skinTempC).toBe(27.2);
    expect(sample?.signalQuality).toBe(0);
  });

  it('reads the newest item from the device history', () => {
    const sample = sampleFromSensorPayload(
      { items: [{ device: 'esp32-3076f5f070a8', temperature: 36.5, pulse: 82, timestamp: '2026-11-28T08:59:50Z' }] },
      now,
      2,
    );
    expect(sample?.heartRate).toBe(82);
    expect(sample?.skinTempC).toBe(36.5);
    expect(sample?.signalQuality).toBe(90);
  });

  it('ignores a document with no usable pulse or temperature', () => {
    expect(parseSensorPayload({ humidity: 58, device_id: 'esp32_sensor_01' })).toBeNull();
    expect(sampleFromSensorPayload({ configured: false }, now, 1)).toBeNull();
  });
});
