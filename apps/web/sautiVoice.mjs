/**
 * Neema's studio voice.
 * Sauti's catalog id "female" (Female 1) sits around 130 Hz, the same range as
 * the male voices, so she sounds like a man. Ask for Female 2, then play the
 * line a little faster so the pitch sits in a woman's speaking range.
 */

const WOMAN_IDS = ['female2', 'female3', 'female4', 'female5'];

/**
 * Playback speed. Female 2 is about 150 Hz, in a man's range. Playing the line
 * at 1.42 raises her to about 200 Hz. The words are a little shorter, not retimed,
 * which keeps the tone natural.
 */
const WOMAN_PITCH = 1.42;

/**
 * A catalog woman, never a male id. "female" is Female 1, which sounds like a man,
 * so that name selects Female 2.
 */
export function voiceForNeema(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (WOMAN_IDS.includes(v)) return v;
  return 'female2';
}

export function womanVoiceFallbacks(chosen) {
  return WOMAN_IDS.filter((id) => id !== chosen);
}

function parsePcm16(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  let rate = 0;
  let channels = 0;
  let bits = 0;
  let dataStart = -1;
  let dataLen = 0;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ' && size >= 16) {
      const format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
      if (format !== 1) return null;
    } else if (id === 'data') {
      dataStart = body;
      dataLen = Math.min(size, buf.length - body);
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!rate || channels < 1 || bits !== 16 || dataStart < 0) return null;
  const frame = channels * 2;
  const count = Math.floor(dataLen / frame);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += buf.readInt16LE(dataStart + i * frame + c * 2);
    samples[i] = sum / channels / 32768;
  }
  return { rate, samples };
}

/** Read the waveform faster so the pitch rises and the clip gets shorter. */
function resampleFaster(samples, factor) {
  const outLen = Math.max(1, Math.floor(samples.length / factor));
  const out = new Float32Array(outLen);
  const last = samples.length - 1;
  for (let i = 0; i < outLen; i++) {
    const src = i * factor;
    const i0 = Math.min(last, src | 0);
    const i1 = Math.min(last, i0 + 1);
    const frac = src - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  let peak = 0;
  for (let i = 0; i < outLen; i++) {
    const a = Math.abs(out[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0.98) {
    const gain = 0.98 / peak;
    for (let i = 0; i < outLen; i++) out[i] *= gain;
  }
  return out;
}

function encodeWav(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Return WAV bytes in a woman's range. Non-WAV audio is left as-is. */
export function raiseToWoman(wav) {
  const parsed = parsePcm16(wav);
  if (!parsed) return wav;
  return encodeWav(resampleFaster(parsed.samples, WOMAN_PITCH), parsed.rate);
}
