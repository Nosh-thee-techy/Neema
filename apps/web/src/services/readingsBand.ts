/**
 * Live readings pulled from the sensor database through /api/readings.
 * The phone treats each document as one band sample.
 */

import { sampleFromSensorPayload, type BandCommand, type VitalsSample } from '@neema/core';
import type { BandSource, VitalsListener } from './bandSource';

const POLL_MS = 10_000;

export function createReadingsBand(): BandSource {
  const listeners = new Set<VitalsListener>();
  let timer = 0;
  let seq = 0;
  let connected = false;

  async function pull(strict: boolean): Promise<void> {
    const res = await fetch('/api/readings');
    if (res.status === 503) {
      if (strict) throw new Error('The band is not sending readings to Neema yet. Keep it on, and try again in a moment.');
      return;
    }
    if (!res.ok) throw new Error('The band readings could not be reached.');
    const body: unknown = await res.json();
    const sample: VitalsSample | null = sampleFromSensorPayload(body, Date.now(), seq);
    if (!sample) return;
    seq = (seq + 1) & 0xffff;
    for (const listener of listeners) listener(sample);
  }

  return {
    id: 'readings',
    async connect() {
      connected = true;
      await pull(true);
      timer = window.setInterval(() => {
        void pull(false).catch(() => undefined);
      }, POLL_MS);
    },
    async disconnect() {
      connected = false;
      window.clearInterval(timer);
      timer = 0;
    },
    isConnected: () => connected,
    onVitals(listener: VitalsListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async sendCommand(_command: BandCommand) {
      /* The database feed does not carry a buzz or a light. */
    },
  };
}
